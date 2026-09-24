import { Injectable } from '@nestjs/common';
import { PAYMENT_TERM_LABELS, REGION_LABELS, SERVICE_TYPE_LABELS, TRUCKS_WORD, uzDateText, uzLocalDate, type PaymentTerm, type RegionCode, type SearchLang, type ServiceType } from '@yuksaroy/domain';
import { env } from '../../common/env';
import { PrismaService } from '../../common/prisma.service';
import { esc, notifyBoth, sendTelegram, webUrl } from '../../common/telegram';
import { NotificationsService, type NotificationKind } from '../notifications/notifications.service';
import { notifyRegions } from './market.rules';

export type RequestRow = {
  id: string; no: string; board: string; serviceType: string | null; regionCode: string | null;
  fromRegion: string | null; toRegion: string | null; fromText: string | null; toText: string | null;
  cargoName: string | null; weightT: number | null; loadDate: Date | null; truckType: string | null;
  volumeM3: number | null; trucksCount: number | null; paymentTerm: string | null;
  title: string; description: string; contactPhone: string | null; createdById: string; orgId: string | null;
  status: string; awardedOfferId: string | null; statusToken: string; isDemo: boolean; createdAt: Date; updatedAt: Date;
};
export type OfferRow = { id: string; requestId: string; providerUserId: string; providerOrgId: string | null; priceTiyin: bigint | null; message: string | null; status: string; createdAt: Date };
export type OrgRef = { id: string; name: string; slug: string | null; kycStatus: string };

/** Ochiq javob: telefon va token yo'q, faqat hasPhone. Egasi uchun withPhone = true. */
export function requestView(r: RequestRow, offersCount: number, withPhone = false) {
  const { contactPhone, statusToken: _t, ...rest } = r;
  return { ...rest, hasPhone: !!contactPhone?.trim(), ...(withPhone ? { contactPhone, statusUrl: webUrl(`/m/${r.statusToken}`) } : {}), offersCount };
}

/** BigInt -> Number (JSON); tashkilot nomi bo'lsa qo'shiladi. */
export const offerView = (o: OfferRow, orgs: Map<string, OrgRef> = new Map(), users: Map<string, { name: string | null; phoneVerified: boolean; done: number }> = new Map()) => {
  const org = o.providerOrgId ? orgs.get(o.providerOrgId) : undefined;
  const u = users.get(o.providerUserId);
  return {
    ...o, priceTiyin: o.priceTiyin == null ? null : Number(o.priceTiyin),
    providerOrg: org ? { id: org.id, name: org.name, slug: org.slug, kyc: org.kycStatus } : null,
    providerName: org?.name ?? u?.name ?? null,
    // Faqat xaritada yozuv bo'lganda: offerView uch joyda xaritasiz chaqiriladi va
    // u yerda `false` yozilsa raqami tasdiqlangan odam haqida yolg'on aytilardi.
    // Bajarilgan ish soni ham shunday: so'ralmagan joyda 0 yozish "hech narsa qilmagan" degan yolg'on
    ...(u ? { providerPhoneVerified: u.phoneVerified, providerDoneCount: u.done } : {}),
  };
};

const lang = (l: string): SearchLang => (l === 'ru' || l === 'en' ? l : 'uz');
const region = (c: string | null) => (c ? REGION_LABELS[c as RegionCode] ?? c : '');
const svc = (l: string, t: string | null) => (t ? SERVICE_TYPE_LABELS[lang(l)][t as ServiceType] ?? t : '');
/**
 * Yuk qatori: nomi, og'irligi, hajmi, nechta mashina va to'lov sharti.
 * Oluvchining tilida yig'iladi, chunki Telegram xabari har kimga o'z tilida ketadi.
 * Bo'sh maydonlar umuman chiqmaydi.
 */
const cargoLine = (r: RequestRow, l: string) => [
  r.cargoName,
  r.weightT ? `${r.weightT} t` : '',
  r.volumeM3 ? `${r.volumeM3} m3` : '',
  r.trucksCount && r.trucksCount > 1 ? `${r.trucksCount} ${TRUCKS_WORD[lang(l)]}` : '',
  r.paymentTerm ? PAYMENT_TERM_LABELS[lang(l)][r.paymentTerm as PaymentTerm] ?? '' : '',
].filter(Boolean).join(', ');
const KIND: NotificationKind = 'market';

