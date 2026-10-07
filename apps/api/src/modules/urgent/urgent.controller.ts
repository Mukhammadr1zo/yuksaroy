import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, NotFoundException, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { REGIONS, REGION_LABELS, URGENT_KINDS, URGENT_KIND_LABELS, formatUrgentNo, normalizePhone, type RegionCode, type SearchLang, type UrgentKind } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { env } from '../../common/env';
import { logFanout, sentCounts } from '../../common/fanout';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { notifyBoth } from '../../common/telegram';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { NotificationsService, type NotificationKind } from '../notifications/notifications.service';
import { PROVIDER_KINDS, awardOffers, canUrgentTransition, notifyRegions } from './urgent.rules';

class CreateUrgentDto {
  @IsIn(URGENT_KINDS) kind!: UrgentKind;
  @IsIn(REGIONS) regionCode!: RegionCode;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @IsString() @MaxLength(120) stationName?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) wagonCount?: number;
  @IsString() @Length(5, 2000) description!: string;
  @IsString() @Length(7, 20) contactPhone!: string;
  @IsOptional() @IsString() orgId?: string;
}

class OfferDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000) priceTiyin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_080) etaMinutes?: number;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @IsOptional() @IsString() orgId?: string;
}

class AwardDto {
  @IsString() offerId!: string;
}

type OfferRow = { id: string; requestId: string; providerOrgId: string | null; providerUserId: string; priceTiyin: bigint | null; etaMinutes: number | null; message: string | null; status: string; createdAt: Date };
type OrgRef = { id: string; name: string; slug: string | null; kycStatus: string };
/** BigInt -> Number (JSON); tashkilot nomi bo'lsa qo'shiladi. */
const offerView = (o: OfferRow, orgs: Map<string, OrgRef> = new Map()) => {
  const org = o.providerOrgId ? orgs.get(o.providerOrgId) : undefined;
  return { ...o, priceTiyin: o.priceTiyin == null ? null : Number(o.priceTiyin), providerOrg: org ? { id: org.id, name: org.name, slug: org.slug, kyc: org.kycStatus } : null };
};
const statusUrl = (token: string) => `${env.WEB_ORIGIN}/status/${token}`;
// Har so'rov hududdagi provayderlarga Telegram xabar yuboradi, shuning uchun foydalanuvchi bo'yicha chelak
/**
 * Ijrochi ro'yxatida so'rov qancha turadi. Shoshilinch ish ikki kundan keyin
 * shoshilinch emas; hisobotda 24 soat taklif qilingan edi, lekin tunda yuborilgan
 * so'rov ertasi kuni kechqurun ro'yxatdan tushib, ijrochining ko'ziga tushmay qolardi.
 */
export const URGENT_LIST_HOURS = 48;

const createBucket = new IpBucket(5, 3_600_000); // soatiga 5 ta shoshilinch so'rov
const offerBucket = new IpBucket(20, 3_600_000); // soatiga 20 ta taklif
const limit = (b: IpBucket, userId: string) => { if (!b.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429); };

// Bozor taxtasidagi bilan bitta tur: shoshilinch so'rov ham so'rov-taklif juftligi
const KIND: NotificationKind = 'market';
/**
 * Telegram tugmasining yozuvi, oluvchining tilida. Matn urgentNew shablonida uch tilda,
 * tugma esa shablondan tashqarida turadi: uning so'zi ham shu yerda uch tilda yoziladi.
 */
const OFFER_BTN: Record<SearchLang, string> = { uz: "Taklif yuborish", ru: 'Предложить', en: 'Make an offer' };
/** Ish turi oluvchining tilida. */
const kindLabel = (k: string, l: SearchLang) => URGENT_KIND_LABELS[l][k as UrgentKind] ?? k;
/**
 * Joy: viloyat va stansiya. Vagon soni ataylab yo'q - uning uchun uch tilli so'z
 * ("vagon") hech qayerda yo'q, soni esa odam tugmani bosganda to'liq so'rovda ko'rinadi.
 */
const placeLine = (r: { regionCode: string; stationName: string | null }) =>
  [REGION_LABELS[r.regionCode as RegionCode] ?? r.regionCode, r.stationName?.trim()].filter(Boolean).join(', ');

