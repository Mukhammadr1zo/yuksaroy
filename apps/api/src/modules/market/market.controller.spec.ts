// Bozor va xizmat profillari: har holat yozuvi o'qilgan holatga shartlanganini soxta Prisma bilan tekshiradi.
// Baza kerak emas: soxta ombor where.status shartini haqiqiy bazadek qo'llaydi, mos kelmasa count 0 yoki P2025.
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AdminMarketController } from './admin-market.controller';
import { MarketController } from './market.controller';
import { ServicesController } from './services.controller';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { MarketService } from './market.service';
import type { TokenService } from '../identity/application/token.service';
import type { SessionStore, UserRepository } from '../identity/domain/ports';

type Req = Record<string, unknown> & { id: string; no: string; status: string; createdById: string; awardedOfferId: string | null };
type Off = { id: string; requestId: string; providerUserId: string; providerOrgId: string | null; status: string; priceTiyin: bigint | null; message: string | null; createdAt: Date };
type Prof = { id: string; userId: string; serviceType: string; status: string };
type Any = Record<string, any>;
// Soxta ombor PrismaService o'rniga beriladi: faqat ishlatiladigan metodlar bor
const prisma = (p: Any) => p as unknown as PrismaService;

const known = (code: string) => new Prisma.PrismaClientKnownRequestError('soxta', { code, clientVersion: 'test' });
const now = new Date('2026-09-21T10:00:00Z');
const request = (over: Partial<Req> = {}): Req => ({
  id: 'r1', no: 'CR-1001', board: 'CARGO', status: 'OPEN', createdById: 'owner', awardedOfferId: null, contactPhone: '+998901234567', statusToken: 'tok',
  isDemo: false, serviceType: null, title: 'Sement', createdAt: now, updatedAt: now, ...over,
});
const offer = (id: string, providerUserId: string, status = 'SENT'): Off => ({ id, requestId: 'r1', providerUserId, providerOrgId: null, status, priceTiyin: null, message: null, createdAt: now });

