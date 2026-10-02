// Kimning raqami kimga ochiladi. Soxta Prisma, baza yo'q.
//
// Nega alohida test: bu yerda ilgari teshik bor edi. Tanlangan so'rovning raqamini
// TANLANMAGAN ijrochi ham olaverardi, chunki shart faqat holatni tekshirardi. Shu
// sababli har bir qoida alohida qator bilan qotirib qo'yiladi.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HttpException } from '@nestjs/common';
import type { AuditService } from '../../common/audit.service';
import type { PlatformConfigService } from '../../common/platform-config.service';
import type { PrismaService } from '../../common/prisma.service';
import { planLimit, type SubscriptionService } from './subscription.service';
import type { ImpressionsService } from '../impressions/impressions.service';
import { ContactsController } from './contacts.controller';

type Where = Record<string, any>;

/** Soxta baza: so'rov va taklif qatorlari shartga mos kelsagina qaytadi. */
function setup(opts: {
  request?: { status: string; contactPhone: string | null; isDemo?: boolean; awardedTo?: string };
  offer?: { ownerId: string; providerUserId: string; providerPhone: string | null; isDemo?: boolean };
  subscriber?: boolean;
  /** Terminal tarmog'i: slug bilan ham, id bilan ham bitta qatorga tushadi. */
  terminal?: { id: string; phone: string | null };
  /** Mayoq va audit yozuvlari shu massivlarga tushadi. */
  calls?: Record<string, unknown>[];
  /** Audit jadvali: kvota shundan o'qiladi, ya'ni oldindan qator qo'yish mumkin. */
  auditRows?: Record<string, unknown>[];
  dailyLimit?: number;
  /** Tarifning o'z kunlik soni: berilsa umumiy sozlama emas, shu ishlaydi */
  planDaily?: number;
  /** Obunasiz odamga nechta raqam bepul. */
  free?: number;
  /** Audit yozuvi yiqilgan holat: kvota qatori yozilmasa raqam ham berilmaydi. */
  auditFails?: boolean;
  /** Mayoq yozuvi yiqilgan holat: sanoq o'lchov, u devorni ham, raqamni ham yiqitmaydi. */
  recordFails?: boolean;
  /** Umrbod sanoq so'ralganda bu massivga bitta element tushadi. */
  countProbe?: number[];
} = {}) {
  // Bitta massiv: soxta audit.log yozadi, soxta auditLog o'qiydi. Ikkita bo'lsa
  // deduplikatsiya testi yolg'ondan o'tib ketardi.
  const rows: Record<string, unknown>[] = opts.auditRows ?? [];
  const prisma = {
    marketRequest: {
      findFirst: async ({ where }: { where: Where }) => {
        const r = opts.request;
        if (!r) return null;
        // Kontroller ikki shartni AND ichida yuboradi: ikkinchisi holat va g'oliblik.
        // Tanlangan shoxning holati ro'yxat bilan keladi (AWARDED va DONE)
        const cond = where.AND[1].OR as Where[];
        const closed = cond.find((c) => c.offers);
        const states = (closed?.status?.in as string[] | undefined) ?? [];
        const who = closed?.offers?.some?.providerUserId as string | undefined;
        if (r.status === 'OPEN') return { contactPhone: r.contactPhone, isDemo: !!r.isDemo, status: 'OPEN' };
        if (states.includes(r.status) && who && who === r.awardedTo) {
          return { contactPhone: r.contactPhone, isDemo: !!r.isDemo, status: r.status };
        }
        return null;
      },
    },
    marketOffer: {
      findFirst: async ({ where }: { where: Where }) => {
        const o = opts.offer;
        if (!o || where.request.createdById !== o.ownerId) return null;
        return { providerUserId: o.providerUserId, providerOrgId: null, request: { isDemo: !!o.isDemo } };
      },
    },
    user: { findUnique: async () => ({ phone: opts.offer?.providerPhone ?? null }) },
    organization: { findUnique: async () => null },
    terminal: {
      findFirst: async () => (opts.terminal ? { id: opts.terminal.id, phone: opts.terminal.phone, contactPhone: null, isDemo: false } : null),
    },
    auditLog: {
      // Kunlik sanoq: shu odamning bugungi ochilishlari
      findMany: async ({ where }: { where: Where }) => rows.filter((r) =>
        r.actorId === where.actorId
        && (where.action.in as string[]).includes(r.action as string)
        && (r.createdAt as Date) >= (where.createdAt.gte as Date)),
      // Umrbod sanoq: faqat qidiruvda ochilgan raqamlar
      count: async ({ where }: { where: Where }) => {
        opts.countProbe?.push(1);
        return rows.filter((r) => r.actorId === where.actorId && r.action === where.action).length;
      },
    },
  } as unknown as PrismaService;
  const config = { get: async () => ({ phoneRevealFree: opts.free ?? 0 }) } as unknown as PlatformConfigService;
  const audit = {
    log: async (r: Record<string, unknown>) => {
      if (opts.auditFails) throw new Error('baza yiqildi');
      rows.push({ ...r, createdAt: new Date() });
    },
  } as unknown as AuditService;
  // active(), isActive() emas: kunlik chegara tarifning o'z qatoridan olinadi.
  // dailyLimit bu yerda sukut tarifning soni (zanjirning ikkinchi bo'g'ini), narx esa tarifdan
  const subs = {
    active: async () => (opts.subscriber ? { id: 's1', endsAt: new Date(), limits: opts.planDaily ? { phoneRevealDaily: opts.planDaily } : null } : null),
    dailyLimitFor: async (limits: unknown) => planLimit(limits, 'phoneRevealDaily', opts.dailyLimit ?? 50),
    priceFor: async () => 99_000,
  } as unknown as SubscriptionService;
  const impressions = {
    record: async (items: Record<string, unknown>[]) => {
      if (opts.recordFails) throw new Error('baza yiqildi');
      opts.calls?.push(...items);
    },
  } as unknown as ImpressionsService;
  return new ContactsController(prisma, config, audit, subs, impressions);
}

