import { REGION_LABELS, type RegionCode } from '@yuksaroy/domain';
import { TG_MAX, clip, esc, webUrl } from '../../common/telegram';
import type { Geo } from '../../common/geoip';
import { CATALOG, type RefType } from './catalog';
import type { ActivityEvent, Channel } from './activity.types';
import { deviceLine } from './user-agent';
import { attr, clipCp } from './text';

export { attr, maskPhone } from './text';

const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' });
export const hhmmss = (at: number | Date) => TIME.format(at);
export const ddmmyyyy = (at: number | Date) => DATE.format(at).replace(/\//g, '.');

let regionNames: Intl.DisplayNames | undefined;
function countryName(cc: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(['uz'], { type: 'region' });
    // Uzbek ICU harfi ʻ (U+02BB) o'rniga ASCII tutuq belgisi: boshqa matnlar bilan bir xil ko'rinsin
    return (regionNames.of(cc) ?? cc).replace(/[ʻʼ’]/g, "'");
  } catch {
    return cc;
  }
}

/** "Samarkand, Samarqand viloyati, O'zbekiston"; baza yo'q yoki ZZ bo'lsa "joylashuv aniqlanmadi". */
export function describeGeo(geo: Geo | null | undefined): string {
  if (!geo || !geo.country || geo.country === 'ZZ') return 'joylashuv aniqlanmadi';
  const region = geo.country === 'UZ' ? REGION_LABELS[geo.region as RegionCode] : geo.regionName;
  const parts = [geo.city, region, countryName(geo.country)].filter((x): x is string => !!x);
  return esc([...new Set(parts)].join(', '));
}

const CHANNEL_WORD: Record<Channel, string> = { web: '🌐 Sayt', miniapp: '📱 Telegram Mini App', bot: '🤖 Telegram bot' };
const CHANNEL_PLAIN: Record<Channel, string> = { web: 'sayt', miniapp: 'Mini App', bot: 'bot' };

export interface RenderActor {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: Date | null;
  username?: string | null;
  orgs?: string[];
}
export interface RenderInput {
  events: ActivityEvent[];
  /** Oynaga jami tushgan hodisalar (events qirqilgan bo'lishi mumkin). */
  total: number;
  actor?: RenderActor | null;
  actorId?: string | null; // profil topilmasa ham havola uchun
  staff?: boolean;
  guestLabel?: string;
  system?: boolean;
  geo?: Geo | null;
  name?: (type: RefType, id: unknown) => string | undefined;
}

const MAX_LINES = 40;
const noName = () => undefined;

/** Bitta hodisa satri. Katalogda yo'q amal: "• amal", hech qanday meta chiqmaydi. */
export function renderLine(e: ActivityEvent, headerChannel: Channel, name: RenderInput['name'] = noName): string {
  const time = hhmmss(e.at);
  const c = CATALOG[e.action];
  if (!c) return `${time} • ${esc(clip(e.action, 60))}`;
  const m = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : {};
  const f = { m, e, ref: name };
  const emoji = typeof c.emoji === 'function' ? c.emoji(f) : c.emoji;
  const label = typeof c.label === 'function' ? c.label(f) : c.label;
  const facts = [...(c.facts?.(f) ?? []), (e.count ?? 1) > 1 ? `${e.count} ta` : false].filter(Boolean).join(', ');
  const path = c.href?.(f);
  const link = path ? ` · <a href="${attr(webUrl(path))}">ochish</a>` : '';
  const ch = e.channel && e.channel !== headerChannel ? ` (${CHANNEL_PLAIN[e.channel]})` : '';
  return `${time} ${emoji} ${label}${facts ? `: ${facts}` : ''}${ch}${link}`;
}

