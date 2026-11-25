import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { PLATFORM_DEFAULTS } from '@yuksaroy/domain';
import { env } from '../../common/env';
import { locate, type Geo } from '../../common/geoip';
import { IpBucket } from '../../common/ip-bucket';
import { PlatformConfigService, type PlatformConfigValues } from '../../common/platform-config.service';
import { PrismaService } from '../../common/prisma.service';
import { recordTelegram, recordTelegramSkipped } from '../../common/runtime';
import { parseAdminPhones } from '../organizations/domain/rules';
import { PlatformAdmin } from '../organizations/application/platform-admin';
import type { ActivityCategory, ActivityEvent, ActivityInput } from './activity.types';
import { CATALOG, type RefType } from './catalog';
import { renderLine, renderSummary, renderWindow, type RenderActor } from './format';
import { currentContext } from './request-context';
import { isCrawler } from './user-agent';

/*
 * Superadminlarga faoliyat xabari: har odam uchun bitta xabar, daqiqa davomida o'zi tahrirlanadi.
 *
 * Hammasi xotirada va bitta API jarayonida (ponytail: ko'p nusxa bo'lsa Redis kerak, IpBucket kabi).
 * Restart yoki deploy paytida ~60 s lik hali yuborilmagan satrlar yo'qoladi: haqiqat manbai
 * baribir AuditLog.
 *
 * record() va visit() SINXRON va hech qachon xato tashlamaydi: bildirishnoma foydalanuvchi so'rovini
 * sekinlashtirmasligi yoki sindirmasligi shart. Barcha bazaga va Telegramga murojaat keyin, taymerda,
 * try/catch ichida. AuditService ga bu yerdan murojaat YO'Q: aks holda xabar yuborish yangi audit
 * qatori yozib, cheksiz aylana bo'lardi.
 */
const FIRST_DELAY_MS = 15_000; // yangi oyna birinchi xabarini 15 s kutadi: kirish va birinchi bosishlar bitta xabarga tushsin
const WINDOW_MS = 60_000; // oyna umri, birinchi hodisadan boshlab
const EDIT_EVERY_MS = 15_000; // xabar tahriri orasidagi eng kam masofa
const MAX_STORED = 200; // oynada saqlanadigan hodisalar (xabarga 40 tasi sig'adi)
const CAP_PER_MIN = 20; // daqiqasiga yangi xabarlar (tahrir hisobga olinmaydi)
const SEND_GAP_MS = 500; // Telegramga ketma-ket ikki so'rov orasi
const QUEUE_MAX = 200;
const CACHE_MS = 60_000;
const SUMMARY_MS = 60_000;
const RECIPIENTS_MAX = 20;
const MAX_WINDOWS = 500; // ochiq oynalar chegarasi: tarqalgan suv toshqini xotirani to'ldirmasin

export interface TgResult { ok: boolean; result?: { message_id?: number }; error_code?: number; description?: string; parameters?: { retry_after?: number } }
export type TgSender = (method: string, body: Record<string, unknown>) => Promise<TgResult>;

/** Standart yuboruvchi: oddiy fetch. Testda (VITEST) hech qachon tarmoqqa chiqmaydi. */
const fetchSender: TgSender = async (method, body) => {
  if (process.env.VITEST) return { ok: false };
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return ((await r.json().catch(() => ({ ok: false, error_code: r.status }))) as TgResult);
};

const GATE: Record<ActivityCategory, keyof PlatformConfigValues> = {
  login: 'activityLogin', register: 'activityLogin', loginFailed: 'activityLogin',
  action: 'activityActions', visit: 'activityVisits', admin: 'activityAdmin', system: 'activitySystem',
};
const NEW_USER_ACTIONS = ['auth.login', 'auth.telegram_webapp', 'auth.telegram.link'];

interface Recipient { chatId: string; userId: string }
interface Win {
  key: string;
  actorId?: string | null;
  guestLabel?: string;
  system: boolean;
  events: ActivityEvent[];
  total: number;
  version: number; // har hodisada oshadi
  sentVersion: number; // oxirgi yuborishda ko'rilgan versiya
  msgs: Map<string, number>; // chatId -> message_id
  flushed: boolean;
  closed: boolean;
  suppressed: boolean;
  capTaken: boolean;
  lastFlushAt: number;
  lastText?: string;
  actor?: RenderActor | null;
  geo?: Promise<Geo | null>;
  editTimer?: NodeJS.Timeout;
  timers: NodeJS.Timeout[];
  chain: Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => { const t = setTimeout(r, ms); t.unref?.(); });
const sha = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