describe('raqam kimga ochiladi', () => {
  it("ochiq so'rov: obunachiga ochiq", async () => {
    const c = setup({ request: { status: 'OPEN', contactPhone: '+998901234567' }, subscriber: true });
    await expect(c.reveal('anyone', 'request', 'CR-1')).resolves.toMatchObject({ phone: '+998901234567' });
  });

  it("ochiq so'rov: obunasiz odamga yopiq", async () => {
    const c = setup({ request: { status: 'OPEN', contactPhone: '+998901234567' }, subscriber: false });
    await expect(c.reveal('anyone', 'request', 'CR-1')).rejects.toMatchObject({ status: 402 });
  });

  it("tanlangan so'rov: g'olibga ochiq, obunasiz ham", async () => {
    const c = setup({ request: { status: 'AWARDED', contactPhone: '+998901234567', awardedTo: 'winner' }, subscriber: false });
    await expect(c.reveal('winner', 'request', 'CR-1')).resolves.toMatchObject({ phone: '+998901234567' });
  });

  it("tanlangan so'rov: tanlanmagan ijrochiga YOPIQ (eski teshik)", async () => {
    const c = setup({ request: { status: 'AWARDED', contactPhone: '+998901234567', awardedTo: 'winner' }, subscriber: true });
    await expect(c.reveal('loser', 'request', 'CR-1')).rejects.toMatchObject({ status: 404 });
  });

  it("tanlangan taklif: so'rov egasiga ochiq, obunasiz ham", async () => {
    const c = setup({ offer: { ownerId: 'shipper', providerUserId: 'winner', providerPhone: '+998907654321' }, subscriber: false });
    await expect(c.reveal('shipper', 'offer', 'o1')).resolves.toMatchObject({ phone: '+998907654321' });
  });

  it("tanlangan taklif: begona odamga yopiq", async () => {
    const c = setup({ offer: { ownerId: 'shipper', providerUserId: 'winner', providerPhone: '+998907654321' }, subscriber: true });
    await expect(c.reveal('stranger', 'offer', 'o1')).rejects.toMatchObject({ status: 404 });
  });

  it("namuna qator hech kimga raqam bermaydi", async () => {
    const c = setup({ offer: { ownerId: 'shipper', providerUserId: 'winner', providerPhone: '+998907654321', isDemo: true } });
    await expect(c.reveal('shipper', 'offer', 'o1')).resolves.toMatchObject({ phone: null });
  });

  it("notanish tur rad etiladi", async () => {
    const c = setup();
    await expect(c.reveal('u1', 'wagon', 'x')).rejects.toMatchObject({ status: 400 });
  });
});

