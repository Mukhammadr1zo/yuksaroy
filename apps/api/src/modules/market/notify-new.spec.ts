// Yangi yuk kimga xabar qiladi. Soxta Prisma, DB yo'q.
//
// Ilgari xabar faqat CARRIER tashkilotining EGASIGA borardi. Ro'yxatdan o'tish oqimi
// haydovchini shaxsiy e'lon berishga yuboradi, ya'ni mashinasi bor odamlarning katta
// qismi tashkilotsiz; ular hech qachon yuk haqida xabar olmasdi va doska bo'sh ko'rinardi.
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import { recentErrors } from '../../common/runtime';
import type { NotificationInput, NotificationsService } from '../notifications/notifications.service';
import { MarketService } from './market.service';

type Where = Record<string, unknown>;

/**
 * admins: PlatformAdmin.adminUserIds rol bo'yicha topadiganlar. inactive: bloklangan hisoblar.
 * team: so'rov egasining hamkasblari (bir tashkilot a'zolari). broken: mashina qidiruvi yiqiladi.
 * chats: Telegram bog'lagan odamlar (chat id lari har testda boshqa: chatBucket soatiga 5 ta).
 */
function setup(opts: { members?: string[]; trucks?: { ownerUserId: string | null; orgId: string | null }[];
  watches?: { id: string; userId: string; kind: string; params: Record<string, string> }[]; profiles?: string[];
  admins?: string[]; inactive?: string[]; team?: string[]; broken?: boolean; chats?: Record<string, number> } = {}) {
  const listingWhere: Where[] = [];
  const memberWhere: Where[] = [];
  const teamWhere: Where[] = [];
  const profileWhere: Where[] = [];
  const fanout: Where[] = [];
  const marked: string[][] = [];
  const prisma = {
    membership: {
      findMany: async (a: { where: Where }) => {
        // Platforma adminlari ro'yxati rol bo'yicha so'raladi, tashuvchilar esa tashkilot turi bo'yicha
        if (a.where.roles) return (opts.admins ?? []).map((userId) => ({ userId }));
        // Hamkasblar: oluvchilar ichidan so'rov egasi a'zo bo'lgan tashkilotdagilar
        if ((a.where.org as Where | undefined)?.members) {
          teamWhere.push(a.where);
          return (a.where.userId as { in: string[] }).in.filter((id) => (opts.team ?? []).includes(id)).map((userId) => ({ userId }));
        }
        memberWhere.push(a.where);
        return (opts.members ?? []).map((userId) => ({ userId }));
      },
    },
    user: {
      // Telefon bo'yicha admin (.env dagi PLATFORM_ADMIN_PHONES) yo'q; qolgani faollik va til so'rovi
      findMany: async (a: { where: { id?: { in: string[] }; phone?: unknown } }) => (a.where.phone ? []
        : (a.where.id?.in ?? []).filter((id) => !(opts.inactive ?? []).includes(id)).map((id) => ({ id, locale: 'uz' }))),
    },
    listing: {
      findMany: async (a: { where: Where }) => {
        if (opts.broken) throw new Error('relation "Listing" does not exist');
        listingWhere.push(a.where);
        return opts.trucks ?? [];
      },
    },
    serviceProfile: { findMany: async (a: { where: Where }) => { profileWhere.push(a.where); return (opts.profiles ?? []).map((userId) => ({ userId })); } },
    auditLog: { create: async (a: { data: Where }) => { fanout.push(a.data); return {}; } },
    // Telegram faqat chats dagi odamlarga: sukut bo'yicha hech kim bog'lamagan, xabar yuborilmaydi
    telegramLink: {
      findMany: async (a: { where: { OR: { userId: { in: string[] } }[] } }) => a.where.OR[0].userId.in
        .filter((id) => opts.chats?.[id]).map((id) => ({ chatId: BigInt(opts.chats![id]!), user: { locale: 'uz' } })),
    },
    // Kuzatuv: fanout uni to'g'ridan-to'g'ri await qiladi, ya'ni soxta shart
    watch: {
      findMany: async () => opts.watches ?? [],
      updateMany: async (a: { where: { id: { in: string[] } } }) => { marked.push([...a.where.id.in]); return { count: a.where.id.in.length }; },
    },
  } as unknown as PrismaService;
  const pushed: string[][] = [];
  const notes: NotificationInput[] = [];
  const notifications = {
    push: async (ids: readonly string[], n: NotificationInput) => { pushed.push([...ids]); notes.push(n); },
    recipients: async (w: { userIds?: (string | null)[]; orgIds?: (string | null)[] }) => {
      const direct = (w.userIds ?? []).filter((x): x is string => !!x);
      const fromOrgs = (w.orgIds ?? []).filter((x): x is string => !!x).map((o) => `member-of-${o}`);
      return [...new Set([...direct, ...fromOrgs])];
    },
  } as unknown as NotificationsService;
  return { svc: new MarketService(prisma, notifications), pushed, notes, listingWhere, memberWhere, teamWhere, profileWhere, fanout, marked };
}

