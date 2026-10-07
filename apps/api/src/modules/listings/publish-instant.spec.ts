// E'lon yuborilganda tekshiruvga tushadimi yoki darhol faol bo'ladimi. Soxta repo, baza yo'q.
//
// Bugungacha publish() ni birorta test tekshirmasdi, shu sababli eski yo'l (tasdiqlangan
// tashkilot darhol ACTIVE) uchun ham qo'riqchi shu yerda: yakka haydovchi uchun ochilgan
// yangi yo'l uni buzib qo'ymasin.
import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AdminNotify } from '../organizations/application/admin-notify';
import type { SubscriptionService } from '../subscription/subscription.service';
import type { ListingRecord } from './domain/listing-query';
import { PrismaListingRepository } from './infrastructure/prisma-listing.repository';
import type { ListingAccess } from './application/listing-access';
import { ListingsUseCase } from './application/listings.usecase';

type Status = { status: string; publishedAt?: Date; expiresAt?: Date; expiryRemindedAt?: null; rejectReason: string | null };

const listing = (over: Partial<ListingRecord> = {}): ListingRecord => ({
  id: 'l1', slug: 'l1', orgId: null, ownerUserId: 'driver', createdById: 'driver', kind: 'TRUCK', deal: null, status: 'DRAFT',
  title: 'Isuzu 5 t', description: 'Toshkent bo\'ylab', regionCode: 'UZ-TK', terminalId: null,
  lat: null, lng: null, priceTiyin: null, priceUnit: null, photos: [],
  year: null, condition: null, model: null, qty: 1, wagonType: null, capacityT: null,
  truckType: 'TENT', tonnage: 5, fleetSize: null, serviceRegions: [], routes: [],
  contactPhone: null,
  premiumUntil: null, publishedAt: null, expiresAt: null, rejectReason: null, views: 0,
  createdAt: new Date(), updatedAt: new Date(),
  org: null, ownerUser: { fullName: 'Akmal', phone: '+998901234567' }, terminal: null,
  ...over,
}) as ListingRecord;

function setup(l: ListingRecord, activeCount = 0, kyc: string | null = null, changed = false) {
  const saved: Status[] = [];
  const counts: Record<string, unknown>[] = [];
  const repo = {
    findById: async () => l,
    // changed: qator o'qilgandan keyin o'zgargan, repo sharti yozuvni P2025 bilan to'xtatadi
    setStatus: async (_was: unknown, d: Status) => {
      if (changed) throw new Prisma.PrismaClientKnownRequestError('soxta', { code: 'P2025', clientVersion: 'test' });
      saved.push(d); return { ...l, ...d };
    },
  } as unknown as PrismaListingRepository;
  const access = {
    membership: async () => (kyc ? { org: { kycStatus: kyc } } : null),
    assertLister: async () => {},
  } as unknown as ListingAccess;
  const prisma = {
    listing: { count: async (a: { where: Record<string, unknown> }) => { counts.push(a.where); return activeCount; } },
    // Kuzatuv yo'li activate() ichida void bilan chaqiriladi: xato yutilardi va
    // haqiqiy xatoni ham yashirardi, shuning uchun soxtasi to'liq
    watch: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  } as unknown as PrismaService;
  // Kuzatuvchilar xabari egalar ro'yxatidan boshlanadi: bu chaqirilmasa xabar ham ketmagan
  const asked: unknown[] = [];
  const notifications = { recipients: async (w: unknown) => { asked.push(w); return []; } } as unknown as NotificationsService;
  const subs = { raiseListing: async () => {} } as unknown as SubscriptionService;
  const adminNotify = { queued: async () => {} } as unknown as AdminNotify;
  const svc = new ListingsUseCase(repo, access, prisma, notifications, subs, adminNotify);
  return { svc, saved, counts, asked };
}

