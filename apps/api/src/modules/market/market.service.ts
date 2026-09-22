import { Injectable } from '@nestjs/common';
import { REGION_LABELS, SERVICE_TYPE_LABELS, type RegionCode, type SearchLang, type ServiceType } from '@yuksaroy/domain';
import { PrismaService } from '../../common/prisma.service';
import { notifyTelegram, webUrl } from '../../common/telegram';
import { NotificationsService, type NotificationKind } from '../notifications/notifications.service';
import { notifyRegions } from './market.rules';

export type RequestRow = {
  id: string; no: string; board: string; serviceType: string | null; regionCode: string | null;
  fromRegion: string | null; toRegion: string | null; fromText: string | null; toText: string | null;
  cargoName: string | null; weightT: number | null; loadDate: Date | null; truckType: string | null;
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
export const offerView = (o: OfferRow, orgs: Map<string, OrgRef> = new Map(), users: Map<string, string | null> = new Map()) => {
  const org = o.providerOrgId ? orgs.get(o.providerOrgId) : undefined;
  return {
    ...o, priceTiyin: o.priceTiyin == null ? null : Number(o.priceTiyin),
    providerOrg: org ? { id: org.id, name: org.name, slug: org.slug, kyc: org.kycStatus } : null,
    providerName: org?.name ?? users.get(o.providerUserId) ?? null,
  };
};

const lang = (l: string): SearchLang => (l === 'ru' || l === 'en' ? l : 'uz');
const region = (c: string | null) => (c ? REGION_LABELS[c as RegionCode] ?? c : '');
const svc = (l: string, t: string | null) => (t ? SERVICE_TYPE_LABELS[lang(l)][t as ServiceType] ?? t : '');
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

  /** Foydalanuvchi nomlari: tashkilotsiz ta'minotchi (haydovchi) uchun. */
  async namesOf(userIds: string[]): Promise<Map<string, string | null>> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    return new Map(users.map((u) => [u.id, u.fullName]));
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
    const cargoWhat = `${r.cargoName ?? ''}${r.weightT ? `, ${r.weightT} t` : ''}`;
    await this.notifications.push(userIds, { kind: KIND, title: `${r.no} · ${r.title}`, body: where, href });
    await notifyTelegram(this.prisma, { userIds }, r.board === 'CARGO' ? 'marketCargoNew' : 'marketServiceNew', (l) => ({
      no: r.no, title: r.title.slice(0, 200), where, what: r.board === 'CARGO' ? cargoWhat : svc(l, r.serviceType), url: webUrl(href),
    }));
  }

  /** Yangi taklif: so'rov egasiga. */
  async notifyOffer(r: RequestRow, from: string | null): Promise<void> {
    const href = `/dashboard/market?tab=requests&id=${r.id}`;
    await this.notifications.push([r.createdById], { kind: KIND, title: `${r.no} · ${r.title}`, body: from, href });
    await notifyTelegram(this.prisma, { userIds: [r.createdById] }, 'marketOffer', { no: r.no, title: r.title.slice(0, 200), from: from ?? '', url: webUrl(href) });
  }

  /** Taklif tanlandi: g'olib ta'minotchiga. */
  async notifyAward(r: RequestRow, providerUserId: string): Promise<void> {
    const href = `/dashboard/market?tab=offers`;
    await this.notifications.push([providerUserId], { kind: KIND, title: `${r.no} · ${r.title}`, body: null, href });
    await notifyTelegram(this.prisma, { userIds: [providerUserId] }, 'marketAward', { no: r.no, title: r.title.slice(0, 200), url: webUrl(href) });
  }
}