/** Yaratishdagi tartib: avval sanoq va jurnal (fanout), keyin xabarning o'zi (notifyNew). */
async function run(svc: MarketService, r: never) {
  const f = await svc.fanout(r);
  await svc.notifyNew(r, f.userIds);
  return f;
}
/** Ogohlantirish kutilmaydi (void): soxta bog'lanishlar mikrovazifada tugaydi, bitta tayming yetadi. */
const flush = () => new Promise((ok) => setTimeout(ok, 0));

const cargo = (extra: Record<string, unknown> = {}) => ({
  no: 'CR-1', board: 'CARGO', title: 'Bug\'doy, 20 t', createdById: 'shipper', fromRegion: 'UZ-TK', toRegion: 'UZ-SA',
  regionCode: 'UZ-TK', cargoName: "Bug'doy", weightT: 20, truckType: 'TENT', serviceType: null,
  ...extra,
}) as never;

describe('yangi yuk xabari', () => {
  it("shaxsiy mashina e'loni egasiga ham boradi", async () => {
    const { svc, pushed } = setup({ members: ['org-owner'], trucks: [{ ownerUserId: 'driver', orgId: null }] });
    await run(svc, cargo());
    expect(pushed[0]).toContain('driver');
    expect(pushed[0]).toContain('org-owner');
  });

  it("tashkilot e'loni bo'lsa uning a'zolari qo'shiladi", async () => {
    const { svc, pushed } = setup({ trucks: [{ ownerUserId: null, orgId: 'o1' }] });
    await run(svc, cargo());
    expect(pushed[0]).toContain('member-of-o1');
  });

  it("yuk egasining o'ziga xabar bormaydi", async () => {
    const { svc, pushed } = setup({ members: ['shipper'], trucks: [{ ownerUserId: 'shipper', orgId: null }] });
    await run(svc, cargo());
    expect(pushed).toHaveLength(0);
  });

  it('dispetcher ham oladi: egalik sharti yo\'q', async () => {
    const { svc, memberWhere } = setup({ members: ['dispatcher'] });
    await run(svc, cargo());
    expect(memberWhere[0]).not.toHaveProperty('isOwner');
  });

  it("kuzov turi so'ralsa mos yoki turi ko'rsatilmagan e'lonlar olinadi", async () => {
    const { svc, listingWhere } = setup({ trucks: [{ ownerUserId: 'd', orgId: null }] });
    await run(svc, cargo({ truckType: 'REF' }));
    const and = listingWhere[0].AND as { OR: unknown[] }[];
    expect(and[1].OR).toEqual([{ truckType: 'REF' }, { truckType: null }]);
  });

  it("kuzov turi so'ralmasa hamma mashinalar olinadi", async () => {
    const { svc, listingWhere } = setup({ trucks: [] });
    await run(svc, cargo({ truckType: null }));
    expect((listingWhere[0].AND as unknown[]).length).toBe(1);
  });

  it("namuna e'lon va faol bo'lmagani chetlab o'tiladi", async () => {
    const { svc, listingWhere } = setup({ trucks: [] });
    await run(svc, cargo());
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
    await run(svc, cargo());
    expect(pushed[0]).toContain('expeditor');
  });

  it("allaqachon oluvchining kuzatuvi kuymaydi va xabar takrorlanmaydi", async () => {
    const { svc, pushed, marked } = setup({ trucks: [{ ownerUserId: 'driver', orgId: null }], watches: [w('w1', 'driver')] });
    await run(svc, cargo());
    expect(pushed[0]!.filter((id) => id === 'driver')).toHaveLength(1);
    // Kuzatuv hisobga olinmadi: uning bugungi yagona o'qi saqlanib qoldi
    expect(marked).toEqual([]);
  });

  it("yuk egasining o'ziga kuzatuv orqali ham bormaydi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'shipper')] });
    await run(svc, cargo());
    expect(pushed).toHaveLength(0);
  });

  it("yo'nalish mos kelmasa qo'shilmaydi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'expeditor', { toRegion: 'UZ-QA' })] });
    await run(svc, cargo());
    expect(pushed).toHaveLength(0);
  });

  it("yukda kuzov turi yo'q bo'lsa kuzov kutgan odam ham oladi", async () => {
    const { svc, pushed } = setup({ watches: [w('w1', 'expeditor', { truckType: 'TENT' })] });
    await run(svc, cargo({ truckType: null }));
    expect(pushed[0]).toContain('expeditor');
  });
});