describe("e'lon yuborilganda", () => {
  it('telefoni tasdiqlangan haydovchi darhol faol', async () => {
    const { svc, saved } = setup(listing(), 2);
    await svc.publish('driver', 'l1');
    expect(saved[0].status).toBe('ACTIVE');
    expect(saved[0].publishedAt).toBeInstanceOf(Date);
    expect(saved[0].expiresAt).toBeInstanceOf(Date);
  });

  it("uchtadan ko'p faol e'lon bo'lsa tekshiruvga tushadi", async () => {
    const { svc, saved } = setup(listing(), 3);
    await svc.publish('driver', 'l1');
    expect(saved[0].status).toBe('PENDING_REVIEW');
  });

  it('telefoni tasdiqlanmagan odam tekshiruvga tushadi', async () => {
    const { svc, saved } = setup(listing({ ownerUser: { fullName: 'Akmal', phone: null } }), 0);
    await svc.publish('driver', 'l1');
    expect(saved[0].status).toBe('PENDING_REVIEW');
  });

  it('rad etilgan e\'lon qayta yuborilsa tekshiruvga tushadi', async () => {
    const { svc, saved } = setup(listing({ status: 'REJECTED', rejectReason: 'rasm yo\'q' }), 0);
    await svc.publish('driver', 'l1');
    expect(saved[0].status).toBe('PENDING_REVIEW');
  });

  // Admin faol e'lonni tortib olganda ARCHIVED yozadi va sababni o'sha qatorga qo'yadi:
  // faqat REJECTED ni tekshirish admin qarorini chetlab o'tish yo'lini ochiq qoldirardi
  it('admin sabab bilan tortib olgan e\'lon ham tekshiruvga tushadi', async () => {
    const { svc, saved } = setup(listing({ status: 'ARCHIVED', rejectReason: 'telefon javob bermaydi' }), 0);
    await svc.publish('driver', 'l1');
    expect(saved[0].status).toBe('PENDING_REVIEW');
  });

  it('tasdiqlangan tashkilot e\'loni darhol faol (eski yo\'l)', async () => {
    const { svc, saved } = setup(listing({ orgId: 'o1', ownerUserId: null, kind: 'WAGON', ownerUser: null }), 0, 'VERIFIED');
    await svc.publish('boss', 'l1');
    expect(saved[0].status).toBe('ACTIVE');
  });

  it('tasdiqlanmagan tashkilot e\'loni tekshiruvga tushadi', async () => {
    const { svc, saved } = setup(listing({ orgId: 'o1', ownerUserId: null, kind: 'WAGON', ownerUser: null }), 0, 'PENDING');
    await svc.publish('boss', 'l1');
    expect(saved[0].status).toBe('PENDING_REVIEW');
  });

  // Belgi bitta muddatniki: tozalanmasa qayta chiqqan e'lon keyingi muddatda eslatma olmasdi
  it('qayta chiqqan e\'londa muddat eslatmasi belgisi tozalanadi', async () => {
    const { svc, saved, asked } = setup(listing({ status: 'EXPIRED' }), 0);
    await svc.publish('driver', 'l1');
    expect(saved[0]).toMatchObject({ status: 'ACTIVE', expiryRemindedAt: null });
    // Katalogga qaytgan e'lon kuzatuvchilarga boradi (uzaytirishdan farqi shu)
    expect(asked).toHaveLength(1);
  });

  it('muddati o\'tgan faol e\'lonlar chegaraga kirmaydi', async () => {
    const { svc, counts } = setup(listing(), 0);
    await svc.publish('driver', 'l1');
    expect(counts[0]).toMatchObject({ ownerUserId: 'driver', status: 'ACTIVE' });
    expect(counts[0].OR).toBeDefined();
  });
});