/**
 * Ochilishni server sanaydi. Ilgari son brauzerdan kelardi: uni kirishsiz yo'ldan
 * shishirish mumkin edi va u audit bilan zid ketardi.
 */
describe('telefon ochilishi qanday sanaladi', () => {
  it('slug bilan ochilsa ham mayoq va audit obyekt id si bilan tushadi', async () => {
    const calls: Record<string, unknown>[] = [];
    const auditRows: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, calls, auditRows });
    await c.reveal('u1', 'terminal', 'toshkent-1');
    expect(calls).toEqual([{ kind: 'terminal', targetId: 't1', surface: 'contact' }]);
    expect(auditRows[0]?.entityId).toBe('t1');
  });

  it('bir obyekt slug bilan ham, id bilan ham bitta ochilish', async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, calls });
    await c.reveal('u1', 'terminal', 'toshkent-1');
    await c.reveal('u1', 'terminal', 't1');
    expect(calls).toHaveLength(1);
  });

  it("Impression jadvali bilmagan tur uchun mayoq yozilmaydi", async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ request: { status: 'OPEN', contactPhone: '+998901234567' }, subscriber: true, calls });
    expect((await c.reveal('u9', 'request', 'CR-1')).phone).toBe('+998901234567');
    expect(calls).toHaveLength(0);
  });

  it("raqami yo'q obyektda na audit, na mayoq", async () => {
    const calls: Record<string, unknown>[] = [];
    const auditRows: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't2', phone: null }, subscriber: true, calls, auditRows });
    expect((await c.reveal('u1', 'terminal', 't2')).phone).toBe(null);
    expect(calls).toHaveLength(0);
    expect(auditRows).toHaveLength(0);
  });

  it('kvota tugagach qayta so\'rash ham raqam bermaydi', async () => {
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, dailyLimit: 0 });
    await expect(c.reveal('u1', 'terminal', 't1')).rejects.toMatchObject({ status: 429 });
    await expect(c.reveal('u1', 'terminal', 't1')).rejects.toMatchObject({ status: 429 });
  });
});

/** Tashlangan xatoning holati va tanasi bitta obyektda: tana xususiy maydonda turadi. */
async function refusal(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    const x = e as HttpException;
    return { status: x.getStatus(), ...(x.getResponse() as Record<string, unknown>) };
  }
  throw new Error('xato kutilgan edi');
}

/**
 * Bepul oyna: obunasiz odamga umrbod birinchi N ta raqam. Sukut N = 0, ya'ni
 * bugungi devor o'zgarmaydi va qo'shimcha so'rov ham bajarilmaydi.
 */
