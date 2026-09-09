import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, NotFoundException, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { REGIONS, REGION_LABELS, URGENT_KINDS, URGENT_KIND_LABELS, formatUrgentNo, normalizeUzPhone, type RegionCode, type UrgentKind } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { env } from '../../common/env';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { esc, sendTelegram } from '../../common/telegram';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
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
const createBucket = new IpBucket(5, 3_600_000); // soatiga 5 ta shoshilinch so'rov
const offerBucket = new IpBucket(20, 3_600_000); // soatiga 20 ta taklif
const limit = (b: IpBucket, userId: string) => { if (!b.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429); };

/** Shoshilinch so'rovlar: egasi yaratadi va taklif tanlaydi, provayder taklif yuboradi, ochiq holat sahifasi narxsiz. */
@ApiTags('urgent')
@Controller('urgent')
export class UrgentController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Post() @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async create(@CurrentUserId() userId: string, @Body() dto: CreateUrgentDto) {
    limit(createBucket, userId);
    const contactPhone = normalizeUzPhone(dto.contactPhone);
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
    void this.notify(r).catch(() => {}); // javobni kutmaydi
    return { ...r, statusUrl: statusUrl(r.statusToken), offers: [] };
  }

  /** scope=mine: mening so'rovlarim (takliflar bilan); scope=provider: mening hududlarimdagi OCHIQ so'rovlar. */
  @Get() @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async list(@CurrentUserId() userId: string, @Query('scope') scope?: string) {
    if (scope === 'provider') return this.providerList(userId);
    const rows = await this.prisma.urgentRequest.findMany({ where: { createdById: userId }, include: { offers: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    const orgs = await this.orgsOf(rows.flatMap((r) => r.offers));
    return { items: rows.map((r) => ({ ...r, statusUrl: statusUrl(r.statusToken), offers: r.offers.map((o) => offerView(o, orgs)) })) };
  }

  @Post(':id/offers') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async offer(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: OfferDto) {
    limit(offerBucket, userId);
    const r = await this.prisma.urgentRequest.findUnique({ where: { id }, select: { status: true, createdById: true } });
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
    return offerView(o, await this.orgsOf([o]));
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
    const rows = await this.prisma.urgentRequest.findMany({
      where: { status: 'OPEN', createdById: { not: userId }, ...(all ? {} : { regionCode: { in: regions } }) },
      include: { offers: { where: { providerUserId: userId } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return {
      items: rows.map(({ statusToken: _t, offers, ...r }) => ({ ...r, myOffer: offers[0] ? offerView(offers[0]) : null })),
      providerOrgIds: ms.map((m) => m.orgId),
    };
  }

  private async owned(userId: string, id: string) {
    const r = await this.prisma.urgentRequest.findUnique({ where: { id }, include: { offers: { select: { id: true, status: true } } } });
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

  /** Hudud va qo'shnilaridagi LOCO_SERVICE/CARRIER/ASSET_OWNER tashkilot egalariga (Telegram bog'langan) xabar. Xato e'tiborsiz. */
  private async notify(r: { id: string; no: string; kind: string; regionCode: string; stationName: string | null; wagonCount: number | null; description: string; createdById: string }) {
    const links = await this.prisma.telegramLink.findMany({
      where: { userId: { not: r.createdById }, user: { memberships: { some: { isOwner: true, org: { kinds: { hasSome: [...PROVIDER_KINDS] }, regionCode: { in: notifyRegions(r.regionCode as RegionCode) } } } } } },
      select: { chatId: true },
    });
    if (!links.length) return;
    const url = `${env.WEB_ORIGIN}/dashboard/urgent/offers?id=${r.id}`;
    const text = [
      `🚨 Shoshilinch so'rov ${r.no}`,
      `${URGENT_KIND_LABELS.uz[r.kind as UrgentKind] ?? r.kind} · ${REGION_LABELS[r.regionCode as RegionCode] ?? r.regionCode}${r.stationName ? `, ${esc(r.stationName)}` : ''}${r.wagonCount ? ` · ${r.wagonCount} vagon` : ''}`,
      '', esc(r.description.slice(0, 300)), '', `Taklif yuborish: ${url}`,
    ].join('\n');
    // Telegram tugmasi faqat https manzilni qabul qiladi: https da Mini App (web_app) tugmasi, localhost da matndagi havola yetarli
    const reply_markup = env.WEB_ORIGIN.startsWith('https://')
      ? { inline_keyboard: [[{ text: 'Taklif yuborish', web_app: { url: `${env.WEB_ORIGIN}/tg/urgent/offers?id=${r.id}` } }]] }
      : undefined;
    await sendTelegram(links.map((l) => l.chatId), text, reply_markup);
  }
}
