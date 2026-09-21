import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, Inject, NotFoundException, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { MARKET, MARKET_BOARDS, MARKET_STATUSES, REGIONS, SERVICE_TYPES, TRUCK_TYPES, normalizeUzPhone, type MarketBoard, type MarketStatus } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { clampInt } from '../catalog/presentation/catalog.controller';
import { CurrentUserId, JwtGuard, optionalUserId, readAccessToken } from '../identity/presentation/jwt.guard';
import { TokenService } from '../identity/application/token.service';
import { SESSION_STORE, USER_REPOSITORY, type SessionStore, type UserRepository } from '../identity/domain/ports';
import { canMarketTransition, formatMarketNo, offerDenial, staleBefore, validateRequest } from './market.rules';
import { MarketService, offerView, requestView } from './market.service';

class CreateRequestDto {
  @IsIn(MARKET_BOARDS) board!: MarketBoard;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(20) serviceType?: string;
  @IsOptional() @IsString() @MaxLength(10) regionCode?: string;
  @IsOptional() @IsString() @MaxLength(10) fromRegion?: string;
  @IsOptional() @IsString() @MaxLength(10) toRegion?: string;
  @IsOptional() @IsString() @MaxLength(300) fromText?: string;
  @IsOptional() @IsString() @MaxLength(300) toText?: string;
  @IsOptional() @IsString() @MaxLength(200) cargoName?: string;
  @IsOptional() @IsNumber() weightT?: number;
  @IsOptional() @IsString() @MaxLength(10) loadDate?: string;
  @IsOptional() @IsString() @MaxLength(20) truckType?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsString() orgId?: string;
}

class OfferDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000) priceTiyin?: number;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @IsOptional() @IsString() orgId?: string;
}

class AwardDto {
  @IsString() offerId!: string;
}

// Har so'rov hududdagi ta'minotchilarga xabar yuboradi: chelak foydalanuvchi bo'yicha
const createBucket = new IpBucket(MARKET.requestsPerHour, 3_600_000);
const offerBucket = new IpBucket(MARKET.offersPerHour, 3_600_000);
const limit = (b: IpBucket, userId: string) => { if (!b.take(userId)) throw new HttpException({ code: 'RATE_LIMITED' }, 429); };
const inList = (list: readonly string[], v: string | undefined) => (v && list.includes(v) ? v : undefined);
/** Ro'yxatda ko'rinadigan so'rov: ochiq va eskirmagan. */
const visible = (now = new Date()) => ({ status: 'OPEN', createdAt: { gte: staleBefore(now) } });

/**
 * Bozor so'rovlari: yuk e'lonlari (CARGO) va xizmat so'rovlari (SERVICE) bitta hayot siklida.
 * Telefon raqami hech qachon ochiq javobda yo'q: faqat hasPhone, raqamning o'zi GET /contacts/request/:id.
 */