describe("so'rov kimga ketgani jurnalga yoziladi", () => {
  const service = () => ({ id: 'r1', no: 'SR-1', board: 'SERVICE', title: 'Ekspeditor kerak', createdById: 'shipper', serviceType: 'FORWARDER', regionCode: 'UZ-AN', fromRegion: null, toRegion: null }) as never;

  it("hech kimga ketmagani ham yoziladi, sent = 0", async () => {
    const { svc, pushed, fanout } = setup();
    await run(svc, cargo({ id: 'r0' }));
    expect(pushed).toHaveLength(0);
    expect(fanout).toEqual([{ action: 'request.fanout', entity: 'MarketRequest', entityId: 'r0', meta: { board: 'CARGO', region: 'UZ-TK', type: 'TENT', sent: 0, sentReal: 0 } }]);
  });

  it("xizmat so'rovi viloyat va qo'shnilarga, hududsiz profilga ham; namuna profilga emas", async () => {
    const { svc, pushed, profileWhere, fanout } = setup({ profiles: ['weigher'] });
    await run(svc, service());
    const where = profileWhere[0] as { isDemo: boolean; OR: [{ regions: { hasSome: string[] } }, { regions: { isEmpty: boolean } }] };
    expect(where.isDemo).toBe(false);
    expect(where.OR[0].regions.hasSome).toContain('UZ-AN');
    expect(where.OR[0].regions.hasSome.length).toBeGreaterThan(1); // qo'shnilar ham
    expect(where.OR[1]).toEqual({ regions: { isEmpty: true } });
    expect(pushed[0]).toEqual(['weigher']);
    expect((fanout[0] as { meta: { sent: number } }).meta.sent).toBe(1);
  });
});

/**
 * Kim HAQIQATAN oldi. Ilgari namuna tashkilotning a'zosi va bloklangan hisob ham oluvchi
 * bo'lib sanalardi, platformaning o'z tashkiloti esa tashuvchi bo'lib turardi: so'rov hech
 * bir ijrochiga yetmasa ham jurnalda "ketdi" ko'rinardi va buni hech kim bilmasdi.
 */