/** Bir oyna = bir odam = bir xabar. Matn har doim TG_MAX dan oshmaydi, teg o'rtasidan kesilmaydi. */
export function renderWindow(w: RenderInput): string {
  // Sarlavha: bot bo'lmagan hodisadan (bot IP va qurilmasiz), aks holda birinchisidan
  const lead = w.events.find((e) => e.channel !== 'bot') ?? w.events[0];
  const channel: Channel = lead?.channel ?? 'web';
  const a = w.actor;
  const icon = w.system ? '⚙️' : w.actorId ? (w.staff ? '🛡' : '👤') : channel === 'bot' ? '🤖' : '👀';
  const who = w.system
    ? 'Tizim'
    : w.actorId
      ? esc(clipCp(a?.fullName?.trim() || a?.phone || a?.email || 'Ismsiz foydalanuvchi', 80))
      : `Mehmon${w.guestLabel ? ` (${esc(clipCp(w.guestLabel, 40))})` : ''}`;
  const head: string[] = [`${icon} <b>${who}</b>${w.total > 1 ? ` · ${w.total} ta amal` : ''}`];

  if (w.actorId) {
    const person = [a?.phone ?? "telefon yo'q"];
    const orgs = (a?.orgs ?? []).slice(0, 2).map((o) => esc(clip(o, 40)));
    if (orgs.length) person.push(orgs.join(', '));
    if (a?.createdAt) person.push(`ro'yxatdan o'tgan ${ddmmyyyy(a.createdAt)}`);
    if (a?.username) person.push(`@${esc(a.username)}`);
    head.push(person.join(' · '));
  }
  if (!w.system) {
    const ua = w.events.find((e) => e.ua && e.channel !== 'bot')?.ua;
    head.push(channel === 'bot' ? CHANNEL_WORD.bot : `${CHANNEL_WORD[channel]} · ${deviceLine(ua)}`);
    if (channel !== 'bot') {
      const ip = w.events.find((e) => e.ip && e.channel !== 'bot')?.ip;
      head.push(ip ? `📍 ${describeGeo(w.geo)} · IP ${esc(ip)}` : '📍 joylashuv aniqlanmadi');
    }
  }

  let footer = '';
  if (w.actorId) {
    const id = encodeURIComponent(w.actorId);
    footer = `<a href="${attr(webUrl(`/admin/users/${id}`))}">Profil</a> · <a href="${attr(webUrl(`/admin/audit?actor=${id}`))}">Barcha amallari</a>`;
  } else if (w.events.some((e) => e.category === 'visit')) {
    footer = `<a href="${attr(webUrl('/admin/visits'))}">Tashriflar</a>`;
  }

  const lines = w.events.slice(0, MAX_LINES).map((e) => renderLine(e, channel, w.name));
  const build = (n: number) => {
    const dropped = w.total - n;
    const body = [...lines.slice(0, n), ...(dropped > 0 ? [`… va yana ${dropped} ta amal (to'liq ro'yxat audit jurnalida)`] : [])].join('\n');
    return [head.join('\n'), body, footer].filter(Boolean).join('\n\n');
  };
  let n = lines.length;
  while (n > 1 && build(n).length > TG_MAX) n--;
  return clip(build(n));
}

const CAT_WORD: Record<string, string> = { login: 'kirish', register: 'kirish', loginFailed: 'kirish', action: 'amal', visit: 'tashrif', admin: 'admin', system: 'tizim' };
/** Chegaradan oshgan hodisalar uchun bitta xulosa xabari. */
export function renderSummary(byCat: Record<string, number>): string {
  const sum: Record<string, number> = {};
  for (const [c, n] of Object.entries(byCat)) sum[CAT_WORD[c] ?? c] = (sum[CAT_WORD[c] ?? c] ?? 0) + n;
  const total = Object.values(sum).reduce((a, b) => a + b, 0);
  const parts = Object.entries(sum).map(([k, n]) => `${k} ${n}`).join(', ');
  return `⚠️ <b>Faoliyat xabarlari cheklandi</b>\nSo'nggi daqiqada yana ${total} ta hodisa alohida yuborilmadi: ${parts}.\nHammasi audit jurnalida: <a href="${attr(webUrl('/admin/audit'))}">ochish</a>`;
}
