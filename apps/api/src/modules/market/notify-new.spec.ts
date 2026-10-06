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

function setup(opts: { members?: string[]; trucks?: { ownerUserId: string | null; orgId: string | null }[];
  watches?: { id: string; userId: string; kind: string; params: Record<string, string> }[]; profiles?: string[] } = {}) {
  const listingWhere: Where[] = [];
  const memberWhere: Where[] = [];
  const profileWhere: Where[] = [];
  const fanout: Where[] = [];
  const marked: string[][] = [];
  const prisma = {
    membership: { findMany: async (a: { where: Where }) => { memberWhere.push(a.where); return (opts.members ?? []).map((userId) => ({ userId })); } },
    listing: { findMany: async (a: { where: Where }) => { listingWhere.push(a.where); return opts.trucks ?? []; } },
    serviceProfile: { findMany: async (a: { where: Where }) => { profileWhere.push(a.where); return (opts.profiles ?? []).map((userId) => ({ userId })); } },
    auditLog: { create: async (a: { data: Where }) => { fanout.push(a.data); return {}; } },
    // notifyTelegram bazaga boradi: bo'sh ro'yxat qaytaramiz, xabar yuborilmaydi
    telegramLink: { findMany: async () => [] },
    // Kuzatuv: notifyNew uni to'g'ridan-to'g'ri await qiladi, ya'ni soxta shart
    watch: {
      findMany: async () => opts.watches ?? [],
      updateMany: async (a: { where: { id: { in: string[] } } }) => { marked.push([...a.where.id.in]); return { count: a.where.id.in.length }; },
    },
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
  return { svc: new MarketService(prisma, notifications), pushed, listingWhere, memberWhere, profileWhere, fanout, marked };
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

/**
 * Kuzatuv yangi tarqatish emas, mavjud ro'yxatning kengaytmasi: mashinasi ham,
 * tashuvchi tashkiloti ham yo'q, lekin shu yo'nalishni kutayotgan odam qo'shiladi.
 * Allaqachon oluvchilarning kuzatuvi kuymaydi: xabar ularga baribir ketadi.
 */
describe('kuzatuvchilar ham oladi', () => {
  const w = (id: string, userId: string, params: Record<string, string> = {}) => ({ id, userId, kind: 'CARGO', params });

  it("mashinasiz kuzatuvchi ro'yxatga qo'shiladi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'expeditor', { fromRegion: 'UZ-TK', toRegion: 'UZ-SA' })] });
    await svc.notifyNew(cargo());
    expect(pushed[0]).toContain('expeditor');
  });

  it("allaqachon oluvchining kuzatuvi kuymaydi va xabar takrorlanmaydi", async () => {
    const { svc, pushed, marked } = setup({ trucks: [{ ownerUserId: 'driver', orgId: null }], watches: [w('w1', 'driver')] });
    await svc.notifyNew(cargo());
    expect(pushed[0]!.filter((id) => id === 'driver')).toHaveLength(1);
    // Kuzatuv hisobga olinmadi: uning bugungi yagona o'qi saqlanib qoldi
    expect(marked).toEqual([]);
  });

  it("yuk egasining o'ziga kuzatuv orqali ham bormaydi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'shipper')] });
    await svc.notifyNew(cargo());
    expect(pushed).toHaveLength(0);
  });

  it("yo'nalish mos kelmasa qo'shilmaydi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'expeditor', { toRegion: 'UZ-QA' })] });
    await svc.notifyNew(cargo());
    expect(pushed).toHaveLength(0);
  });

  it("yukda kuzov turi yo'q bo'lsa kuzov kutgan odam ham oladi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'expeditor', { truckType: 'TENT' })] });
    await svc.notifyNew(cargo({ truckType: null }));
    expect(pushed[0]).toContain('expeditor');
  });
});

describe("so'rov kimga ketgani jurnalga yoziladi", () => {
  const service = () => ({ id: 'r1', no: 'SR-1', board: 'SERVICE', title: 'Ekspeditor kerak', createdById: 'shipper', serviceType: 'FORWARDER', regionCode: 'UZ-AN', fromRegion: null, toRegion: null }) as never;

  it("hech kimga ketmagani ham yoziladi, sent = 0", async () => {
    const { svc, pushed, fanout } = setup();
    await svc.notifyNew(cargo({ id: 'r0' }));
    expect(pushed).toHaveLength(0);
    expect(fanout).toEqual([{ action: 'request.fanout', entity: 'MarketRequest', entityId: 'r0', meta: { board: 'CARGO', region: 'UZ-TK', type: 'TENT', sent: 0 } }]);
  });

  it("xizmat so'rovi viloyat va qo'shnilarga, hududsiz profilga ham; namuna profilga emas", async () => {
    const { svc, pushed, profileWhere, fanout } = setup({ profiles: ['weigher'] });
    await svc.notifyNew(service());
    const where = profileWhere[0] as { isDemo: boolean; OR: [{ regions: { hasSome: string[] } }, { regions: { isEmpty: boolean } }] };
    expect(where.isDemo).toBe(false);
    expect(where.OR[0].regions.hasSome).toContain('UZ-AN');
    expect(where.OR[0].regions.hasSome.length).toBeGreaterThan(1); // qo'shnilar ham
    expect(where.OR[1]).toEqual({ regions: { isEmpty: true } });
    expect(pushed[0]).toEqual(['weigher']);
    expect((fanout[0] as { meta: { sent: number } }).meta.sent).toBe(1);
  });
});