/** Shoshilinch so'rovlar: egasi yaratadi va taklif tanlaydi, provayder taklif yuboradi, ochiq holat sahifasi narxsiz. */
@ApiTags('urgent')
@Controller('urgent')
export class UrgentController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notifications: NotificationsService) {}

  @Post() @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async create(@CurrentUserId() userId: string, @Body() dto: CreateUrgentDto) {
    limit(createBucket, userId);
    const contactPhone = normalizePhone(dto.contactPhone);
    if (!contactPhone) throw new BadRequestException({ code: 'PHONE_INVALID' });
    const orgId = dto.orgId ? (await this.memberOrgId(userId, dto.orgId)) : null;
    const r = await this.prisma.$transaction(async (tx) => {
      const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('urgent_no_seq')`;
      return tx.urgentRequest.create({
        data: {
          no: formatUrgentNo(Number(nextval)), kind: dto.kind, regionCode: dto.regionCode, lat: dto.lat ?? null, lng: dto.lng ?? null,
          stationName: dto.stationName?.trim() || null, wagonCount: dto.wagonCount ?? null, description: dto.description.trim(), contactPhone,
          createdById: userId, orgId, statusToken: randomBytes(18).toString('base64url'),
        },
      });
    });
    await this.audit.log({ actorId: userId, action: 'urgent.create', entity: 'UrgentRequest', entityId: r.id, meta: { no: r.no, kind: r.kind, regionCode: r.regionCode } });
    // Oluvchilar xabardan OLDIN sanaladi: javob haqiqiy sonni aytadi. Qidiruv yiqilsa fanout o'zi
    // jurnalga yozadi va adminlarni ogohlantiradi, son null. catch oxirgi to'siq: javob 500 bo'lmasin
    const fan = await this.fanout(r).catch(() => null);
    if (fan) void this.notify(r, fan.userIds).catch(() => {}); // javobni kutmaydi
    return { ...r, statusUrl: statusUrl(r.statusToken), offers: [], sentReal: fan?.sentReal ?? null };
  }

  /** scope=mine: mening so'rovlarim (takliflar bilan); scope=provider: mening hududlarimdagi OCHIQ so'rovlar. */
  @Get() @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async list(@CurrentUserId() userId: string, @Query('scope') scope?: string) {
    if (scope === 'provider') return this.providerList(userId);
    const rows = await this.prisma.urgentRequest.findMany({ where: { createdById: userId }, include: { offers: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    // sentReal: tafsilot sahifasi "N ta ijrochiga yuborildi" ni shu ro'yxatdan o'qiydi. Son ishonchsiz bo'lsa null (sentCounts).
    // listed: ijrochilar ro'yxatida hozir ko'rinadimi (providerList bilan bir shart). Sahifa "so'rovingiz
    // ijrochilarga ko'rinib turadi" ni faqat shunda aytadi: yopilgan yoki 48 soatdan eski so'rovda bu yolg'on
    const [orgs, sent] = await Promise.all([this.orgsOf(rows.flatMap((r) => r.offers)), sentCounts(this.prisma, 'UrgentRequest', rows.map((r) => r.id))]);
    const fresh = new Date(Date.now() - URGENT_LIST_HOURS * 3_600_000);
    return {
      items: rows.map((r) => ({
        ...r, statusUrl: statusUrl(r.statusToken), offers: r.offers.map((o) => offerView(o, orgs)),
        sentReal: sent.get(r.id) ?? null, listed: r.status === 'OPEN' && r.createdAt >= fresh,
      })),
    };
  }

  @Post(':id/offers') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async offer(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: OfferDto) {
    limit(offerBucket, userId);
    const r = await this.prisma.urgentRequest.findUnique({ where: { id }, select: { status: true, createdById: true, no: true, kind: true } });
    if (!r) throw new NotFoundException({ code: 'URGENT_NOT_FOUND' });
    if (r.status !== 'OPEN') throw new ConflictException({ code: 'URGENT_NOT_OPEN', status: r.status });
    if (r.createdById === userId) throw new ForbiddenException({ code: 'OWN_REQUEST' });
    const dup = await this.prisma.urgentOffer.findFirst({ where: { requestId: id, providerUserId: userId }, select: { id: true } });
    if (dup) throw new ConflictException({ code: 'OFFER_EXISTS', offerId: dup.id });
    // Taklif faqat provayder turidagi (CARRIER/ASSET_OWNER/LOCO_SERVICE) tashkilot a'zosidan
    const providerOrgId = (await this.prisma.membership.findFirst({
      where: { userId, ...(dto.orgId ? { orgId: dto.orgId } : {}), org: { kinds: { hasSome: [...PROVIDER_KINDS] } } }, select: { orgId: true },
    }))?.orgId;
    if (!providerOrgId) throw new ForbiddenException({ code: 'NOT_PROVIDER' });
    const o = await this.prisma.urgentOffer.create({
      data: { requestId: id, providerOrgId, providerUserId: userId, priceTiyin: dto.priceTiyin == null ? null : BigInt(dto.priceTiyin), etaMinutes: dto.etaMinutes ?? null, message: dto.message?.trim() || null },
    });
    await this.audit.log({ actorId: userId, action: 'urgent.offer', entity: 'UrgentOffer', entityId: o.id, meta: { requestId: id, providerOrgId, priceTiyin: dto.priceTiyin ?? null } });
    const view = offerView(o, await this.orgsOf([o]));
    void this.notifyOffer({ id, no: r.no, kind: r.kind, createdById: r.createdById }, view.providerOrg?.name ?? null).catch(() => {}); // javobni kutmaydi
    return view;
  }

  @Post(':id/award') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(200)
  async award(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: AwardDto) {
    const r = await this.owned(userId, id);
    if (!canUrgentTransition(r.status, 'AWARDED')) throw new ConflictException({ code: 'URGENT_TRANSITION', from: r.status, to: 'AWARDED' });
    const changes = awardOffers(r.offers, dto.offerId);
    if (!changes) throw new ConflictException({ code: 'OFFER_NOT_SENT' });
    await this.prisma.$transaction([
      ...changes.map((c) => this.prisma.urgentOffer.update({ where: { id: c.id }, data: { status: c.status } })),
      this.prisma.urgentRequest.update({ where: { id }, data: { status: 'AWARDED', awardedOfferId: dto.offerId } }),
    ]);
    await this.audit.log({ actorId: userId, action: 'urgent.award', entity: 'UrgentRequest', entityId: id, meta: { offerId: dto.offerId } });
    // Taklif egalari: g'olib bitta, qolgan SENT lar DECLINED bo'ldi (awardOffers)
    const byId = new Map(r.offers.map((o) => [o.id, o.providerUserId]));
    const winnerUserId = byId.get(dto.offerId);
    const declinedUserIds = [...new Set(changes.filter((c) => c.status === 'DECLINED').map((c) => byId.get(c.id)).filter((x): x is string => !!x))];
    if (winnerUserId) void this.notifyAward(r, winnerUserId, declinedUserIds).catch(() => {}); // javobni kutmaydi
    return this.mineOne(id);
  }

  @Post(':id/close') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(200)
  async close(@CurrentUserId() userId: string, @Param('id') id: string) {
    const r = await this.owned(userId, id);
    if (!canUrgentTransition(r.status, 'CLOSED')) throw new ConflictException({ code: 'URGENT_TRANSITION', from: r.status, to: 'CLOSED' });
    await this.prisma.urgentRequest.update({ where: { id }, data: { status: 'CLOSED' } });
    await this.audit.log({ actorId: userId, action: 'urgent.close', entity: 'UrgentRequest', entityId: id });
    return this.mineOne(id);
  }

  /** Ochiq holat sahifasi: narx yo'q, telefon yo'q. */
  @Get('status/:token')
  async status(@Param('token') token: string) {
    const r = await this.prisma.urgentRequest.findUnique({ where: { statusToken: token }, include: { offers: { select: { id: true, status: true, createdAt: true, providerOrgId: true }, orderBy: { createdAt: 'asc' } } } });
    if (!r) throw new NotFoundException({ code: 'URGENT_NOT_FOUND' });
    const awarded = r.offers.find((o) => o.id === r.awardedOfferId);
    const provider = awarded?.providerOrgId ? await this.prisma.organization.findUnique({ where: { id: awarded.providerOrgId }, select: { name: true, slug: true } }) : null;
    // ponytail: awardedAt saqlanmaydi, holat o'zgargan vaqt = updatedAt
    const timeline = [
      { at: r.createdAt, event: 'created' },
      ...r.offers.map((o) => ({ at: o.createdAt, event: 'offer' })),
      ...(r.status !== 'OPEN' ? [{ at: r.updatedAt, event: r.status.toLowerCase() }] : []),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    return { no: r.no, kind: r.kind, regionCode: r.regionCode, stationName: r.stationName, wagonCount: r.wagonCount, status: r.status, awardedProvider: provider, offers: r.offers.length, timeline, createdAt: r.createdAt };
  }

  private async providerList(userId: string) {
    const ms = await this.prisma.membership.findMany({ where: { userId, org: { kinds: { hasSome: [...PROVIDER_KINDS] } } }, select: { orgId: true, org: { select: { regionCode: true } } } });
    if (!ms.length) return { items: [], providerOrgIds: [] };
    // ponytail: hududi kiritilmagan tashkilot hamma so'rovni ko'radi
    const all = ms.some((m) => !m.org.regionCode);
    const regions = [...new Set(ms.flatMap((m) => (m.org.regionCode ? notifyRegions(m.org.regionCode as RegionCode) : [])))];
    // Shoshilinch ish ikki kundan keyin shoshilinch emas: egasi yopishni unutgan so'rov
    // ro'yxatni to'ldirib, ijrochini o'lik qatorlarga qo'ng'iroq qilishga majburlardi.
    // Holat o'zgarmaydi: egasi uni o'z kabinetida ko'radi.
    const fresh = new Date(Date.now() - URGENT_LIST_HOURS * 3_600_000);
    const rows = await this.prisma.urgentRequest.findMany({
      // "OCHIQ yoki men taklif bergan": taklif tanlangach so'rov AWARDED bo'ladi va
      // faqat OPEN sharti bilan u ro'yxatdan butunlay chiqib ketardi, ya'ni g'olib
      // "Taklifingiz tanlandi" xabaridagi havolani bosib so'rovni ham, buyurtmachining
      // raqamini ham topmasdi. O'zim taklif bergan qator muddatdan va hududdan
      // qat'i nazar qoladi: u menga tegishli ish.
      where: {
        OR: [
          { status: 'OPEN', createdAt: { gte: fresh }, ...(all ? {} : { regionCode: { in: regions } }) },
          { offers: { some: { providerUserId: userId } } },
        ],
        createdById: { not: userId },
      },
      include: { offers: { where: { providerUserId: userId } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return {
      items: rows.map(({ statusToken: _t, offers, ...r }) => ({ ...r, myOffer: offers[0] ? offerView(offers[0]) : null })),
      providerOrgIds: ms.map((m) => m.orgId),
    };
  }

  private async owned(userId: string, id: string) {
    // providerUserId: taklif tanlanganda g'olibga va rad etilganlarga xabar shu yerdan boradi
    const r = await this.prisma.urgentRequest.findUnique({ where: { id }, include: { offers: { select: { id: true, status: true, providerUserId: true } } } });
    if (!r) throw new NotFoundException({ code: 'URGENT_NOT_FOUND' });
    if (r.createdById !== userId) throw new ForbiddenException({ code: 'NOT_OWNER' });
    return r;
  }

  private async mineOne(id: string) {
    const r = await this.prisma.urgentRequest.findUniqueOrThrow({ where: { id }, include: { offers: { orderBy: { createdAt: 'asc' } } } });
    const orgs = await this.orgsOf(r.offers);
    return { ...r, statusUrl: statusUrl(r.statusToken), offers: r.offers.map((o) => offerView(o, orgs)) };
  }

  private async memberOrgId(userId: string, orgId: string): Promise<string> {
    const m = await this.prisma.membership.findFirst({ where: { userId, orgId }, select: { orgId: true } });
    if (!m) throw new ForbiddenException({ code: 'NOT_MEMBER' });
    return m.orgId;
  }

  private async orgsOf(offers: { providerOrgId: string | null }[]): Promise<Map<string, OrgRef>> {
    const ids = [...new Set(offers.map((o) => o.providerOrgId).filter((x): x is string => !!x))];
    if (!ids.length) return new Map();
    const rows = await this.prisma.organization.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true, kycStatus: true } });
    return new Map(rows.map((o) => [o.id, o]));
  }

  /**
   * Kim oladi: hudud va qo'shnilaridagi LOCO_SERVICE/CARRIER/ASSET_OWNER tashkilot a'zolari.
   *
   * Yuk bilan bitta qoida (market.service fanout): egasi ham, dispetcher ham; hududi kiritilmagan
   * tashkilot butun mamlakatdan oladi, ijrochi ro'yxati (providerList) ham unga hammasini ko'rsatadi.
   * Ilgari faqat egasi va faqat hududi to'g'ri kelgan tashkilot olardi: dispetcher shoshilinch
   * so'rovni ro'yxatda ko'rsa ham, xabarini olmasdi. Namuna tashkilot va bloklangan hisob sanalmaydi.
   *
   * Yaratish paytida, xabardan OLDIN: javob haqiqiy sonni qaytaradi, jurnal ham shu yerda (logFanout,
   * qidiruv yiqilsa ham).
   */
  private fanout(r: { id: string; no: string; kind: string; regionCode: string; stationName: string | null; createdById: string }) {
    return logFanout(this.prisma, this.notifications, {
      entity: 'UrgentRequest', id: r.id, no: r.no, createdById: r.createdById,
      board: 'URGENT', region: r.regionCode, type: r.kind, what: (l) => kindLabel(r.kind, l), where: placeLine(r),
      find: async () => {
        const ms = await this.prisma.membership.findMany({
          where: {
            userId: { not: r.createdById }, user: { isActive: true },
            org: { isDemo: false, kinds: { hasSome: [...PROVIDER_KINDS] }, OR: [{ regionCode: { in: notifyRegions(r.regionCode as RegionCode) } }, { regionCode: null }] },
          },
          select: { userId: true },
          take: 500,
        });
        return [...new Set(ms.map((m) => m.userId))];
      },
    });
  }

  /**
   * Xabar fanout topgan ijrochilarga. Xato e'tiborsiz.
   *
   * Ilgari bu yerda TelegramLink to'g'ridan-to'g'ri o'qilardi, ya'ni botni bog'lamagan
   * ijrochi shoshilinch so'rovni umuman ko'rmasdi. Endi notifyBoth: saytdagi qo'ng'iroq
   * ham qo'yiladi, matn esa oluvchining tilida ketadi.
   */
  private async notify(r: { id: string; no: string; kind: string; regionCode: string; stationName: string | null; description: string; createdById: string }, userIds: string[]) {
    if (!userIds.length) return;
    // Telegram tugmasi faqat https manzilni qabul qiladi: https da Mini App (web_app) tugmasi, localhost da matndagi havola yetarli
    // Tugma funksiya: oluvchilar til bo'yicha guruhlanadi, demak matn o'z tilida ketadi.
    // Qotirilgan bitta tugma bo'lsa rus yoki ingliz ijrochi ruscha matn ostida o'zbekcha
    // tugma ko'rardi, ya'ni aralash tilli xabar chiqardi.
    const replyMarkup = env.WEB_ORIGIN.startsWith('https://')
      ? (l: SearchLang) => ({ inline_keyboard: [[{ text: OFFER_BTN[l], web_app: { url: `${env.WEB_ORIGIN}/tg/urgent/offers?id=${r.id}` } }]] })
      : undefined;
    const where = placeLine(r);
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds, exceptUserId: r.createdById },
      kind: 'urgentNew',
      inApp: KIND,
      href: `/dashboard/urgent/offers?id=${r.id}`,
      vars: (l) => ({ no: r.no, what: kindLabel(r.kind, l), where, message: r.description.slice(0, 300) }),
      replyMarkup,
    });
  }

  /**
   * Taklif keldi: so'rov egasiga. Bu xabarsiz odam saytni o'zi qayta-qayta ochib
   * tekshirishga majbur bo'ladi, shoshilinch so'rovda esa u shunchaki telefon kutadi.
   */
  private async notifyOffer(r: { id: string; no: string; kind: string; createdById: string }, from: string | null) {
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [r.createdById] },
      kind: 'urgentOffer',
      inApp: KIND,
      href: `/dashboard/urgent/${r.id}`,
      vars: (l) => ({ no: r.no, what: kindLabel(r.kind, l), from: from ?? '' }),
    });
  }

  /**
   * Taklif tanlandi: g'olibga va qolganlarga. Rad javobi ham yuboriladi, chunki
   * tanlanmagan ijrochi jimlikni "hali qaror yo'q" deb o'qib, resursini bo'sh ushlab turadi.
   */
  private async notifyAward(r: { id: string; no: string; kind: string }, winnerUserId: string, declinedUserIds: string[]) {
    // ponytail: ijrochi uchun alohida tafsilot sahifasi yo'q, shuning uchun havola uning
    // o'z taxtasiga boradi; qaror esa xabarning o'zida yozilgan. Ijrochiga ham tafsilot
    // sahifasi kerak bo'lsa, GET /urgent/:id ijrochi uchun ochiladi va havola o'zgaradi.
    const href = `/dashboard/urgent/offers?id=${r.id}`;
    const vars = (l: SearchLang) => ({ no: r.no, what: kindLabel(r.kind, l) });
    await Promise.all([
      notifyBoth(this.prisma, this.notifications, { target: { userIds: [winnerUserId] }, kind: 'urgentAward', inApp: KIND, href, vars }),
      declinedUserIds.length
        ? notifyBoth(this.prisma, this.notifications, { target: { userIds: declinedUserIds }, kind: 'urgentDeclined', inApp: KIND, href, vars })
        : null,
    ]);
  }
}