describe('bepul raqam oynasi', () => {
  it("oyna 0 bo'lsa umrbod sanoq umuman o'qilmaydi", async () => {
    const countProbe: number[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: false, countProbe });
    expect(await refusal(() => c.reveal('u1', 'terminal', 't1'))).toMatchObject({ status: 402, code: 'SUBSCRIPTION_REQUIRED' });
    expect(countProbe).toHaveLength(0);
  });

  it("oyna 2 bo'lsa ikkita raqam ochiladi, uchinchisida devor", async () => {
    const rows: Record<string, unknown>[] = [];
    const mk = (id: string) => setup({ terminal: { id, phone: '+998901234' + id }, subscriber: false, free: 2, auditRows: rows });
    expect((await mk('t1').reveal('u1', 'terminal', 't1')).phone).toBe('+998901234t1');
    expect((await mk('t2').reveal('u1', 'terminal', 't2')).phone).toBe('+998901234t2');
    expect(await refusal(() => mk('t3').reveal('u1', 'terminal', 't3'))).toMatchObject({ status: 402, freeTotal: 2 });
  });

  it('bitim raqami bepul oynani yemaydi', async () => {
    const rows: Record<string, unknown>[] = [];
    const deal = setup({ request: { status: 'AWARDED', contactPhone: '+998901234567', awardedTo: 'w' }, subscriber: false, free: 1, auditRows: rows });
    await deal.reveal('w', 'request', 'CR-1');
    expect(rows[0]?.action).toBe('contact.deal');
    // Oyna hamon butun: qidiruvda ochilgan raqam nol
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: false, free: 1, auditRows: rows });
    expect((await c.reveal('w', 'terminal', 't1')).phone).toBe('+998901234567');
  });
});

/**
 * Sanoq auditdan o'qiladi. Ilgari u xotira chelagida edi: har deployda nolga
 * qaytardi va chegara amalda ishlamasdi.
 */
describe('kunlik kvota auditdan', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('jarayon qayta ishga tushsa ham bugungi sanoq joyida qoladi', async () => {
    const now = new Date();
    const rows = Array.from({ length: 3 }, (_, i) => ({ actorId: 'u1', action: 'contact.reveal', entity: 'terminal', entityId: 'old' + i, createdAt: now }));
    // Yangi nusxa = qayta ishga tushgan jarayon
    const c = setup({ terminal: { id: 't9', phone: '+998901234567' }, subscriber: true, dailyLimit: 3, auditRows: rows });
    expect(await refusal(() => c.reveal('u1', 'terminal', 't9'))).toMatchObject({ status: 429, used: 3, limit: 3 });
  });

  it("tarifning o'z kunlik soni umumiy sozlamadan ustun", async () => {
    // Admin qimmatroq tarifga kuniga 3 ta yozgan, umumiy sozlama 1 ta. Chegara qatordan
    // olinmasa to'lagan odam o'ziga sotilgan sondan kam raqam ko'rardi.
    const now = new Date();
    const rows = Array.from({ length: 2 }, (_, i) => ({ actorId: 'u1', action: 'contact.reveal', entity: 'terminal', entityId: 'old' + i, createdAt: now }));
    const c = setup({ terminal: { id: 't9', phone: '+998901234567' }, subscriber: true, dailyLimit: 1, planDaily: 3, auditRows: rows });
    expect((await c.reveal('u1', 'terminal', 't9')).phone).toBe('+998901234567');
    // Yuqoridagi ochilish rows ga uchinchi qatorni qo'ydi: endi to'rtinchisi to'siladi
    const d = setup({ terminal: { id: 't8', phone: '+998901234567' }, subscriber: true, dailyLimit: 1, planDaily: 3, auditRows: rows });
    expect(await refusal(() => d.reveal('u1', 'terminal', 't8'))).toMatchObject({ status: 429, used: 3, limit: 3 });
  });

  it('bugun ochilgan obyekt yangi nusxada ham qayta sanalmaydi', async () => {
    const rows: Record<string, unknown>[] = [];
    const calls: Record<string, unknown>[] = [];
    const mk = () => setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, dailyLimit: 1, auditRows: rows, calls });
    await mk().reveal('u1', 'terminal', 'toshkent-1');
    // Chegara 1 ta, lekin ayni o'sha obyekt: kvota yeyilmaydi
    expect((await mk().reveal('u1', 'terminal', 't1')).phone).toBe('+998901234567');
    expect(rows).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('Toshkent yarim tuni: kechagi ochilish bugungi kvotaga sanalmaydi', async () => {
    vi.useFakeTimers();
    // Toshkent 00:30 = UTC 19:30 (oldingi kun)
    vi.setSystemTime(new Date('2026-09-23T19:30:00Z'));
    const rows = [
      { actorId: 'u1', action: 'contact.reveal', entity: 'terminal', entityId: 'a', createdAt: new Date('2026-09-23T18:30:00Z') }, // kecha 23:30
      { actorId: 'u1', action: 'contact.reveal', entity: 'terminal', entityId: 'b', createdAt: new Date('2026-09-23T19:10:00Z') }, // bugun 00:10
    ];
    // Bugungi sanoq 1 ta, ya'ni chegara 2 da yana bitta ochiladi
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, dailyLimit: 2, auditRows: rows });
    expect((await c.reveal('u1', 'terminal', 't1')).phone).toBe('+998901234567');
  });

  it('audit yiqilsa raqam berilmaydi', async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, auditFails: true, calls });
    expect(await refusal(() => c.reveal('u1', 'terminal', 't1'))).toMatchObject({ status: 503, code: 'RETRY' });
    expect(calls).toHaveLength(0);
  });
});

