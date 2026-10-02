// E'longa baho: o'ziga o'zi baho qo'yish qorovuli. Soxta prisma, baza yo'q.
//
// Tashkilot e'lonida ownerUserId doim bo'sh, shuning uchun eski `ownerUserId === userId`
// sharti tashkilotga ishlamasdi: xodim kollegasi bilan yozishib, o'z e'loniga besh ball
// qo'yib, o'rtacha bahoni ko'tara olardi. Qorovul tirilgani shu yerda qulflanadi.
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { ListingReviewsService } from './listing-reviews.service';

type Listing = { orgId: string | null; ownerUserId: string | null };

/**
 * members: qaysi odam qaysi tashkilotda. membershipCalls - a'zolik so'rovi sanog'i:
 * yakka egali e'londa bitta ham bekor so'rov ketmasligini shu son isbotlaydi.
 */
function setup(l: Listing, members: Record<string, string[]> = {}) {
  const state = { membershipCalls: 0, created: 0, ratingAvg: 0, ratingCount: 0 };
  const prisma = {
    listing: {
      findUnique: async () => ({ id: 'l1', title: 'Kran 25 t', slug: 'kran-25-t', kind: 'EQUIPMENT', ratingAvg: null, ratingCount: 0, ...l }),
      update: async (a: { data: { ratingAvg: number; ratingCount: number } }) => { state.ratingAvg = a.data.ratingAvg; state.ratingCount = a.data.ratingCount; return {}; },
    },
    membership: {
      findUnique: async (a: { where: { userId_orgId: { userId: string; orgId: string } } }) => {
        state.membershipCalls += 1;
        const { userId, orgId } = a.where.userId_orgId;
        return (members[userId] ?? []).includes(orgId) ? { id: 'm1' } : null;
      },
    },
    // Ikki tomonli yozishma bor deb olamiz: tekshirilayotgani NO_CONTACT emas, SELF_REVIEW
    inquiry: { findMany: async () => [{ id: 'i1' }] },
    inquiryMessage: { findFirst: async () => ({ id: 'im1' }) },
    listingReview: {
      findUnique: async () => null,
      create: async () => { state.created += 1; return { id: 'r1', rating: 5, text: null, createdAt: new Date() }; },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  } as unknown as PrismaService;
  // Oluvchi yo'q: notifyBoth darhol qaytadi, Telegram ham, baza ham chaqirilmaydi
  const notifications = { recipients: async () => [] } as unknown as NotificationsService;
  return { svc: new ListingReviewsService(prisma, notifications), state };
}

/** Rad etilgan bo'lsa kodini qaytaradi, o'tgan bo'lsa null: market.controller.spec dagi naqsh. */
const code = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (x: unknown) => x);
  if (e === null) return null;
  expect(e).toBeInstanceOf(ForbiddenException);
  return (e as ForbiddenException).getResponse() as { code: string };
};

describe("e'longa baho: o'ziga o'zi baho qo'yish", () => {
  it("tashkilot a'zosi o'z tashkiloti e'loniga baho yozolmaydi", async () => {
    const { svc, state } = setup({ orgId: 'o1', ownerUserId: null }, { xodim: ['o1'] });
    expect(await code(svc.create('xodim', 'l1', 5, 'zo\'r'))).toMatchObject({ code: 'SELF_REVIEW' });
    expect(state.created).toBe(0);
    expect(state.ratingCount).toBe(0);
  });

  it("begona odam o'sha tashkilot e'loniga baho yozaveradi", async () => {
    const { svc, state } = setup({ orgId: 'o1', ownerUserId: null }, { xodim: ['o1'], begona: ['o2'] });
    expect(await code(svc.create('begona', 'l1', 5, 'yaxshi'))).toBe(null);
    expect(state.created).toBe(1);
    expect(state.ratingCount).toBe(1);
  });

  it("ownerUserId bor eski e'londa eski shart hamon ishlaydi", async () => {
    const { svc } = setup({ orgId: null, ownerUserId: 'egasi' });
    expect(await code(svc.create('egasi', 'l1', 5, null))).toMatchObject({ code: 'SELF_REVIEW' });
  });

  it("yakka egali e'londa a'zolik so'rovi umuman ketmaydi", async () => {
    const { svc, state } = setup({ orgId: null, ownerUserId: 'egasi' });
    expect(await code(svc.create('mijoz', 'l1', 4, null))).toBe(null);
    expect(state.membershipCalls).toBe(0);
  });
});

/**
 * Forma ham chizilmaydi. Nega alohida: qorovul faqat create() da bo'lsa ekranda besh
 * yulduzli forma ochilib turadi va odam yuborganda sababsiz "failed" oladi - ya'ni
 * qorovul bor, lekin foydalanuvchi uchun bu shunchaki buzilgan ekran.
 */
describe("e'longa baho: forma ko'rsatilishi", () => {
  it("tashkilot a'zosiga forma chizilmaydi", async () => {
    const { svc } = setup({ orgId: 'o1', ownerUserId: null }, { xodim: ['o1'] });
    expect(await svc.eligibility('xodim', 'l1')).toEqual({ canReview: false, already: null });
  });

  it("begona odamga forma chiziladi", async () => {
    const { svc } = setup({ orgId: 'o1', ownerUserId: null }, { xodim: ['o1'] });
    expect(await svc.eligibility('begona', 'l1')).toEqual({ canReview: true, already: null });
  });

  it("yakka egali e'londa bu yerda ham bekor so'rov yo'q", async () => {
    const { svc, state } = setup({ orgId: null, ownerUserId: 'egasi' });
    expect(await svc.eligibility('egasi', 'l1')).toEqual({ canReview: false, already: null });
    expect(state.membershipCalls).toBe(0);
  });
});