describe('haqiqiy oluvchilar soni va adminga ogohlantirish', () => {
  // Ogohlantirishning Telegram qismi soatiga bitta (common/fanout.ts): har test o'z soatida boshlanadi
  let clock = Date.parse('2026-10-07T00:00:00Z');
  beforeEach(() => { clock += 2 * 3_600_000; vi.spyOn(Date, 'now').mockReturnValue(clock); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  /** Telegram soxta: haqiqiy botga hech narsa ketmaydi, yuborilgan matnlar shu yerda. */
  const tg = () => {
    const sent: { chat_id: string; text: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return { ok: true }; }));
    return sent;
  };

  it("tashuvchi a'zolar so'rovida namuna tashkilot va bloklangan hisob chetda", async () => {
    const { svc, memberWhere } = setup({ members: ['dispatcher'] });
    await run(svc, cargo());
    expect(memberWhere[0]).toMatchObject({ user: { isActive: true }, org: { isDemo: false, kinds: { has: 'CARRIER' } } });
  });

  it("bloklangan mashina egasi sanalmaydi va xabar olmaydi", async () => {
    const { svc, pushed, fanout } = setup({ members: ['carrier'], trucks: [{ ownerUserId: 'blocked', orgId: null }], inactive: ['blocked'] });
    const f = await run(svc, cargo());
    expect(f.userIds).toEqual(['carrier']);
    expect(pushed[0]).toEqual(['carrier']);
    expect((fanout[0] as { meta: { sent: number; sentReal: number } }).meta).toMatchObject({ sent: 1, sentReal: 1 });
  });

  it('sentReal platforma adminlarini sanamaydi, sent esa hammani', async () => {
    const sent = tg();
    const { svc, notes, fanout } = setup({ members: ['admin1', 'carrier'], admins: ['admin1'], chats: { admin1: 790001 } });
    const f = await svc.fanout(cargo({ id: 'r2', no: 'CR-2' }));
    await flush();
    expect(f.sentReal).toBe(1);
    expect((fanout[0] as { meta: { sent: number; sentReal: number } }).meta).toMatchObject({ sent: 2, sentReal: 1 });
    // Haqiqiy ijrochi bor: ogohlantirish yo'q
    expect(notes).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("faqat adminga ketgan so'rov: adminlar darhol bir marta ogohlantiriladi (Telegram va panel)", async () => {
    const sent = tg();
    const { svc, pushed, notes, fanout } = setup({ members: ['admin1'], admins: ['admin1', 'admin2'], chats: { admin1: 790011, admin2: 790012 } });
    const f = await svc.fanout(cargo({ id: 'r3', no: 'CR-3' }));
    await flush();
    expect(f.sentReal).toBe(0);
    expect((fanout[0] as { meta: { sent: number; sentReal: number } }).meta).toMatchObject({ sent: 1, sentReal: 0 });
    // Panel qo'ng'irog'i: bitta yozuv, ikkala adminga, havola paneldagi shu so'rov
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: 'claim', href: '/admin/market?q=CR-3' });
    expect(pushed[0]!.sort()).toEqual(['admin1', 'admin2']);
    // Telegram: har adminga bittadan, matnda raqam, nima, qayerda va panel havolasi
    expect(sent.map((s) => s.chat_id).sort()).toEqual(['790011', '790012']);
    expect(sent[0]!.text).toContain('CR-3');
    expect(sent[0]!.text).toContain("Bug'doy");
    // Telegram HTML o'qiydi: "->" dagi ">" tozalanib ketadi, shuning uchun viloyatlar alohida
    expect(sent[0]!.text).toContain('Toshkent shahri');
    expect(sent[0]!.text).toContain('Samarqand viloyati');
    expect(sent[0]!.text).toContain('/admin/market?q=CR-3');
  });

  it("hech kimga ketmagan xizmat so'rovi ham ogohlantiradi; adminning o'z so'rovi o'ziga qaytmaydi", async () => {
    const sent = tg();
    const { svc, pushed, notes } = setup({ admins: ['admin1', 'admin2'], chats: { admin1: 790021, admin2: 790022 } });
    await svc.fanout({ id: 'r4', no: 'SR-4', board: 'SERVICE', title: 'Ekspeditor kerak', createdById: 'admin1', serviceType: 'FORWARDER', regionCode: 'UZ-AN', fromRegion: null, toRegion: null } as never);
    await flush();
    expect(notes).toHaveLength(1);
    expect(notes[0]!.href).toBe('/admin/market?q=SR-4');
    expect(pushed[0]).toEqual(['admin2']);
    expect(sent.map((s) => s.chat_id)).toEqual(['790022']);
    expect(sent[0]!.text).toContain('Ekspeditor');
  });

  it('admin yo\'q bo\'lsa ogohlantirish ham yo\'q, so\'rov yiqilmaydi', async () => {
    const sent = tg();
    const { svc, notes } = setup();
    expect((await svc.fanout(cargo({ id: 'r5', no: 'CR-5' }))).sentReal).toBe(0);
    await flush();
    expect(notes).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("so'rov egasining hamkasbi xabarni oladi, lekin sanalmaydi: faqat unga ketgan so'rov ogohlantiradi", async () => {
    const { svc, pushed, notes, fanout, teamWhere } = setup({ members: ['colleague'], team: ['colleague'], admins: ['admin1'] });
    const f = await run(svc, cargo({ id: 'r6', no: 'CR-6' }));
    await flush();
    expect(f).toEqual({ userIds: ['colleague'], sentReal: 0 });
    expect((fanout[0] as { meta: unknown }).meta).toMatchObject({ sent: 1, sentReal: 0 });
    expect(pushed).toContainEqual(['colleague']);
    expect(notes.map((n) => n.href)).toContain('/admin/market?q=CR-6');
    // Hamkasb: so'rov egasi a'zo bo'lgan tashkilotning a'zosi, faqat oluvchilar ichidan
    expect(teamWhere[0]).toEqual({ userId: { in: ['colleague'] }, org: { members: { some: { userId: 'shipper' } } } });
  });

  it("qidiruv yiqilsa jim qolmaydi: jurnalda 0 va failed, adminlarga sababi bilan, mijozga son yo'q", async () => {
    const sent = tg();
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const { svc, notes, fanout } = setup({ broken: true, members: ['carrier'], admins: ['admin1'], chats: { admin1: 790041 } });
    const f = await svc.fanout(cargo({ id: 'r7', no: 'CR-7' }));
    await flush();
    // Hech kimga ketmadi, lekin "bu hududda tashuvchi yo'q" deyish yolg'on: son null
    expect(f).toEqual({ userIds: [], sentReal: null });
    expect((fanout[0] as { meta: unknown }).meta).toMatchObject({ sent: 0, sentReal: 0, failed: true });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: 'claim', href: '/admin/market?q=CR-7' });
    expect(notes[0]!.title).toContain('hech kimga yuborilmadi');
    expect(sent.map((s) => s.chat_id)).toEqual(['790041']);
    expect(sent[0]!.text).toContain('Tizim');
    // Sabab server jurnalida va Tizim sahifasidagi "yaqinda nima buzildi" ro'yxatida
    expect(logged).toHaveBeenCalled();
    expect(recentErrors()[0]).toMatchObject({ status: 500, code: 'FANOUT_FAILED', method: 'POST', path: '/v1/market/requests' });
    expect(recentErrors()[0]!.msg).toContain('CR-7');
  });

  it("bir soat ichidagi ikkinchi ogohlantirish faqat panelga: Telegram chelagi boshqa xabarlarga qolsin", async () => {
    const sent = tg();
    const { svc, notes } = setup({ admins: ['admin1'], chats: { admin1: 790051 } });
    await svc.fanout(cargo({ id: 'r8', no: 'CR-8' }));
    await svc.fanout(cargo({ id: 'r9', no: 'CR-9' }));
    await flush();
    expect(notes.map((n) => n.href).sort()).toEqual(['/admin/market?q=CR-8', '/admin/market?q=CR-9']);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain('CR-8');
  });

  it("yagona adminning o'z so'rovi ogohlantirmaydi va soatlik Telegram navbatini band qilmaydi", async () => {
    const sent = tg();
    const { svc, notes } = setup({ admins: ['admin1'], chats: { admin1: 790061 } });
    await svc.fanout(cargo({ id: 'r10', no: 'CR-10', createdById: 'admin1' }));
    await svc.fanout(cargo({ id: 'r11', no: 'CR-11' }));
    await flush();
    expect(notes.map((n) => n.href)).toEqual(['/admin/market?q=CR-11']);
    expect(sent.map((s) => s.chat_id)).toEqual(['790061']);
  });
});