/**
 * To'lov devorining sanog'i: konversiyaning MAXRAJI.
 *
 * Nega kerak: ega obuna sonini ko'radi, lekin nechta odam devorga urilib ketganini
 * ko'rmaydi. Shu maxraj bo'lmasa narx, bepul oyna va devor joyi haqidagi uchala qaror
 * ham tusmol bilan qilinadi.
 *
 * Qator FAQAT shu yerda, serverda yoziladi: ommaviy mayoq yo'lida 'wall' yo'q va u
 * yerdan kelgan son bir so'rovda shishirilib qo'yilardi.
 */
describe("telefon devorining sanog'i", () => {
  it('402 tashlanganda bitta qator yoziladi', async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: false, calls });
    expect(await refusal(() => c.reveal('u-wall-1', 'terminal', 't1'))).toMatchObject({ status: 402 });
    expect(calls).toEqual([{ kind: 'wall', targetId: 'phone', surface: 'view' }]);
  });

  it("raqam ochilganda devor sanog'i yozilmaydi", async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: true, calls });
    await c.reveal('u-wall-2', 'terminal', 't1');
    // Faqat 'contact': devor umuman qo'yilmadi
    expect(calls).toEqual([{ kind: 'terminal', targetId: 't1', surface: 'contact' }]);
  });

  it('sanoq yiqilsa 402 baribir tashlanadi', async () => {
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: false, recordFails: true });
    expect(await refusal(() => c.reveal('u-wall-3', 'terminal', 't1'))).toMatchObject({ status: 402, code: 'SUBSCRIPTION_REQUIRED' });
  });

  /*
   * Son URINISHNI emas, ODAMNI sanaydi: bu yo'lda devordan oldin hech qanday chegara
   * yo'q (kunlik chegara devordan keyin tekshiriladi), ya'ni sahifani besh marta
   * yangilagan odam maxrajni besh barobar shishirib qo'yardi, obuna soni esa haqiqiy
   * odamlar bo'yicha qolardi.
   */
  it("bir odam kuniga bir marta: qayta bosilganda qator qo'shilmaydi", async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ terminal: { id: 't1', phone: '+998901234567' }, subscriber: false, calls });
    await refusal(() => c.reveal('u-wall-4', 'terminal', 't1'));
    await refusal(() => c.reveal('u-wall-4', 'terminal', 't1'));
    expect(calls).toHaveLength(1);
  });

  it("bitim raqamida devor ham, sanoq ham yo'q", async () => {
    const calls: Record<string, unknown>[] = [];
    const c = setup({ request: { status: 'AWARDED', contactPhone: '+998901234567', awardedTo: 'w' }, subscriber: false, calls });
    expect((await c.reveal('w', 'request', 'CR-1')).phone).toBe('+998901234567');
    expect(calls).toHaveLength(0);
  });
});