/** Bozor uchun umumiy o'qishlar va bildirishnomalar. Xabar yuborish chaqiruvchini kuttirmaydi (void ... .catch). */
@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async orgsOf(rows: { providerOrgId: string | null }[]): Promise<Map<string, OrgRef>> {
    const ids = [...new Set(rows.map((o) => o.providerOrgId).filter((x): x is string => !!x))];
    if (!ids.length) return new Map();
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true, kycStatus: true } });
    return new Map(orgs.map((o) => [o.id, o]));
  }

  /**
   * Tashkilotsiz ta'minotchi (haydovchi) haqida: nomi va raqami tasdiqlanganmi.
   * Raqam User qatoriga faqat kod tasdig'idan keyin tushadi, ya'ni uning borligi
   * tasdiqlanganlik belgisi (e'lon kartasidagi qoida bilan bir xil).
   */
  async namesOf(userIds: string[]): Promise<Map<string, { name: string | null; phoneVerified: boolean; done: number }>> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map();
    // Ikkalasi yonma-yon: takliflar ro'yxati bitta javobda to'liq chiqadi
    const [users, done] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, phone: true } }),
      this.doneCounts(ids),
    ]);
    return new Map(users.map((u) => [u.id, { name: u.fullName, phoneVerified: u.phone != null, done: done.get(u.id) ?? 0 }]));
  }

  /**
   * Bajarilgan ish soni: tanlangan taklifi bajarilgan so'rovda turganlar soni.
   *
   * Yangi ustun yo'q va kesh yo'q: sanoq ustuni saqlansa u eskirar va qayta hisoblash
   * uchun yana admin tugmasi kerak bo'lardi (terminal reytingida shunday bo'lgan).
   * Bitta guruhlash so'rovi butun sahifaga yetadi.
   *
   * ponytail: MarketRequest.status bo'yicha alohida indeks yo'q, ost so'rov jadvalni
   * to'liq ko'rib chiqadi. Jadval yuz minglab qatorga yetganda @@index([status]) qo'yiladi.
   */
  async doneCounts(userIds: string[]): Promise<Map<string, number>> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map();
    const rows = await this.prisma.marketOffer.groupBy({
      by: ['providerUserId'],
      where: { providerUserId: { in: ids }, status: 'AWARDED', request: { status: 'DONE' } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.providerUserId, r._count._all]));
  }

  /** Odamning faol xizmat profillari turlari: xizmat so'roviga taklif berish huquqi shundan. */
  async activeServiceTypes(userId: string): Promise<string[]> {
    const rows = await this.prisma.serviceProfile.findMany({ where: { userId, status: 'ACTIVE' }, select: { serviceType: true } });
    return rows.map((r) => r.serviceType);
  }

  /** Tashkilot a'zosimi; a'zo bo'lmasa null (so'rov shaxsiy nomdan ketadi). */
  async memberOrgId(userId: string, orgId: string | null | undefined): Promise<string | null> {
    if (!orgId) return null;
    const m = await this.prisma.membership.findFirst({ where: { userId, orgId }, select: { orgId: true } });
    return m?.orgId ?? null;
  }

  /**
   * Yangi so'rov: yuk bo'lsa yuklash viloyati va qo'shnilaridagi (yoki hududsiz) tashuvchi tashkilot
   * egalariga; xizmat bo'lsa o'sha turdagi faol profil egalariga. Saytda ham, Telegramda ham.
   */
  async notifyNew(r: RequestRow): Promise<void> {
    let userIds: string[];
    if (r.board === 'CARGO') {
      // Yuklash viloyati va qo'shnilari: yuk shu atrofdagi mashinalarga ko'rinadi
      const regions = notifyRegions((r.fromRegion ?? r.regionCode) as RegionCode);
      const [ms, trucks] = await Promise.all([
        // isOwner sharti yo'q: dispetcher ham xabar olishi kerak, yukni u tanlaydi
        this.prisma.membership.findMany({
          where: { userId: { not: r.createdById }, org: { kinds: { has: 'CARRIER' }, OR: [{ regionCode: { in: regions } }, { regionCode: null }] } },
          select: { userId: true }, take: 500,
        }),
        // Mashinasi bor odam tashkilotsiz ham bo'ladi: ro'yxatdan o'tish oqimi haydovchini
        // aynan shaxsiy e'lon berishga yuboradi, lekin unga hech qachon yuk xabari bormasdi.
        // Kuzov turi mos kelsa yoki e'londa ko'rsatilmagan bo'lsa yuboriladi: chatga soatiga
        // 5 xabar chegarasi bor, filtrsiz haydovchi mos yukni o'tkazib yuborardi.
        this.prisma.listing.findMany({
          where: {
            kind: 'TRUCK', status: 'ACTIVE', isDemo: false,
            AND: [
              { OR: [{ serviceRegions: { hasSome: regions } }, { regionCode: { in: regions } }] },
              ...(r.truckType ? [{ OR: [{ truckType: r.truckType }, { truckType: null }] }] : []),
            ],
          },
          select: { ownerUserId: true, orgId: true }, take: 500,
        }),
      ]);
      userIds = await this.notifications.recipients({
        userIds: [...ms.map((m) => m.userId), ...trucks.map((l) => l.ownerUserId)],
        orgIds: trucks.map((l) => l.orgId),
      });
      userIds = userIds.filter((id) => id !== r.createdById);
    } else {
      const ps = await this.prisma.serviceProfile.findMany({ where: { status: 'ACTIVE', serviceType: r.serviceType ?? '', userId: { not: r.createdById } }, select: { userId: true }, take: 500 });
      userIds = ps.map((p) => p.userId);
    }
    userIds = [...new Set(userIds)];
    if (!userIds.length) return;
    const href = r.board === 'CARGO' ? `/cargo/${r.no}` : `/services/requests/${r.no}`;
    const where = r.board === 'CARGO' ? `${region(r.fromRegion)} -> ${region(r.toRegion)}` : region(r.regionCode);

    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds },
      kind: r.board === 'CARGO' ? 'marketCargoNew' : 'marketServiceNew',
      inApp: KIND,
      href,
      vars: (l) => ({ no: r.no, title: r.title.slice(0, 200), where, what: r.board === 'CARGO' ? cargoLine(r, l) : svc(l, r.serviceType) }),
      card: { title: `${r.no} · ${r.title}`, body: where },
    });
  }

  /**
   * Yangi yuk Telegram kanaliga bitta post bo'lib chiqadi: bu birinchi bepul tarqatish yo'li.
   *
   * Narx ham, telefon ham yo'q: kanal ochiq, raqam esa faqat saytda va obuna ortida.
   * Namuna qatorlar chiqmaydi. Kanal id si muhit o'zgaruvchisida; qo'yilmagan bo'lsa
   * hech narsa yuborilmaydi va hech narsa buzilmaydi.
   *
   * Faqat prodda: dev va prod bitta bot tokenini bo'lishadi, ya'ni mahalliy ishga tushirish
   * haqiqiy kanalga post yozib yuborardi.
   */
  async postChannel(r: RequestRow): Promise<void> {
    const chat = env.TELEGRAM_CARGO_CHANNEL;
    if (!chat || env.NODE_ENV !== 'production' || r.board !== 'CARGO' || r.isDemo) return;
    const where = `${region(r.fromRegion)} -> ${region(r.toRegion)}`;
    const what = cargoLine(r, 'uz');
    const when = r.loadDate ? uzDateText(uzLocalDate(r.loadDate)) : '';
    const lines = [
      `<b>${esc(where)}</b>`,
      esc(what),
      when ? `Yuklash: ${esc(when)}` : '',
      webUrl(`/cargo/${r.no}`),
    ].filter(Boolean);
    await sendTelegram([chat], lines.join(String.fromCharCode(10)));
  }

  /** Yangi taklif: so'rov egasiga. */
  async notifyOffer(r: RequestRow, from: string | null): Promise<void> {
    const href = `/dashboard/market?tab=requests&id=${r.id}`;
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [r.createdById] },
      kind: 'marketOffer',
      inApp: KIND,
      href,
      vars: { no: r.no, title: r.title.slice(0, 200), from: from ?? '' },
      card: { title: `${r.no} · ${r.title}`, body: from },
    });
  }

  /**
   * Taklif tanlandi: g'olib ta'minotchiga.
   * Havola so'rov sahifasiga boradi, chunki buyurtmachining raqami aynan o'sha yerda ochiladi.
   */
  async notifyAward(r: RequestRow, providerUserId: string): Promise<void> {
    const href = r.board === 'CARGO' ? `/cargo/${r.no}` : `/services/requests/${r.no}`;
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [providerUserId] },
      kind: 'marketAward',
      inApp: KIND,
      href,
      vars: { no: r.no, title: r.title.slice(0, 200) },
    });
  }
}
