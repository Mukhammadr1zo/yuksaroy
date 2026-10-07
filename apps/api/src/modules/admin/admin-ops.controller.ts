import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { FastifyReply } from 'fastify';
import { ORDER_STATUSES, type OrderStatus } from '@yuksaroy/domain';
import { AuditService } from '../../common/audit.service';
import { BOOKING_REPOSITORY, type BookingRepository } from '../booking/domain/ports';
import { CSV_MAX, sendCsv, type CsvCols } from '../../common/csv';
import { orderByOf, parseIds, type SortAllow } from '../../common/list-sort';
import { PrismaService } from '../../common/prisma.service';
import { stuckOrderIds } from '../../common/stuck-orders';
import { notifyBoth } from '../../common/telegram';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformAdminGuard } from '../organizations/presentation/platform-admin.guard';
import { clampInt } from '../catalog/presentation/catalog.controller';
import { reportWhere, resolveData } from './report-status';
import { URGENT_LIST_HOURS } from '../urgent/urgent.controller';

const ORDER_SELECT = {
  id: true, no: true, status: true, createdAt: true, operation: true, direction: true, wagonCount: true, totalTiyin: true,
  terminal: { select: { id: true, name: true, slug: true } },
  shipperOrg: { select: { id: true, name: true } },
} as const;
type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

/** Tiebreak id, `no` emas: no noyob, lekin tartib qoidasi hamma ro'yxatda bir xil bo'lsin. */
const ORDER_SORT: SortAllow<Prisma.OrderOrderByWithRelationInput> = {
  createdAt: { def: 'desc' }, totalTiyin: { def: 'desc' }, status: { def: 'asc' }, no: { def: 'desc' },
};

const ORDER_CSV: CsvCols<OrderRow> = {
  no: (r) => r.no, status: (r) => r.status, terminal: (r) => r.terminal.name, shipperOrg: (r) => r.shipperOrg.name,
  operation: (r) => r.operation, direction: (r) => r.direction, wagonCount: (r) => r.wagonCount, totalSom: (r) => r.totalTiyin, createdAt: (r) => r.createdAt,
};

