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
import { ContactsController } from './contacts.controller';

type Where = Record<string, any>;

/** Soxta baza: so'rov va taklif qatorlari shartga mos kelsagina qaytadi. */
function setup(opts: {
  request?: { status: string; contactPhone: string | null; isDemo?: boolean; awardedTo?: string };
  offer?: { ownerId: string; providerUserId: string; providerPhone: string | null; isDemo?: boolean };
  subscriber?: boolean;
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
  } as unknown as PrismaService;
  const config = { get: async () => ({ phoneRevealDaily: 50 }) } as unknown as PlatformConfigService;
  const audit = { log: async () => {} } as unknown as AuditService;
  const subs = { isActive: async () => opts.subscriber ?? false } as unknown as SubscriptionService;
  return new ContactsController(prisma, config, audit, subs);
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