@Injectable()
export class ActivityService {
  private readonly wins = new Map<string, Win>();
  private readonly cap = new IpBucket(CAP_PER_MIN, 60_000);
  private readonly supp: Partial<Record<ActivityCategory, number>> = {};
  private suppTimer?: NodeJS.Timeout;
  private readonly queue: (() => Promise<void>)[] = [];
  private worker: Promise<void> | null = null;
  private readonly tg: TgSender;
  private readonly now: () => number;
  private gapMs: number;
  private recipients?: { at: number; list: Recipient[] };
  private staff?: { at: number; ids: Set<string> };
  private readonly adminPhones = parseAdminPhones(env.PLATFORM_ADMIN_PHONES);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    @Optional() opts?: { tg?: TgSender; now?: () => number; gapMs?: number },
  ) {
    this.tg = opts?.tg ?? fetchSender;
    this.now = opts?.now ?? Date.now;
    this.gapMs = opts?.gapMs ?? SEND_GAP_MS;
  }

  /** Sinxron, xato tashlamaydi. ip, ua va kanal bo'sh bo'lsa so'rov kontekstidan olinadi. */
  record(e: ActivityInput): void {
    try {
      const entry = CATALOG[e.action];
      const ctx = currentContext();
      const channel = e.channel ?? entry?.channel ?? ctx?.channel ?? 'web';
      const m = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : {};
      let category: ActivityCategory =
        entry?.cat ?? (e.action.startsWith('admin.') ? 'admin' : !e.actorId && !e.guest ? 'system' : 'action');
      if (m.isNew === true && NEW_USER_ACTIONS.includes(e.action)) category = 'register';
      // Bot kanalida IP va qurilma botning o'zinikiga tegishli: ko'rsatilmaydi
      const ip = channel === 'bot' ? undefined : (e.ip ?? ctx?.ip);
      const ua = channel === 'bot' ? undefined : (e.ua ?? ctx?.ua);
      if (category === 'visit' && isCrawler(ua)) return;
      const ev: ActivityEvent = { ...e, ip, ua, channel, at: this.now(), category };
      if (category === 'system') ev.actorId = null;

      const key = ev.actorId
        ? `u:${ev.actorId}`
        : category === 'system'
          ? 's'
          : (ev.guest?.key ?? `g:${sha(`${ip ?? ''}|${ua ?? ''}`)}`);
      let w = this.wins.get(key);
      if (w?.suppressed) { this.suppress([ev]); return; }
      if (!w && this.wins.size >= MAX_WINDOWS) { this.suppress([ev]); return; }
      if (!w) w = this.open(key, ev);
      w.version++;
      w.total++;
      if (w.events.length < MAX_STORED) w.events.push(ev);
      if (w.flushed) this.scheduleEdit(w);
    } catch (err) {
      console.error('activity record', err);
    }
  }

  /** Brauzer mayog'idan sahifa ko'rish: tizimga kirgan odamning yoki mehmonning (ip+ua) oynasiga qo'shiladi. */
  visit(v: { userId: string | null; path: string; referrer?: string | null; ip?: string | null; ua?: string | null }): void {
    this.record({ action: 'visit', actorId: v.userId, ip: v.ip, ua: v.ua, channel: 'web', meta: { path: v.path, referrer: v.referrer ?? undefined } });
  }

  /** Faqat testlar uchun: ochiq oynalarni hozir yopadi va navbat bo'shaguncha kutadi. */
  async flushAllForTest(): Promise<void> {
    this.gapMs = 0;
    for (const w of [...this.wins.values()]) await this.close(w);
    if (this.suppTimer) { clearTimeout(this.suppTimer); this.suppTimer = undefined; await this.sendSummary(); }
    while (this.worker) await this.worker;
  }

  // ── oynalar ──

  private open(key: string, first: ActivityEvent): Win {
    const w: Win = {
      key, actorId: first.actorId, guestLabel: first.guest?.label, system: first.category === 'system',
      events: [], total: 0, version: 0, sentVersion: 0, msgs: new Map(), flushed: false, closed: false,
      suppressed: false, capTaken: false, lastFlushAt: 0, timers: [], chain: Promise.resolve(),
    };
    const t1 = setTimeout(() => void this.flush(w), FIRST_DELAY_MS);
    const t2 = setTimeout(() => void this.close(w), WINDOW_MS);
    t1.unref?.();
    t2.unref?.();
    w.timers.push(t1, t2);
    this.wins.set(key, w);
    return w;
  }

  /** Yangi hodisa kelganda keyingi tahrir: oxirgi yuborishdan kamida EDIT_EVERY_MS keyin, bitta kutayotgan taymer. */
  private scheduleEdit(w: Win): void {
    if (w.editTimer || w.closed) return;
    const t = setTimeout(() => { w.editTimer = undefined; if (!w.closed) void this.flush(w); }, Math.max(0, w.lastFlushAt + EDIT_EVERY_MS - this.now()));
    t.unref?.();
    w.editTimer = t;
  }

  private flush(w: Win): Promise<void> {
    w.flushed = true;
    w.lastFlushAt = this.now();
    // Bitta oyna uchun yuborishlar ketma-ket: message_id kelmay turib ikkinchi sendMessage ketmasin
    return (w.chain = w.chain.then(() => this.send(w)).catch((err) => console.error('activity send', err)));
  }

  private async close(w: Win): Promise<void> {
    w.closed = true;
    w.timers.forEach(clearTimeout);
    if (w.editTimer) clearTimeout(w.editTimer);
    if (this.wins.get(w.key) === w) this.wins.delete(w.key);
    if (w.version !== w.sentVersion) await this.flush(w);
    else await w.chain;
  }

  // ── yuborish ──

  private async send(w: Win): Promise<void> {
    const seen = w.version;
    const cfg = await this.settings();
    const staff = await this.staffIds();
    const isStaff = !!w.actorId && staff.has(w.actorId);
    const events = w.events.filter((e) => cfg[GATE[e.category]] === 1 && !(e.category === 'visit' && isStaff && cfg.activityAdminVisits !== 1));
    w.sentVersion = seen;
    if (!events.length || w.suppressed) return;
    // O'z-o'ziga qoidasi kirish hodisalariga tegmaydi: parol tanlash, kod so'rash, begona kirish adminning o'z hisobida ham ko'rinsin
    const quiet = cfg.activitySelf !== 1 && events.every((e) => e.category !== 'login' && e.category !== 'register' && e.category !== 'loginFailed');
    const targets = (await this.getRecipients()).filter((r) => !(quiet && r.userId === w.actorId));
    if (!targets.length) return;
    if (!w.msgs.size && !w.capTaken) {
      if (!this.cap.take('all', this.now())) {
        w.suppressed = true;
        this.suppress(events);
        return;
      }
      w.capTaken = true;
    }
    const names = await this.resolveNames(events);
    w.actor ??= w.actorId ? await this.actorOf(w.actorId) : null;
    const ipSeen = events.find((e) => e.ip)?.ip;
    if (ipSeen && !w.geo) w.geo = locate(ipSeen).catch(() => null);
    const text = renderWindow({
      events,
      total: events.length + Math.max(0, w.total - w.events.length),
      actor: w.actor, actorId: w.actorId, staff: isStaff, guestLabel: w.guestLabel, system: w.system, geo: w.geo ? await w.geo : null,
      name: (t, id) => names.get(`${t}:${String(id)}`),
    });
    if (text === w.lastText) return;
    w.lastText = text;
    await Promise.all(targets.map((r) => this.sendOrEdit(w, r.chatId, text)));
  }

  private async sendOrEdit(w: Win, chat: string, text: string): Promise<void> {
    const id = w.msgs.get(chat);
    const base = { chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
    const res = await this.call(id ? 'editMessageText' : 'sendMessage', id ? { ...base, message_id: id } : base);
    if (!id && res.ok && res.result?.message_id) w.msgs.set(chat, res.result.message_id);
  }

  /** Chegaradan oshgan hodisalar: sanaladi, daqiqada bitta xulosa xabari ketadi. */
  private suppress(events: ActivityEvent[]): void {
    for (const e of events) this.supp[e.category] = (this.supp[e.category] ?? 0) + 1;
    if (!this.suppTimer) {
      this.suppTimer = setTimeout(() => { this.suppTimer = undefined; void this.sendSummary(); }, SUMMARY_MS);
      this.suppTimer.unref?.();
    }
  }

  private async sendSummary(): Promise<void> {
    try {
      const byCat = { ...this.supp };
      for (const k of Object.keys(this.supp)) delete this.supp[k as ActivityCategory];
      if (!Object.values(byCat).some((n) => (n ?? 0) > 0)) return;
      const text = renderSummary(byCat as Record<string, number>);
      for (const r of await this.getRecipients()) {
        void this.call('sendMessage', { chat_id: r.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      }
    } catch (err) {
      console.error('activity summary', err);
    }
  }

  // ── Telegram navbati: bitta ketma-ket oqim, 429 da pauza ──

  private call(method: string, body: Record<string, unknown>): Promise<TgResult> {
    return new Promise((resolve) => {
      if (this.queue.length >= QUEUE_MAX) {
        recordTelegramSkipped('activity');
        return resolve({ ok: false });
      }
      this.queue.push(async () => {
        let res = await this.attempt(method, body);
        if (!res.ok && res.error_code === 429) {
          await sleep(Math.min(60, res.parameters?.retry_after ?? 1) * 1000);
          res = await this.attempt(method, body);
        }
        // Matn o'zgarmagan tahrir xato emas
        if (res.ok) recordTelegram(true);
        else if (!(res.error_code === 400 && /not modified/i.test(res.description ?? ''))) recordTelegram(false, res.error_code ?? 0);
        resolve(res);
      });
      this.worker ??= this.run();
    });
  }

  private async attempt(method: string, body: Record<string, unknown>): Promise<TgResult> {
    try {
      return await this.tg(method, body);
    } catch {
      return { ok: false, error_code: 0 };
    }
  }

  private async run(): Promise<void> {
    try {
      while (this.queue.length) {
        await this.queue.shift()!();
        if (this.queue.length && this.gapMs) await sleep(this.gapMs);
      }
    } finally {
      this.worker = null;
    }
  }

  // ── bazadan o'qiladiganlar (yuborish paytida, keshlangan) ──

  private async settings(): Promise<PlatformConfigValues> {
    try {
      return await this.config.get();
    } catch {
      return { ...PLATFORM_DEFAULTS };
    }
  }

  /** Faqat PLATFORM_ADMIN (moderator emas) va Telegrami ulangan faol hisoblar. */
  private async getRecipients(): Promise<Recipient[]> {
    const t = this.now();
    if (this.recipients && t - this.recipients.at < CACHE_MS) return this.recipients.list;
    let list: Recipient[] = [];
    try {
      const phones = [...this.adminPhones];
      const rows = await this.prisma.telegramLink.findMany({
        where: { user: { isActive: true, OR: [{ memberships: { some: { roles: { has: 'PLATFORM_ADMIN' } } } }, ...(phones.length ? [{ phone: { in: phones } }] : [])] } },
        select: { chatId: true, userId: true },
        take: RECIPIENTS_MAX,
      });
      list = rows.map((r) => ({ chatId: String(r.chatId), userId: r.userId }));
    } catch (err) {
      console.error('activity recipients', err);
      return this.recipients?.list ?? [];
    }
    this.recipients = { at: t, list };
    return list;
  }

  private async staffIds(): Promise<Set<string>> {
    const t = this.now();
    if (this.staff && t - this.staff.at < CACHE_MS) return this.staff.ids;
    try {
      this.staff = { at: t, ids: new Set(await new PlatformAdmin(this.prisma).adminUserIds()) };
    } catch {
      this.staff ??= { at: t, ids: new Set() };
    }
    return this.staff.ids;
  }

  private async actorOf(id: string): Promise<RenderActor | null> {
    try {
      const u = await this.prisma.user.findUnique({
        where: { id },
        select: {
          fullName: true, phone: true, email: true, createdAt: true,
          telegram: { select: { username: true } },
          memberships: { where: { org: { kind: { not: 'PLATFORM' } } }, select: { org: { select: { name: true } } }, take: 2 },
        },
      });
      return u ? { id, fullName: u.fullName, phone: u.phone, email: u.email, createdAt: u.createdAt, username: u.telegram?.username, orgs: u.memberships.map((m) => m.org.name) } : null;
    } catch {
      return null;
    }
  }

  /** Satrlarda uchraydigan yozuv nomlari: tur bo'yicha bitta so'rov. Topilmaganining fakti tushib qoladi. */
  private async resolveNames(events: ActivityEvent[]): Promise<Map<string, string>> {
    const need = new Map<RefType, Set<string>>();
    for (const e of events) {
      renderLine(e, 'web', (t, id) => {
        if (typeof id === 'string' && id) (need.get(t) ?? need.set(t, new Set()).get(t)!).add(id);
        return '·';
      });
    }
    const out = new Map<string, string>();
    const p = this.prisma;
    const get = async <R extends { id: string }>(t: RefType, q: (ids: string[]) => Promise<R[]>, pick: (r: R) => string | null | undefined) => {
      const ids = [...(need.get(t) ?? [])].slice(0, 100);
      if (!ids.length) return;
      try {
        for (const r of await q(ids)) { const n = pick(r); if (n) out.set(`${t}:${r.id}`, n); }
      } catch (err) {
        console.error('activity names', err);
      }
    };
    await Promise.all([
      get('Listing', (ids) => p.listing.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }), (r) => r.title),
      get('Terminal', (ids) => p.terminal.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }), (r) => r.name),
      get('Organization', (ids) => p.organization.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }), (r) => r.name),
      get('User', (ids) => p.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, phone: true } }), (r) => r.fullName ?? r.phone),
      get('Order', (ids) => p.order.findMany({ where: { id: { in: ids } }, select: { id: true, no: true } }), (r) => r.no),
      get('MarketRequest', (ids) => p.marketRequest.findMany({ where: { id: { in: ids } }, select: { id: true, no: true } }), (r) => r.no),
      get('UrgentRequest', (ids) => p.urgentRequest.findMany({ where: { id: { in: ids } }, select: { id: true, no: true } }), (r) => r.no),
    ]);
    return out;
  }
}