class StatusDto {
  @IsString() @MaxLength(30) status!: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class ReasonDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class ContactHandledDto {
  @IsBoolean() handled!: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class ReportDecideDto {
  /** true: shikoyat o'rinli (RESOLVED), false: o'rinsiz (DISMISSED). */
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** Erkin matn qidiruvi uchun qisqartma: bo'sh bo'lsa filtr qo'shilmaydi. */
const like = (v: string) => ({ contains: v, mode: 'insensitive' as const });
/** Ikki xonagacha yaxlitlash: recomputeRating bilan bir xil ko'rinish. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** handled: '0' javobsiz, '1' hal qilingan, boshqasi filtrsiz. Sana bo'sh bo'lishi "yangi" degani. */
export const handledWhere = (v?: string) =>
  (v === '0' ? { handledAt: null } : v === '1' ? { handledAt: { not: null } } : {});

/**
 * Belgilash ham, qaytarish ham shu yerda: qaytarishda uchala ustun birga tozalanadi,
 * aks holda qatorda egasiz izoh qolib ketardi.
 */
export const handledData = (on: boolean, userId: string, note?: string) =>
  (on
    ? { handledAt: new Date(), handledById: userId, handledNote: note?.trim() || null }
    : { handledAt: null, handledById: null, handledNote: null });

/**
 * Platforma egasi uchun kundalik ish paneli: buyurtmani qo'lda qimirlatish,
 * soxta bahoni o'chirish, murojaat qutisi va shoshilinch so'rovlar.
 * Har bir yozuv audit ga tushadi: adminning o'zi ham hisobdor bo'lib qoladi.
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtGuard, PlatformAdminGuard)
@ApiCookieAuth('ys_access')
export class AdminOpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    // NotificationsModule global: shikoyat qarorini yozgan odamga qaytarish uchun
    private readonly notifications: NotificationsService,
    @Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository,
  ) {}

  // ───────────────────────── Buyurtmalar ─────────────────────────

  /** Ro'yxat: raqam bo'yicha qidiruv, holat/terminal/tashkilot filtri; ?sort&dir, ?ids, ?format=csv. */
  @Get('orders')
  async orders(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('terminalId') terminalId?: string,
    @Query('orgId') orgId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('ids') ids?: string,
    @Query('format') format?: string,
    @CurrentUserId() userId?: string,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    const idList = parseIds(ids);
    // STUCK holat emas, filtr: bosh sahifadagi STUCK_ORDERS sanagan buyurtmalar, o'sha ro'yxat bilan.
    // AND ichida: pastdagi ?ids filtri ham id kalitini ishlatadi va uni bosib qolmasin
    const stuck = status === 'STUCK' ? await stuckOrderIds(this.prisma, new Date()) : null;
    const where: Prisma.OrderWhereInput = {
      ...(text ? { no: like(text) } : {}),
      // Noto'g'ri holat nomi Prisma da xato bo'lardi: ro'yxatda bo'lmasa filtr e'tiborsiz qoladi
      ...(stuck ? { AND: [{ id: { in: stuck } }] }
        : status && (ORDER_STATUSES as readonly string[]).includes(status) ? { status: status as OrderStatus } : {}),
      ...(terminalId ? { terminalId } : {}),
      ...(orgId ? { shipperOrgId: orgId } : {}),
      ...(idList ? { id: { in: idList } } : {}),
    };
    const orderBy = orderByOf(sort, dir, ORDER_SORT, 'createdAt');
    if (format === 'csv') {
      return sendCsv({
        reply: reply!, audit: this.audit, actorId: userId!, resource: 'orders', filters: { q, status, terminalId, orgId, ids, sort, dir },
        total: await this.prisma.order.count({ where }),
        rows: () => this.prisma.order.findMany({ where, orderBy, take: CSV_MAX, select: ORDER_SELECT }),
        cols: ORDER_CSV,
      });
    }
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy, skip: (p - 1) * take, take, select: ORDER_SELECT }),
    ]);
    // totalTiyin - BigInt: JSON uni seriallashtira olmaydi, shuning uchun Number ga o'tkaziladi
    return { items: rows.map((o) => ({ ...o, totalTiyin: Number(o.totalTiyin) })), total, page: p, limit: take };
  }

  /** Bitta buyurtma: qatorlari, holat tarixi (yangisi yuqorida) va tomonlari. */
  @Get('orders/:no')
  async order(@Param('no') no: string) {
    const o = await this.prisma.order.findUnique({
      where: { no },
      include: {
        items: true,
        history: { orderBy: { at: 'desc' } },
        terminal: { select: { id: true, name: true, slug: true } },
        shipperOrg: { select: { id: true, name: true } },
      },
    });
    if (!o) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return {
      ...o,
      subtotalTiyin: Number(o.subtotalTiyin),
      commissionTiyin: Number(o.commissionTiyin),
      totalTiyin: Number(o.totalTiyin),
      items: o.items.map((i) => ({ ...i, unitPriceTiyin: Number(i.unitPriceTiyin), amountTiyin: Number(i.amountTiyin) })),
    };
  }

  /**
   * Admin holatni majburan qo'yadi.
   * Bu ataylab assertOrderTransition ni chetlab o'tadi: buyurtma qotib qolganda
   * (terminal javob bermadi, sweeper o'tkazib yubordi) uni qimirlatadigan yagona yo'l shu.
   * Qoida chetlab o'tilgani uchun tekshiruv izi OrderStatusHistory qatori bo'ladi:
   * kim, qachon, qaysi holatdan qaysisiga va nega o'tkazgani o'sha yerda qoladi.
   */
  @Post('orders/:no/status')
  async setStatus(@CurrentUserId() userId: string, @Param('no') no: string, @Body() dto: StatusDto) {
    if (!(ORDER_STATUSES as readonly string[]).includes(dto.status)) throw new BadRequestException({ code: 'BAD_STATUS', allowed: ORDER_STATUSES });
    const to = dto.status as OrderStatus;
    const o = await this.prisma.order.findUnique({ where: { no }, select: { id: true, status: true } });
    if (!o) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    const reason = dto.reason?.trim() || null;
    // Holat va tarix bitta tranzaksiyada: tarixsiz o'zgargan holat kuzatib bo'lmaydigan bo'lib qolardi
    // Yopiluvchi holatlar: buyurtma yakunlanadi va band qilingan joy bo'shashi kerak
    const closing = to === 'CANCELLED' || to === 'REJECTED' || to === 'EXPIRED';
    // Buyurtmani yopish mijoz uchun sezilarli va qaytarib bo'lmaydigan amal. Sababsiz yopilsa
    // oylar o'tib nizo chiqqanda tarixda "reason: null" turadi va hech kim nega yopilganini
    // ayta olmaydi. Qoidani chetlab o'tishning yagona izi shu sabab.
    if (closing && !reason) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: o.id }, data: { status: to, ...(closing || to === 'DONE' ? { closedAt: new Date() } : {}), ...(to === 'CONFIRMED' ? { confirmedAt: new Date() } : {}) } }),
      this.prisma.orderStatusHistory.create({
        data: { orderId: o.id, fromStatus: o.status, toStatus: to, actorId: userId, actorRole: 'PLATFORM_ADMIN', reason },
      }),
    ]);
    // Slot holati buyurtma holatiga ergashishi shart:
    //  - yopilganda bo'shatiladi, aks holda joy abadiy band bo'lib qolardi;
    //  - tasdiqlanganda HOLD tasdiqqa o'tadi, aks holda hold muddati o'tib joy qaytadan
    //    bo'sh ko'rinar va o'sha vaqt ikkinchi mijozga sotilib ketardi.
    const booking = await this.prisma.slotBooking.findFirst({
      where: { orderId: o.id, status: { in: ['HOLD', 'CONFIRMED'] } },
      select: { id: true, status: true },
    });
    if (booking) {
      if (closing) await this.bookings.release(booking.id, 'ADMIN', new Date());
      else if (to === 'CONFIRMED' && booking.status === 'HOLD') await this.bookings.confirm(booking.id, new Date());
    }
    await this.audit.log({ actorId: userId, action: 'admin.order.status', entity: 'Order', entityId: o.id, meta: { from: o.status, to, reason } });
    return { no, status: to, from: o.status };
  }

  // ───────────────────────── Terminal bahalari ─────────────────────────

  /** Ro'yxat: izoh matni yoki buyurtma raqami bo'yicha qidiruv. */
  @Get('reviews')
  async reviews(@Query('q') q?: string, @Query('terminalId') terminalId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    const where = {
      ...(text ? { OR: [{ text: like(text) }, { orderNo: like(text) }] } : {}),
      ...(terminalId ? { terminalId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        include: { terminal: { select: { id: true, name: true, slug: true } }, org: { select: { id: true, name: true } } },
      }),
    ]);
    const names = await this.names(rows.map((r) => r.userId));
    return { items: rows.map((r) => ({ ...r, author: names.get(r.userId) ?? null })), total, page: p, limit: take };
  }

  /**
   * Soxta yoki haqoratli baho o'chiriladi va terminal reytingi qaytadan hisoblanadi.
   * Qayta hisoblash shart: terminal kartochkasi keshlangan ratingAvg/ratingCount ni ko'rsatadi,
   * qator o'chib keshi tegilmasa o'chirilgan baho kartochkada abadiy qolib ketadi.
   * excluded qatorlar reytingga kirmaydi (arms-length qoidasi), shu sababli ular hisobdan tashqarida.
   */
  @Delete('reviews/:id')
  async deleteReview(@CurrentUserId() userId: string, @Param('id') id: string) {
    const r = await this.prisma.review.findUnique({ where: { id }, select: { terminalId: true, rating: true, orderNo: true } });
    if (!r) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    const old = await this.prisma.terminal.findUnique({ where: { id: r.terminalId }, select: { ratingAvg: true, ratingCount: true } });
    const next = await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      const a = await tx.review.aggregate({ where: { terminalId: r.terminalId, excluded: false }, _avg: { rating: true }, _count: { _all: true } });
      const avg = round2(a._avg.rating ?? 0); // qator qolmasa _avg null bo'ladi: 0 ga tushadi
      const count = a._count._all;
      await tx.terminal.update({ where: { id: r.terminalId }, data: { ratingAvg: avg, ratingCount: count } });
      return { avg, count };
    });
    await this.audit.log({
      actorId: userId, action: 'admin.review.delete', entity: 'Review', entityId: id,
      meta: { terminalId: r.terminalId, orderNo: r.orderNo, rating: r.rating, oldAvg: old?.ratingAvg ?? null, oldCount: old?.ratingCount ?? null, ...next },
    });
    return { id, deleted: true, rating: next };
  }

  // ───────────────────────── E'lon izohlari ─────────────────────────

  @Get('listing-reviews')
  async listingReviews(@Query('q') q?: string, @Query('listingId') listingId?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    const where = {
      ...(text ? { OR: [{ text: like(text) }, { listing: { title: like(text) } }] } : {}),
      ...(listingId ? { listingId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.listingReview.count({ where }),
      this.prisma.listingReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        include: { listing: { select: { id: true, title: true, slug: true } } },
      }),
    ]);
    const names = await this.names(rows.map((r) => r.userId));
    return { items: rows.map((r) => ({ ...r, author: names.get(r.userId) ?? null })), total, page: p, limit: take };
  }

  /**
   * Listing ham ratingAvg/ratingCount ni keshlaydi, shuning uchun bu yerda ham qayta hisoblanadi.
   * excluded qatorlar (o'z e'loniga yozilgan eski izoh) hisobdan tashqarida: aks holda
   * birinchi o'chirishdayoq ular reytingga qaytib kirardi. Migratsiya
   * 20261006020000_listing_review_excluded shu formulani SQL da takrorlaydi.
   */
  @Delete('listing-reviews/:id')
  async deleteListingReview(@CurrentUserId() userId: string, @Param('id') id: string) {
    const r = await this.prisma.listingReview.findUnique({ where: { id }, select: { listingId: true, rating: true } });
    if (!r) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    const old = await this.prisma.listing.findUnique({ where: { id: r.listingId }, select: { ratingAvg: true, ratingCount: true } });
    const next = await this.prisma.$transaction(async (tx) => {
      await tx.listingReview.delete({ where: { id } });
      const a = await tx.listingReview.aggregate({ where: { listingId: r.listingId, excluded: false }, _avg: { rating: true }, _count: { _all: true } });
      const avg = round2(a._avg.rating ?? 0);
      const count = a._count._all;
      await tx.listing.update({ where: { id: r.listingId }, data: { ratingAvg: avg, ratingCount: count } });
      return { avg, count };
    });
    await this.audit.log({
      actorId: userId, action: 'admin.listingReview.delete', entity: 'ListingReview', entityId: id,
      meta: { listingId: r.listingId, rating: r.rating, oldAvg: old?.ratingAvg ?? null, oldCount: old?.ratingCount ?? null, ...next },
    });
    return { id, deleted: true, rating: next };
  }

  // ───────────────────────── Murojaat qutisi ─────────────────────────

  /**
   * Yo'l 'contact/all', chunki 'contact/:id' bilan bitta segmentda to'qnashmasin:
   * Nest uni dinamik parametr deb olib, ro'yxat so'rovini o'chirish yo'liga tushirardi.
   */
  @Get('contact/all')
  async contact(@Query('q') q?: string, @Query('handled') handled?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    // Modelda alohida email maydoni yo'q: telefon ham, email ham 'contact' ustunida turadi
    const where = {
      ...handledWhere(handled),
      ...(text ? { OR: [{ name: like(text) }, { contact: like(text) }, { topic: like(text) }, { message: like(text) }] } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p - 1) * take, take }),
    ]);
    // ContactMessage da User ga bog'lanish yo'q: ismni alohida so'rov bilan olamiz
    const ids = [...new Set(items.map((m) => m.handledById).filter((x): x is string => !!x))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, phone: true, fullName: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return { items: items.map((m) => ({ ...m, handledBy: (m.handledById && byId.get(m.handledById)) || null })), total, page: p, limit: take };
  }

  /** Belgilash va qaytarish bitta yo'lda: ikki yo'l bo'lsa ular bir-biridan ayrilib ketardi. */
  @Post('contact/:id/handled')
  async setContactHandled(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ContactHandledDto) {
    // updateMany: yo'q qator uchun update P2025 tashlardi va u 500 bo'lib chiqardi
    const { count } = await this.prisma.contactMessage.updateMany({ where: { id }, data: handledData(dto.handled, userId, dto.note) });
    if (!count) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
    await this.audit.log({ actorId: userId, action: 'admin.contact.handled', entity: 'ContactMessage', entityId: id, meta: { handled: dto.handled } });
    return { id, handled: dto.handled };
  }

  /** Spam yoki haqoratli murojaatni o'chirish. */
  @Delete('contact/:id')
  async deleteContact(@CurrentUserId() userId: string, @Param('id') id: string) {
    const m = await this.prisma.contactMessage.findUnique({ where: { id }, select: { name: true, contact: true, topic: true } });
    if (!m) throw new NotFoundException({ code: 'MESSAGE_NOT_FOUND' });
    await this.prisma.contactMessage.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'admin.contact.delete', entity: 'ContactMessage', entityId: id, meta: m });
    return { id, deleted: true };
  }

  // ──────────────────────── Shikoyatlar ────────────────────────

  /**
   * Ro'yxat: holat filtri (bo'sh = hammasi; panel NEW bilan so'raydi).
   *
   * Tartib qat'iy: yangisidan eskisiga, tenglik id bilan buziladi. Saralash tanlovi
   * ataylab yo'q - bu navbat, jadval emas.
   */
  @Get('reports')
  async reports(
    @Query('status') status?: string,
    @Query('targetKind') targetKind?: string,
    @Query('targetId') targetId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    // targetKind/targetId: e'lon sahifasining Bog'liq yorlig'i shu obyektning shikoyatlarini so'raydi
    const where = { ...reportWhere(status), ...(targetKind ? { targetKind } : {}), ...(targetId ? { targetId } : {}) };
    const [total, items] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (p - 1) * take, take }),
    ]);
    // Report da User ga bog'lanish yo'q (hisob o'chsa qator qolsin): ismlar alohida
    // so'rov bilan olinadi, murojaat qutisidagi bilan aynan bir xil usul
    const ids = [...new Set(items.flatMap((r) => [r.reporterId, r.resolvedById]).filter((x): x is string => !!x))];
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, phone: true, fullName: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: items.map((r) => ({ ...r, reporter: byId.get(r.reporterId) ?? null, resolvedBy: (r.resolvedById && byId.get(r.resolvedById)) || null })),
      total, page: p, limit: take,
    };
  }

  /**
   * Qaror: o'rinli yoki o'rinsiz. Obyektning O'ZINI yashirish bu yerda emas - har
   * turning o'z ekrani va o'z amali bor, ikkinchi nusxa ikkita qoida bo'lib qolardi.
   *
   * Faqat NEW dan: ikki operator barobar bossa ikkinchisi 404 oladi.
   *
   * Qaror shikoyat yozgan odamga QAYTADI. Ilgari u faqat auditga tushardi va yozgan
   * odam natijani hech qachon bilmasdi: javobsiz shikoyat oqimi bir necha oyda o'ladi,
   * ya'ni bitta odam boshqaradigan platforma eng arzon nazorat vositasini yo'qotadi.
   */
  @Post('reports/:id/decide') @HttpCode(200)
  async decideReport(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReportDecideDto) {
    // Avval o'qiladi: xabar uchun nom va havola kerak, updateMany esa qatorni qaytarmaydi
    const r = await this.prisma.report.findUnique({ where: { id }, select: { reporterId: true, targetTitle: true, targetHref: true } });
    if (!r) throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
    const { count } = await this.prisma.report.updateMany({ where: { id, status: 'NEW' }, data: resolveData(dto.approve, userId, dto.note) });
    if (!count) throw new NotFoundException({ code: 'REPORT_NOT_FOUND' });
    await this.audit.log({ actorId: userId, action: 'admin.report.decide', entity: 'Report', entityId: id, meta: { approve: dto.approve } });
    /*
     * Mehmon shikoyat yoza olmaydi (ReportsController butunlay JwtGuard ortida), shuning
     * uchun reporterId doim to'la. Lekin hisob o'chirilgan bo'lishi mumkin: Report qatori
     * ataylab qoladi, Notification esa User ga bog'langan. O'chgan hisobda notifyBoth
     * o'zi jim o'tadi - u qo'ng'iroq matnini tilga ajratish uchun User ni o'qiydi va
     * qator topilmasa hech narsa yozmaydi.
     *
     * ponytail: inApp 'claim' - saytda qo'ng'iroq turini hech kim ko'rsatmaydi va hech
     * joyda filtr ham yo'q (adminTask ham shu turni ishlatadi), yangi tur faqat
     * ro'yxatni uzaytirardi.
     *
     * Havola: /admin bilan boshlansa yuborilmaydi (buyurtma ustidagi shikoyatning
     * targetHref i admin ekrani) - oddiy foydalanuvchi o'sha sahifaga kira olmaydi va
     * havola 403 ga olib borardi. O'rniga o'z kabineti.
     */
    await notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [r.reporterId], exceptUserId: userId },
      kind: dto.approve ? 'reportResolved' : 'reportDismissed',
      inApp: 'claim',
      href: r.targetHref.startsWith('/admin') ? '/dashboard/orders' : r.targetHref,
      vars: { title: r.targetTitle },
    }).catch(() => {});
    return { id, status: dto.approve ? 'RESOLVED' : 'DISMISSED' };
  }

  // ───────────────────────── Shoshilinch so'rovlar ─────────────────────────

  /** Ro'yxat: holat va viloyat filtri, raqam (UR-) bo'yicha qidiruv, har bir so'rov uchun takliflar soni. */
  @Get('urgent')
  async urgent(@Query('status') status?: string, @Query('region') region?: string, @Query('q') q?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    const p = clampInt(page, 1, 1, 10_000);
    const take = clampInt(limit, 30, 1, 100);
    const text = q?.trim();
    // q: buyruq paleti UR-1001 ni shu ro'yxat bilan ochadi
    // NO_OFFERS holat emas, filtr: ijrochilar ro'yxatida hali turgan (48 soat) va taklif olmagan so'rovlar
    const waiting = { status: 'OPEN', createdAt: { gte: new Date(Date.now() - URGENT_LIST_HOURS * 3_600_000) }, offers: { none: {} } };
    const where = { ...(status === 'NO_OFFERS' ? waiting : status ? { status } : {}), ...(region ? { regionCode: region } : {}), ...(text ? { no: like(text) } : {}) };
    const [total, items] = await Promise.all([
      this.prisma.urgentRequest.count({ where }),
      this.prisma.urgentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
        select: {
          id: true, no: true, kind: true, status: true, regionCode: true, stationName: true, wagonCount: true,
          contactPhone: true, createdAt: true, _count: { select: { offers: true } },
        },
      }),
    ]);
    return { items: items.map(({ _count, ...r }) => ({ ...r, offers: _count.offers })), total, page: p, limit: take };
  }

  /** Bitta so'rov va unga kelgan takliflar. */
  @Get('urgent/:id')
  async urgentOne(@Param('id') id: string) {
    const r = await this.prisma.urgentRequest.findUnique({ where: { id }, include: { offers: { orderBy: { createdAt: 'asc' } } } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    // priceTiyin - BigInt: JSON uchun Number ga o'tkaziladi
    return { ...r, offers: r.offers.map((o) => ({ ...o, priceTiyin: o.priceTiyin === null ? null : Number(o.priceTiyin) })) };
  }

  /** Admin so'rovni yopadi: URGENT_STATUSES dan CLOSED (CANCELLED ni so'rov egasi qo'yadi). */
  @Post('urgent/:id/close')
  async closeUrgent(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: ReasonDto) {
    const r = await this.prisma.urgentRequest.findUnique({ where: { id }, select: { no: true, status: true } });
    if (!r) throw new NotFoundException({ code: 'REQUEST_NOT_FOUND' });
    const reason = dto?.reason?.trim() || null;
    await this.prisma.urgentRequest.update({ where: { id }, data: { status: 'CLOSED' } });
    await this.audit.log({ actorId: userId, action: 'admin.urgent.close', entity: 'UrgentRequest', entityId: id, meta: { no: r.no, from: r.status, to: 'CLOSED', reason } });
    return { id, no: r.no, status: 'CLOSED' };
  }

  /** userId -> ko'rsatiladigan ism. Review da User ga relation yo'q, shuning uchun alohida so'rov. */
  private async names(userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map<string, { id: string; fullName: string | null; phone: string }>();
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, phone: true } });
    return new Map(users.map((u) => [u.id, u]));
  }
}
