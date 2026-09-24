// E'lon yuborilganda tekshiruvga tushadimi yoki darhol faol bo'ladimi. Soxta repo, baza yo'q.
//
// Bugungacha publish() ni birorta test tekshirmasdi, shu sababli eski yo'l (tasdiqlangan
// tashkilot darhol ACTIVE) uchun ham qo'riqchi shu yerda: yakka haydovchi uchun ochilgan
// yangi yo'l uni buzib qo'ymasin.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AdminNotify } from '../organizations/application/admin-notify';
import type { SubscriptionService } from '../subscription/subscription.service';
import type { ListingRecord } from './domain/listing-query';
import type { PrismaListingRepository } from './infrastructure/prisma-listing.repository';
import type { ListingAccess } from './application/listing-access';
import { ListingsUseCase } from './application/listings.usecase';

type Status = { status: string; publishedAt?: Date; expiresAt?: Date; rejectReason: string | null };

const listing = (over: Partial<ListingRecord> = {}): ListingRecord => ({
  id: 'l1', slug: 'l1', orgId: null, ownerUserId: 'driver', createdById: 'driver', kind: 'TRUCK', deal: null, status: 'DRAFT',
  title: 'Isuzu 5 t', description: 'Toshkent bo\'ylab', regionCode: 'UZ-TK', terminalId: null,
  lat: null, lng: null, priceTiyin: null, priceUnit: null, photos: [],
  year: null, condition: null, model: null, qty: 1, wagonType: null, capacityT: null,
  truckType: 'TENT', tonnage: 5, fleetSize: null, serviceRegions: [], routes: [],
  contactPhone: null, responseHours: null,
  premiumUntil: null, publishedAt: null, expiresAt: null, rejectReason: null, views: 0,
  createdAt: new Date(), updatedAt: new Date(),
  org: null, ownerUser: { fullName: 'Akmal', phone: '+998901234567' }, terminal: null,
  ...over,
}) as ListingRecord;

function setup(l: ListingRecord, activeCount = 0, kyc: string | null = null) {
  const saved: Status[] = [];
  const counts: Record<string, unknown>[] = [];
  const repo = {
    findById: async () => l,
    setStatus: async (_id: string, d: Status) => { saved.push(d); return { ...l, ...d }; },
  } as unknown as PrismaListingRepository;
  const access = {
    membership: async () => (kyc ? { org: { kycStatus: kyc } } : null),
    assertLister: async () => {},
  } as unknown as ListingAccess;
  const prisma = {
    listing: { count: async (a: { where: Record<string, unknown> }) => { counts.push(a.where); return activeCount; } },
  } as unknown as PrismaService;
  const notifications = {} as unknown as NotificationsService;
  const subs = { raiseListing: async () => {} } as unknown as SubscriptionService;
  const adminNotify = { queued: async () => {} } as unknown as AdminNotify;
  const svc = new ListingsUseCase(repo, access, prisma, notifications, subs, adminNotify);
  return { svc, saved, counts };
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

  it('muddati o\'tgan faol e\'lonlar chegaraga kirmaydi', async () => {
    const { svc, counts } = setup(listing(), 0);
    await svc.publish('driver', 'l1');
    expect(counts[0]).toMatchObject({ ownerUserId: 'driver', status: 'ACTIVE' });
    expect(counts[0].OR).toBeDefined();
  });
});