/** Soxta Prisma: faqat kontrollerlar ishlatadigan chaqiruvlar. */
function db(reqs: Req[], offers: Off[], profiles: Prof[] = []) {
  const withOffers = (r: Req) => ({ ...r, offers: offers.filter((o) => o.requestId === r.id) });
  const reqRows = (w: Any) => reqs.filter((r) => (w.id == null || r.id === w.id) && (w.status == null || r.status === w.status));
  const offRows = (w: Any) => offers.filter((o) => (w.id == null || o.id === w.id) && (w.requestId == null || o.requestId === w.requestId) && (w.status == null || o.status === w.status));
  const profRow = (p: Prof) => ({ ...p, title: 't', description: 'd', regions: [], experienceYears: null, priceNote: null, contactPhone: null, isDemo: false, orgId: null, createdAt: now, updatedAt: now, user: { fullName: 'Ali' }, org: null });
  const p: Any = {
    marketRequest: {
      findUnique: async ({ where }: Any) => { const r = reqs.find((x) => (where.id ? x.id === where.id : x.no === where.no)); return r ? withOffers(r) : null; },
      findUniqueOrThrow: async ({ where }: Any) => withOffers(reqs.find((x) => x.id === where.id)!),
      updateMany: async ({ where, data }: Any) => { const rows = reqRows(where); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
      // Taklif so'rov orqali yaratiladi: where.status mos kelmasa haqiqiy Prisma P2025 beradi
      update: async ({ where, data }: Any) => {
        const [r] = reqRows(where);
        if (!r) throw known('P2025');
        const c = data.offers?.create;
        if (c) {
          if (offers.some((o) => o.requestId === r.id && o.providerUserId === c.providerUserId)) throw known('P2002');
          offers.push({ id: `o${offers.length + 1}`, requestId: r.id, status: 'SENT', createdAt: now, ...c });
        }
        return { offers: offers.filter((o) => o.requestId === r.id && o.providerUserId === c?.providerUserId) };
      },
    },
    marketOffer: {
      updateMany: async ({ where, data }: Any) => { const rows = offRows(where); rows.forEach((o) => Object.assign(o, data)); return { count: rows.length }; },
    },
    serviceProfile: {
      findUnique: async ({ where }: Any) => profiles.find((x) => x.id === where.id) ?? null,
      create: async ({ data }: Any) => {
        if (profiles.some((x) => x.userId === data.userId && x.serviceType === data.serviceType)) throw known('P2002');
        const row = { id: `p${profiles.length + 1}`, userId: data.userId, serviceType: data.serviceType, status: 'ACTIVE' };
        profiles.push(row);
        return profRow(row);
      },
      update: async ({ where, data }: Any) => {
        const row = profiles.find((x) => x.id === where.id && (!where.status?.in || where.status.in.includes(x.status)));
        if (!row) throw known('P2025');
        Object.assign(row, data);
        return profRow(row);
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(p),
  };
  return p;
}

const audit = { log: async () => {} } as unknown as AuditService;
const market = { orgsOf: async () => new Map(), namesOf: async () => new Map(), memberOrgId: async () => null, activeServiceTypes: async () => [], notifyAward: async () => {}, notifyOffer: async () => {}, notifyNew: async () => {}, postChannel: async () => {} } as unknown as MarketService;
// Token = sessiya nomi: "live" tirik, "revoked" bekor qilingan, boshqasi noto'g'ri imzo
const tokens = { verifyAccess: (t: string) => { if (t === 'live' || t === 'revoked') return { sub: 'owner', sid: t }; throw new Error('TOKEN_INVALID'); } } as unknown as TokenService;
const users = { findById: async (id: string) => ({ id, isActive: true }) } as unknown as UserRepository;
const sessions = { findById: async (sid: string) => ({ revokedAt: sid === 'revoked' ? now : null }) } as unknown as SessionStore;
const ctl = (p: Any) => new MarketController(prisma(p), audit, market, tokens, users, sessions);
const conflict = async (fn: Promise<unknown>, code: string) => {
  const e = await fn.catch((x) => x);
  expect(e).toBeInstanceOf(ConflictException);
  expect((e as ConflictException).getResponse()).toMatchObject({ code });
};

describe('taklif tanlash poygasi', () => {
  it("ikkinchi tanlash o'qilgan holat eskirgani uchun rad etiladi, birinchi g'olib o'zgarmaydi", async () => {
    const reqs = [request()];
    const offers = [offer('o1', 'p1'), offer('o2', 'p2')];
    const p = db(reqs, offers);
    const c = ctl(p);
    await c.award('owner', 'r1', { offerId: 'o1' });
    expect(reqs[0]).toMatchObject({ status: 'AWARDED', awardedOfferId: 'o1' });
    expect(offers.map((o) => o.status)).toEqual(['AWARDED', 'DECLINED']);

    // Ikkinchi handler ham OPEN deb o'qigan edi (parallel so'rov): yozuv shartga urilib qaytadi
    p.marketRequest.findUnique = async () => ({ ...reqs[0], status: 'OPEN', offers: [offer('o1', 'p1'), offer('o2', 'p2')] });
    await conflict(c.award('owner', 'r1', { offerId: 'o2' }), 'MARKET_TRANSITION');
    expect(reqs[0]).toMatchObject({ status: 'AWARDED', awardedOfferId: 'o1' });
    expect(offers.map((o) => o.status)).toEqual(['AWARDED', 'DECLINED']);
  });

  it("o'qishdan keyin kelgan taklif ham rad etiladi (shart bo'yicha, ro'yxat bo'yicha emas)", async () => {
    const reqs = [request()];
    const offers = [offer('o1', 'p1')];
    const p = db(reqs, offers);
    const base = p.marketRequest.findUnique;
    p.marketRequest.findUnique = async (a: Any) => { const r = await base(a); offers.push(offer('o3', 'p3')); return r; };
    await ctl(p).award('owner', 'r1', { offerId: 'o1' });
    expect(offers.map((o) => [o.id, o.status])).toEqual([['o1', 'AWARDED'], ['o3', 'DECLINED']]);
  });

  it("bekor qilish tanlashdan keyin o'tmaydi: AWARDED -> CANCELLED yo'q", async () => {
    const reqs = [request({ status: 'AWARDED', awardedOfferId: 'o1' })];
    const p = db(reqs, [offer('o1', 'p1', 'AWARDED')]);
    p.marketRequest.findUnique = async () => ({ ...reqs[0], status: 'OPEN', offers: [] });
    await conflict(ctl(p).cancel('owner', 'r1'), 'MARKET_TRANSITION');
    expect(reqs[0]!.status).toBe('AWARDED');
  });
});

describe('taklif yuborish', () => {
  it("OPEN so'rovga yoziladi, tanlanganiga (eskirgan o'qish bilan ham) yozilmaydi", async () => {
    const reqs = [request()];
    const offers: Off[] = [];
    const p = db(reqs, offers);
    const c = ctl(p);
    const o = await c.offer('p1', 'r1', { priceTiyin: 1000 });
    expect(o).toMatchObject({ status: 'SENT', providerUserId: 'p1', priceTiyin: 1000 });
    await conflict(c.offer('p1', 'r1', {}), 'OFFER_EXISTS');

    reqs[0]!.status = 'AWARDED';
    p.marketRequest.findUnique = async () => ({ ...reqs[0], status: 'OPEN', offers: [] });
    await conflict(c.offer('p2', 'r1', {}), 'REQUEST_NOT_OPEN');
    expect(offers).toHaveLength(1);
  });
});

describe("egasining ko'rinishi", () => {
  const req = (token: string | null) => ({ headers: token ? { authorization: `Bearer ${token}` } : {}, cookies: {} }) as any;

  it('tirik sessiya telefon va takliflarni oladi, bekor qilingan sessiya ochiq ko\'rinishni oladi', async () => {
    const c = ctl(db([request()], [offer('o1', 'p1')]));
    const owner = await c.one(req('live'), 'CR-1001');
    expect(owner).toMatchObject({ contactPhone: '+998901234567', offers: [{ id: 'o1' }] });
    const revoked = await c.one(req('revoked'), 'CR-1001');
    expect(revoked).not.toHaveProperty('contactPhone');
    expect(revoked).not.toHaveProperty('offers');
    expect(revoked).toMatchObject({ hasPhone: true, offersCount: 1 });
    const guest = await c.one(req(null), 'CR-1001');
    expect(guest).not.toHaveProperty('contactPhone');
  });
});

describe('admin yashirish', () => {
  it("faqat OPEN so'rov bekor qilinadi; tanlangan so'rov holat jadvaliga ko'ra qoladi", async () => {
    const reqs = [request(), request({ id: 'r2', no: 'CR-1002', status: 'AWARDED', awardedOfferId: 'o9' })];
    const a = new AdminMarketController(prisma(db(reqs, [])), audit);
    await expect(a.hideRequest('admin', 'r1')).resolves.toEqual({ ok: true });
    expect(reqs[0]!.status).toBe('CANCELLED');
    await conflict(a.hideRequest('admin', 'r2'), 'MARKET_TRANSITION');
    expect(reqs[1]).toMatchObject({ status: 'AWARDED', awardedOfferId: 'o9' });
  });

  it('profil BLOCKED bo\'ladi va egasi uni qayta ocha olmaydi, tahrirlay olmaydi', async () => {
    const profiles: Prof[] = [{ id: 'p1', userId: 'u1', serviceType: 'DOCS', status: 'ACTIVE' }];
    const p = db([], [], profiles);
    await new AdminMarketController(prisma(p), audit).hideProfile('admin', 'p1');
    expect(profiles[0]!.status).toBe('BLOCKED');
    const s = new ServicesController(prisma(p), audit, market);
    await conflict(s.patch('u1', 'p1', { status: 'ACTIVE' }), 'PROFILE_BLOCKED');
    await conflict(s.patch('u1', 'p1', { title: 'yangi' }), 'PROFILE_BLOCKED');
    await conflict(s.hide('u1', 'p1'), 'PROFILE_BLOCKED');
    expect(profiles[0]!.status).toBe('BLOCKED');
    // O'zi yashirgan profilni o'zi ochadi
    profiles[0]!.status = 'HIDDEN';
    await expect(s.patch('u1', 'p1', { status: 'ACTIVE' })).resolves.toMatchObject({ status: 'ACTIVE' });
  });
});

describe('bir turda bitta profil', () => {
  it('ikkinchi yaratish bazadagi noyoblikdan PROFILE_EXISTS bilan qaytadi', async () => {
    const s = new ServicesController(prisma(db([], [], [])), audit, market);
    const dto = { serviceType: 'DOCS' as const, title: 'Hujjat', description: 'Eksport hujjatlari', regions: [] };
    await expect(s.create('u1', dto)).resolves.toMatchObject({ serviceType: 'DOCS', status: 'ACTIVE' });
    await conflict(s.create('u1', dto), 'PROFILE_EXISTS');
  });
});

/**
 * Ish yakuni. CLOSED bilan ikki xil: CLOSED "boshqa taklif kerak emas" (ish bo'lmasa ham
 * bosiladi), DONE esa ijrochining hisobiga yoziladigan yagona belgi, shuning uchun
 * undan chiqish yo'li yo'q.
 */
describe('ish yakuni', () => {
  it("tanlangan so'rov bajarilgan bo'ladi va DONE dan chiqib bo'lmaydi", async () => {
    const reqs = [request({ status: 'AWARDED', awardedOfferId: 'o1' })];
    const c = ctl(db(reqs, [offer('o1', 'p1', 'AWARDED')]));
    await c.done('owner', 'r1');
    expect(reqs[0]!.status).toBe('DONE');
    // Ikkinchi bosish ham, keyin yopish ham o'tmaydi: holat jadvali yakuniy
    await conflict(c.done('owner', 'r1'), 'MARKET_TRANSITION');
    await conflict(c.close('owner', 'r1'), 'MARKET_TRANSITION');
    expect(reqs[0]!.status).toBe('DONE');
  });

  it("ochiq so'rovni bajarilgan deb belgilab bo'lmaydi", async () => {
    const reqs = [request()];
    await conflict(ctl(db(reqs, [])).done('owner', 'r1'), 'MARKET_TRANSITION');
    expect(reqs[0]!.status).toBe('OPEN');
  });

  it("orada holat o'zgargan bo'lsa eskirgan o'qish bilan ham o'tmaydi", async () => {
    const reqs = [request({ status: 'CLOSED', awardedOfferId: 'o1' })];
    const p = db(reqs, [offer('o1', 'p1', 'AWARDED')]);
    // Boshqa oynada allaqachon yopilgan, bu handler esa AWARDED deb o'qigan edi
    p.marketRequest.findUnique = async () => ({ ...reqs[0], status: 'AWARDED', offers: [] });
    await conflict(ctl(p).done('owner', 'r1'), 'MARKET_TRANSITION');
    expect(reqs[0]!.status).toBe('CLOSED');
  });
});