// 2026-10-07 egasi qarori: faol e'lon oxirgi 7 kunida "Qayta yuborish" bilan uzaytiriladi
describe("faol e'lonni uzaytirish", () => {
  const DAY = 86_400_000;
  const live = (daysLeft: number, over: Partial<ListingRecord> = {}) =>
    listing({ status: 'ACTIVE', publishedAt: new Date(Date.now() - 85 * DAY), expiresAt: new Date(Date.now() + daysLeft * DAY), ...over });

  it('oxirgi 7 kunda: yana 90 kun, katalog boshiga, eslatma belgisi tozalanadi', async () => {
    const { svc, saved, asked } = setup(live(2));
    const before = Date.now();
    await svc.publish('driver', 'l1');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: 'ACTIVE', expiryRemindedAt: null, rejectReason: null });
    // publishedAt katalog tartibi: qayta yuborilgandek boshga chiqadi
    expect(saved[0].publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(saved[0].expiresAt!.getTime() - saved[0].publishedAt!.getTime()).toBe(90 * DAY);
    // Katalogdan tushmagan e'lon kuzatuvchilarga yangi emas
    expect(asked).toHaveLength(0);
  });

  // Tasdiqlanmagan tashkilot qayta yuborsa tekshiruvga tushardi; faol e'lon esa allaqachon katalogda
  it("tekshiruvsiz: tasdiqlanmagan tashkilot e'loni ham faol qoladi, haydovchi chegarasi sanalmaydi", async () => {
    const { svc, saved, counts } = setup(live(5, { orgId: 'o1', ownerUserId: null, kind: 'WAGON', ownerUser: null }), 0, 'PENDING');
    await svc.publish('boss', 'l1');
    expect(saved.map((s) => s.status)).toEqual(['ACTIVE']);
    expect(counts).toHaveLength(0);
  });

  it('oynadan tashqarida faol e\'lon avvalgidek rad etiladi', async () => {
    const { svc, saved } = setup(live(30));
    await expect(svc.publish('driver', 'l1')).rejects.toBeInstanceOf(ConflictException);
    expect(saved).toHaveLength(0);
  });

  // Ikkinchi bosish yoki orada admin tortib olgani: eski o'qish ustidan yozilmaydi, egasi sahifani yangilaydi
  it("o'qilgandan keyin o'zgargan qator 409 oladi", async () => {
    const e = await setup(live(2), 0, null, true).svc.publish('driver', 'l1').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).getResponse()).toMatchObject({ code: 'TRANSITION_NOT_ALLOWED', from: 'ACTIVE' });
  });

  // Arxivlab qayta yuborish oynani chetlab o'tmasin
  it("arxivdan muddati ichida qaytgan e'lon o'z sanalari bilan qaytadi, kuzatuvchilarga bormaydi", async () => {
    const { svc, saved, asked } = setup(live(60, { status: 'ARCHIVED' }));
    await svc.publish('driver', 'l1');
    expect(saved).toEqual([{ status: 'ACTIVE', rejectReason: null }]);
    expect(asked).toHaveLength(0);
  });

  it("muddati arxivda tugagan e'lon yangi 90 kun oladi va kuzatuvchilarga boradi", async () => {
    const { svc, saved, asked } = setup(live(-1, { status: 'ARCHIVED' }));
    await svc.publish('driver', 'l1');
    expect(saved[0].expiresAt!.getTime() - saved[0].publishedAt!.getTime()).toBe(90 * DAY);
    expect(asked).toHaveLength(1);
  });
});

describe('holat yozuvi', () => {
  it("o'qilgan holat va muddatga shartli", async () => {
    const wheres: unknown[] = [];
    const prisma = { listing: { update: async (a: { where: unknown }) => { wheres.push(a.where); return listing(); } } } as unknown as PrismaService;
    const exp = new Date('2026-10-10T00:00:00Z');
    await new PrismaListingRepository(prisma).setStatus({ id: 'l1', status: 'ACTIVE', expiresAt: exp }, { status: 'ARCHIVED', rejectReason: null });
    expect(wheres).toEqual([{ id: 'l1', status: 'ACTIVE', expiresAt: exp }]);
  });
});
