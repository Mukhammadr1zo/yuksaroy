// Kimning raqami kimga ochiladi. Soxta Prisma, baza yo'q.
//
// Nega alohida test: bu yerda ilgari teshik bor edi. Tanlangan so'rovning raqamini
// TANLANMAGAN ijrochi ham olaverardi, chunki shart faqat holatni tekshirardi. Shu
// sababli har bir qoida alohida qator bilan qotirib qo'yiladi.
import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PlatformConfigService } from '../../common/platform-config.service';
import type { PrismaService } from '../../common/prisma.service';
import type { SubscriptionService } from './subscription.service';
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
  auditRows?: Record<string, unknown>[];
  dailyLimit?: number;
} = {}) {
  const prisma = {
    marketRequest: {
      findFirst: async ({ where }: { where: Where }) => {
        const r = opts.request;
        if (!r) return null;
        // Kontroller ikki shartni AND ichida yuboradi: ikkinchisi holat va g'oliblik
        const cond = where.AND[1].OR as Where[];
        const wantsAwarded = cond.find((c) => c.status === 'AWARDED');
        const who = wantsAwarded?.offers?.some?.providerUserId as string | undefined;
        if (r.status === 'OPEN') return { contactPhone: r.contactPhone, isDemo: !!r.isDemo, status: 'OPEN' };
        if (r.status === 'AWARDED' && who && who === r.awardedTo) {
          return { contactPhone: r.contactPhone, isDemo: !!r.isDemo, status: 'AWARDED' };
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
  } as unknown as PrismaService;
  const config = { get: async () => ({ phoneRevealDaily: opts.dailyLimit ?? 50 }) } as unknown as PlatformConfigService;
  const audit = { log: async (r: Record<string, unknown>) => { opts.auditRows?.push(r); } } as unknown as AuditService;
  const subs = { isActive: async () => opts.subscriber ?? false } as unknown as SubscriptionService;
  const impressions = { record: async (items: Record<string, unknown>[]) => { opts.calls?.push(...items); } } as unknown as ImpressionsService;
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
