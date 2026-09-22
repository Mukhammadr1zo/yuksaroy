// Yangi yuk kimga xabar qiladi. Soxta Prisma, DB yo'q.
//
// Ilgari xabar faqat CARRIER tashkilotining EGASIGA borardi. Ro'yxatdan o'tish oqimi
// haydovchini shaxsiy e'lon berishga yuboradi, ya'ni mashinasi bor odamlarning katta
// qismi tashkilotsiz; ular hech qachon yuk haqida xabar olmasdi va doska bo'sh ko'rinardi.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { MarketService } from './market.service';

type Where = Record<string, unknown>;

function setup(opts: { members?: string[]; trucks?: { ownerUserId: string | null; orgId: string | null }[] } = {}) {
  const listingWhere: Where[] = [];
  const memberWhere: Where[] = [];
  const prisma = {
    membership: { findMany: async (a: { where: Where }) => { memberWhere.push(a.where); return (opts.members ?? []).map((userId) => ({ userId })); } },
    listing: { findMany: async (a: { where: Where }) => { listingWhere.push(a.where); return opts.trucks ?? []; } },
    serviceProfile: { findMany: async () => [] },
    // notifyTelegram bazaga boradi: bo'sh ro'yxat qaytaramiz, xabar yuborilmaydi
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  const pushed: string[][] = [];
  const notifications = {
    push: async (ids: readonly string[]) => { pushed.push([...ids]); },
    recipients: async (w: { userIds?: (string | null)[]; orgIds?: (string | null)[] }) => {
      const direct = (w.userIds ?? []).filter((x): x is string => !!x);
      const fromOrgs = (w.orgIds ?? []).filter((x): x is string => !!x).map((o) => `member-of-${o}`);
      return [...new Set([...direct, ...fromOrgs])];
    },
  } as unknown as NotificationsService;
  return { svc: new MarketService(prisma, notifications), pushed, listingWhere, memberWhere };
}

const cargo = (extra: Record<string, unknown> = {}) => ({
  no: 'CR-1', board: 'CARGO', title: 'Bug\'doy, 20 t', createdById: 'shipper', fromRegion: 'UZ-TK', toRegion: 'UZ-SA',
  regionCode: 'UZ-TK', cargoName: "Bug'doy", weightT: 20, truckType: 'TENT', serviceType: null,
  ...extra,
}) as never;

describe('yangi yuk xabari', () => {
  it("shaxsiy mashina e'loni egasiga ham boradi", async () => {
    const { svc, pushed } = setup({ members: ['org-owner'], trucks: [{ ownerUserId: 'driver', orgId: null }] });
    await svc.notifyNew(cargo());
    expect(pushed[0]).toContain('driver');
    expect(pushed[0]).toContain('org-owner');
  });

  it("tashkilot e'loni bo'lsa uning a'zolari qo'shiladi", async () => {
    const { svc, pushed } = setup({ trucks: [{ ownerUserId: null, orgId: 'o1' }] });
    await svc.notifyNew(cargo());
    expect(pushed[0]).toContain('member-of-o1');
  });

  it("yuk egasining o'ziga xabar bormaydi", async () => {
    const { svc, pushed } = setup({ members: ['shipper'], trucks: [{ ownerUserId: 'shipper', orgId: null }] });
    await svc.notifyNew(cargo());
    expect(pushed).toHaveLength(0);
  });

  it('dispetcher ham oladi: egalik sharti yo\'q', async () => {
    const { svc, memberWhere } = setup({ members: ['dispatcher'] });
    await svc.notifyNew(cargo());
    expect(memberWhere[0]).not.toHaveProperty('isOwner');
  });

  it("kuzov turi so'ralsa mos yoki turi ko'rsatilmagan e'lonlar olinadi", async () => {
    const { svc, listingWhere } = setup({ trucks: [{ ownerUserId: 'd', orgId: null }] });
    await svc.notifyNew(cargo({ truckType: 'REF' }));
    const and = listingWhere[0].AND as { OR: unknown[] }[];
    expect(and[1].OR).toEqual([{ truckType: 'REF' }, { truckType: null }]);
  });

  it("kuzov turi so'ralmasa hamma mashinalar olinadi", async () => {
    const { svc, listingWhere } = setup({ trucks: [] });
    await svc.notifyNew(cargo({ truckType: null }));
    expect((listingWhere[0].AND as unknown[]).length).toBe(1);
  });

  it("namuna e'lon va faol bo'lmagani chetlab o'tiladi", async () => {
    const { svc, listingWhere } = setup({ trucks: [] });
    await svc.notifyNew(cargo());
    expect(listingWhere[0]).toMatchObject({ kind: 'TRUCK', status: 'ACTIVE', isDemo: false });
  });
});