@ApiTags('market')
@Controller('market')
export class MarketController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly market: MarketService,
    private readonly tokens: TokenService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}

  /** Ochiq taxta: faqat OPEN va 30 kundan yangi; filtrlar taxtaga qarab. */
  @Get('requests')
  async list(
    @Query('board') board?: string, @Query('type') type?: string, @Query('from') from?: string, @Query('to') to?: string,
    @Query('region') region?: string, @Query('truckType') truckType?: string, @Query('page') page?: string, @Query('limit') lim?: string,
  ) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(lim, 20, 1, MARKET.listTake);
    const where: Prisma.MarketRequestWhereInput = {
      ...visible(),
      ...(inList(MARKET_BOARDS, board) ? { board } : {}),
      ...(inList(SERVICE_TYPES, type) ? { serviceType: type } : {}),
      ...(inList(REGIONS, from) ? { fromRegion: from } : {}),
      ...(inList(REGIONS, to) ? { toRegion: to } : {}),
      ...(inList(REGIONS, region) ? { OR: [{ regionCode: region }, { fromRegion: region }, { toRegion: region }] } : {}),
      ...(inList(TRUCK_TYPES, truckType) ? { truckType } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.marketRequest.count({ where }),
      this.prisma.marketRequest.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take, include: { _count: { select: { offers: true } } } }),
    ]);
    return { items: rows.map(({ _count, ...r }) => requestView(r, _count.offers)), total, page: p, limit: take };
  }

  /**
   * Mening so'rovlarim, takliflari bilan. `mine` yo'li `:no` dan oldin turishi shart.
   * Sahifalanadi: kabinet egasi uchun yagona boshqaruv joyi, 100 dan eski ochiq so'rov ko'rinmay qolmasin.
   */
  @Get('requests/mine') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async mine(@CurrentUserId() userId: string, @Query('page') page?: string, @Query('limit') lim?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(lim, 20, 1, MARKET.listTake);
    const where = { createdById: userId };
    const [total, rows] = await Promise.all([
      this.prisma.marketRequest.count({ where }),
      this.prisma.marketRequest.findMany({ where, include: { offers: { orderBy: { createdAt: 'asc' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take }),
    ]);
    const offers = rows.flatMap((r) => r.offers);
    const [orgs, users] = await Promise.all([this.market.orgsOf(offers), this.market.namesOf(offers.map((o) => o.providerUserId))]);
    return { items: rows.map(({ offers, ...r }) => ({ ...requestView(r, offers.length, true), offers: offers.map((o) => offerView(o, orgs, users)) })), total, page: p, limit: take };
  }

  /** Men yuborgan takliflar, so'rov qisqacha bilan. Sahifalanadi. */
  @Get('offers/mine') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async myOffers(@CurrentUserId() userId: string, @Query('page') page?: string, @Query('limit') lim?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(lim, 20, 1, MARKET.listTake);
    const where = { providerUserId: userId };
    const [total, rows] = await Promise.all([
      this.prisma.marketOffer.count({ where }),
      this.prisma.marketOffer.findMany({ where, include: { request: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take }),
    ]);
    return { items: rows.map(({ request, ...o }) => ({ ...offerView(o), request: requestView(request, 0) })), total, page: p, limit: take };
  }

  /**
   * Bitta so'rov raqami bo'yicha. Yopiq yoki eskirgan so'rov ham ochiladi (havola Telegramdan keladi),
   * ro'yxatdan tushgani sahifadan tushgani emas. Egasi bo'lsa takliflar va telefon ham qaytadi.
   */
  @Get('requests/:no')
  async one(@Req() req: FastifyRequest, @Param('no') no: string) {
    const r = await this.prisma.marketRequest.findUnique({ where: { no }, include: { offers: { orderBy: { createdAt: 'asc' } } } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    const userId = optionalUserId(req, this.tokens);
    const { offers, ...row } = r;
    // Egasining ko'rinishi (telefon, takliflar) uchun imzo yetarli emas: chiqib ketgan sessiya ham JwtGuard kabi rad etiladi
    if (userId !== r.createdById || !(await this.sessionAlive(req))) {
      // Taklif bergan odam o'z taklifini ko'rsin: forma o'rniga "yuborilgan" holati chiqadi
      const my = userId ? offers.find((o) => o.providerUserId === userId) : undefined;
      return { ...requestView(row, offers.length), myOffer: my ? offerView(my) : null };
    }
    const [orgs, users] = await Promise.all([this.market.orgsOf(offers), this.market.namesOf(offers.map((o) => o.providerUserId))]);
    return { ...requestView(row, offers.length, true), offers: offers.map((o) => offerView(o, orgs, users)), myOffer: null };
  }

  @Post('requests') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async create(@CurrentUserId() userId: string, @Body() dto: CreateRequestDto) {
    limit(createBucket, userId);
    const errors = validateRequest(dto);
    const contactPhone = dto.contactPhone?.trim() ? normalizeUzPhone(dto.contactPhone) : null;
    if (dto.contactPhone?.trim() && !contactPhone) errors.contactPhone = 'INVALID';
    if (Object.keys(errors).length) throw new BadRequestException({ code: 'VALIDATION', errors });
    const orgId = await this.market.memberOrgId(userId, dto.orgId);
    const cargo = dto.board === 'CARGO';
    const r = await this.prisma.$transaction(async (tx) => {
      const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('market_no_seq')`;
      return tx.marketRequest.create({
        data: {
          no: formatMarketNo(dto.board, Number(nextval)), board: dto.board,
          title: dto.title!.trim(), description: dto.description!.trim(), contactPhone, createdById: userId, orgId,
          statusToken: randomBytes(16).toString('hex'),
          // SERVICE: tur + viloyat; CARGO: yo'nalish (regionCode = yuklash viloyati, bitta filtr bilan qidirish uchun)
          serviceType: cargo ? null : dto.serviceType!, regionCode: cargo ? dto.fromRegion! : dto.regionCode!,
          fromRegion: cargo ? dto.fromRegion! : null, toRegion: cargo ? dto.toRegion! : null,
          fromText: cargo ? dto.fromText?.trim() || null : null, toText: cargo ? dto.toText?.trim() || null : null,
          cargoName: cargo ? dto.cargoName!.trim() : null, weightT: cargo ? dto.weightT! : null,
          loadDate: cargo ? new Date(`${dto.loadDate}T00:00:00Z`) : null, truckType: cargo ? dto.truckType || null : null,
        },
      });
    });
    await this.audit.log({ actorId: userId, action: 'market.request.create', entity: 'MarketRequest', entityId: r.id, meta: { no: r.no, board: r.board } });
    void this.market.notifyNew(r).catch(() => {}); // javobni kutmaydi
    return { ...requestView(r, 0, true), offers: [] };
  }

  @Post('requests/:id/offers') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(201)
  async offer(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: OfferDto) {
    limit(offerBucket, userId);
    const r = await this.prisma.marketRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    const denial = offerDenial(r, userId, r.board === 'SERVICE' ? await this.market.activeServiceTypes(userId) : []);
    if (denial === 'NOT_OPEN') throw new ConflictException({ code: 'REQUEST_NOT_OPEN', status: r.status });
    if (denial) throw new ForbiddenException({ code: denial });
    const providerOrgId = await this.market.memberOrgId(userId, dto.orgId);
    let o;
    try {
      // Taklif so'rov orqali yoziladi: OPEN sharti yozuv bilan bitta so'rovda tekshiriladi, yuqoridagi o'qish bilan
      // orada egasi tanlab qo'ygan bo'lsa, tanlangan so'rovga SENT taklif kirib qolmaydi
      const { offers } = await this.prisma.marketRequest.update({
        where: { id, status: 'OPEN' },
        data: { offers: { create: { providerUserId: userId, providerOrgId, priceTiyin: dto.priceTiyin == null ? null : BigInt(dto.priceTiyin), message: dto.message?.trim() || null } } },
        select: { offers: { where: { providerUserId: userId } } },
      });
      o = offers[0]!;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Noyoblik: bir so'rovga bir odamdan bitta taklif
        if (e.code === 'P2002') throw new ConflictException({ code: 'OFFER_EXISTS' });
        // So'rov yozuv paytida OPEN emas edi
        if (e.code === 'P2025') throw new ConflictException({ code: 'REQUEST_NOT_OPEN' });
      }
      throw e;
    }
    await this.audit.log({ actorId: userId, action: 'market.offer', entity: 'MarketOffer', entityId: o.id, meta: { requestId: id, priceTiyin: dto.priceTiyin ?? null } });
    const [orgs, users] = await Promise.all([this.market.orgsOf([o]), this.market.namesOf([userId])]);
    const view = offerView(o, orgs, users);
    void this.market.notifyOffer(r, view.providerName).catch(() => {});
    return view;
  }

  @Post('requests/:id/award') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(200)
  async award(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: AwardDto) {
    const r = await this.owned(userId, id);
    if (!canMarketTransition(r.status, 'AWARDED')) throw new ConflictException({ code: 'MARKET_TRANSITION', from: r.status, to: 'AWARDED' });
    const winner = r.offers.find((o) => o.id === dto.offerId);
    if (!winner || winner.status !== 'SENT') throw new ConflictException({ code: 'OFFER_NOT_SENT' });
    // Har yozuv o'qilgan holatga shartlangan: ikki parallel tanlash (yoki tanlash + bekor) faqat bittasi o'tadi.
    // Avval so'rov qatori qulflanadi, keyin takliflar shart bilan (yodda saqlangan ro'yxat emas): orada kelgan taklif ham rad bo'ladi.
    await this.prisma.$transaction(async (tx) => {
      const req = await tx.marketRequest.updateMany({ where: { id, status: r.status }, data: { status: 'AWARDED', awardedOfferId: dto.offerId } });
      if (!req.count) throw new ConflictException({ code: 'MARKET_TRANSITION', from: r.status, to: 'AWARDED' });
      const won = await tx.marketOffer.updateMany({ where: { id: dto.offerId, requestId: id, status: 'SENT' }, data: { status: 'AWARDED' } });
      if (!won.count) throw new ConflictException({ code: 'OFFER_NOT_SENT' });
      await tx.marketOffer.updateMany({ where: { requestId: id, status: 'SENT' }, data: { status: 'DECLINED' } });
    });
    await this.audit.log({ actorId: userId, action: 'market.award', entity: 'MarketRequest', entityId: id, meta: { offerId: dto.offerId } });
    void this.market.notifyAward(r, winner.providerUserId).catch(() => {});
    return this.mineOne(id);
  }

  @Post('requests/:id/close') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(200)
  close(@CurrentUserId() userId: string, @Param('id') id: string) { return this.transition(userId, id, 'CLOSED'); }

  @Post('requests/:id/cancel') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access') @HttpCode(200)
  cancel(@CurrentUserId() userId: string, @Param('id') id: string) { return this.transition(userId, id, 'CANCELLED'); }

  /** Ochiq holat sahifasi (/m/:token): narx yo'q, telefon yo'q. */
  @Get('status/:token')
  async status(@Param('token') token: string) {
    const r = await this.prisma.marketRequest.findUnique({ where: { statusToken: token }, include: { offers: { select: { id: true, status: true, createdAt: true, providerOrgId: true }, orderBy: { createdAt: 'asc' } } } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    const awarded = r.offers.find((o) => o.id === r.awardedOfferId);
    const provider = awarded?.providerOrgId ? await this.prisma.organization.findUnique({ where: { id: awarded.providerOrgId }, select: { name: true, slug: true } }) : null;
    // ponytail: awardedAt saqlanmaydi, holat o'zgargan vaqt = updatedAt
    const timeline = [
      { at: r.createdAt, event: 'created' },
      ...r.offers.map((o) => ({ at: o.createdAt, event: 'offer' })),
      ...(r.status !== 'OPEN' ? [{ at: r.updatedAt, event: r.status.toLowerCase() }] : []),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      no: r.no, board: r.board, title: r.title, status: r.status, serviceType: r.serviceType, regionCode: r.regionCode,
      fromRegion: r.fromRegion, toRegion: r.toRegion, cargoName: r.cargoName, weightT: r.weightT, loadDate: r.loadDate,
      awarded: !!awarded, awardedProvider: provider, offers: r.offers.length, timeline, createdAt: r.createdAt, isDemo: r.isDemo,
    };
  }

  private async transition(userId: string, id: string, to: MarketStatus) {
    const r = await this.owned(userId, id);
    if (!canMarketTransition(r.status, to)) throw new ConflictException({ code: 'MARKET_TRANSITION', from: r.status, to });
    // Yozuv o'qilgan holatga shartlangan: orada tanlash o'tib ketgan bo'lsa AWARDED -> CANCELLED bo'lib qolmaydi
    const { count } = await this.prisma.marketRequest.updateMany({ where: { id, status: r.status }, data: { status: to } });
    if (!count) throw new ConflictException({ code: 'MARKET_TRANSITION', from: r.status, to });
    await this.audit.log({ actorId: userId, action: `market.${to.toLowerCase()}`, entity: 'MarketRequest', entityId: id });
    return this.mineOne(id);
  }

  /** JwtGuard bilan bir xil tekshiruv, faqat xato o'rniga false: foydalanuvchi faol va sessiya (sid) bekor qilinmagan. */
  private async sessionAlive(req: FastifyRequest): Promise<boolean> {
    let claims: { sub: string; sid?: string };
    try { claims = this.tokens.verifyAccess(readAccessToken(req) ?? ''); } catch { return false; }
    const u = await this.users.findById(claims.sub);
    if (!u?.isActive) return false;
    if (!claims.sid) return true;
    const s = await this.sessions.findById(claims.sid);
    return !!s && !s.revokedAt;
  }

  private async owned(userId: string, id: string) {
    const r = await this.prisma.marketRequest.findUnique({ where: { id }, include: { offers: { select: { id: true, status: true, providerUserId: true } } } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    if (r.createdById !== userId) throw new ForbiddenException({ code: 'NOT_OWNER' });
    return r;
  }

  private async mineOne(id: string) {
    const { offers, ...r } = await this.prisma.marketRequest.findUniqueOrThrow({ where: { id }, include: { offers: { orderBy: { createdAt: 'asc' } } } });
    const [orgs, users] = await Promise.all([this.market.orgsOf(offers), this.market.namesOf(offers.map((o) => o.providerUserId))]);
    return { ...requestView(r, offers.length, true), offers: offers.map((o) => offerView(o, orgs, users)) };
  }
}

/** Admin filtrlarida ishlatiladi: noto'g'ri holat nomi Prisma xatosi bermasin. */
export const marketStatus = (v: string | undefined) => inList(MARKET_STATUSES, v);
