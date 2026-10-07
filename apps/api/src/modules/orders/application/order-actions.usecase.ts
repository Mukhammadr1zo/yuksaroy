import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  BOOKING, ORDER_EVENT_STATUSES, ORDER_STUCK_DAYS, TransitionError, assertOrderTransition, customerCloseAt, orderIdleSince,
  type Actor, type OrderEventCode, type OrderStatus,
} from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import { notifyBoth, type NotifyKind } from '../../../common/telegram';
import { NotificationsService } from '../../notifications/notifications.service';
import { BOOKING_REPOSITORY, type BookingRepository } from '../../booking/domain/ports';
import { ORDER_REPOSITORY, OrderStaleError, type OrderRecord, type OrderRepository } from '../domain/ports';
import { OrderAccess } from './order-access';
import { IssueDocumentsUseCase } from '../../documents/application/issue-documents.usecase';

/** Buyurtma o'tishlari (6.5): tasdiq/rad - terminal, bekor va qotganini yopish - mijoz, hodisa/yakun - terminal, muddat - tizim. */
@Injectable()
export class OrderActionsUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository,
    private readonly access: OrderAccess,
    private readonly documents: IssueDocumentsUseCase,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── terminal ──
  async confirm(userId: string, no: string) {
    const o = await this.forTerminal(userId, no);
    const next = await this.move(o, 'CONFIRMED', 'TERMINAL', userId, { confirmedAt: new Date() });
    if (o.slot) await this.bookings.confirm(o.slot.bookingId, new Date()); // held → booked
    this.notifyClient(next, 'orderConfirmed');
    return next;
  }

  async reject(userId: string, no: string, reason: string) {
    const o = await this.forTerminal(userId, no);
    if (!reason?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const next = await this.move(o, 'REJECTED', 'TERMINAL', userId, { closedAt: new Date() }, reason.trim());
    if (o.slot) await this.bookings.release(o.slot.bookingId, 'REJECTED', new Date());
    this.notifyClient(next, 'orderRejected', reason.trim());
    return next;
  }

  /** Hodisa qayd etish (ARRIVED/WEIGHED/…). Birinchi hodisa CONFIRMED → IN_PROGRESS ga o'tkazadi. */
  async addEvent(userId: string, no: string, code: OrderEventCode, payload?: Record<string, unknown>) {
    let o = await this.forTerminal(userId, no);
    if (!ORDER_EVENT_STATUSES.includes(o.status)) throw new ConflictException({ code: 'ORDER_NOT_ACTIVE', status: o.status });
    if (code === 'NO_SHOW') return this.noShow(userId, no);
    // Har hodisa bir marta yoziladi: takrori mijozning yopish muddatini (oxirgi harakat + 7 kun)
    // har safar surardi va terminal haftada bir bosib buyurtmani bahosiz ushlab turardi. Xato emas,
    // jim qaytadi: taxta sahifa yangilangach yozilgan hodisa tugmasini yana faol ko'rsatadi
    if (o.history.some((h) => h.code === code)) return o;
    if (o.status === 'CONFIRMED') o = await this.move(o, 'IN_PROGRESS', 'TERMINAL', userId);
    await this.orders.addHistory(o.id, { code, actorId: userId, actorRole: 'TERMINAL', payload: payload ?? null });
    return (await this.orders.findById(o.id))!;
  }

  async complete(userId: string, no: string) {
    const o = await this.forTerminal(userId, no);
    const next = await this.move(o, 'DONE', 'TERMINAL', userId, { closedAt: new Date() });
    // Akt va to'lov uchun hisob shu yerda tuziladi; xato bo'lsa buyurtma baribir yakunlangan qoladi
    await this.documents.onOrderCompleted(next);
    return next;
  }

  /** Mijoz kelmadi: CONFIRMED → CANCELLED, sabab kodi NO_SHOW, slot bo'shaydi. */
  async noShow(userId: string, no: string) {
    const o = await this.forTerminal(userId, no);
    const next = await this.move(o, 'CANCELLED', 'TERMINAL', userId, { closedAt: new Date() }, 'NO_SHOW', 'NO_SHOW');
    if (o.slot) await this.bookings.release(o.slot.bookingId, 'NO_SHOW', new Date());
    return next;
  }

  // ── mijoz ──
  async cancel(userId: string, no: string, reason?: string) {
    const o = await this.forShipper(userId, no);
    if (o.status === 'CONFIRMED' && o.slot) {
      const hoursLeft = (o.slot.startsAt.getTime() - Date.now()) / 3_600_000;
      if (hoursLeft < BOOKING.cancelBeforeHours) throw new ConflictException({ code: 'CANCEL_TOO_LATE', hoursBefore: BOOKING.cancelBeforeHours });
    }
    const next = await this.move(o, 'CANCELLED', 'CLIENT', userId, { closedAt: new Date() }, reason?.trim() || null);
    if (o.slot) await this.bookings.release(o.slot.bookingId, 'CANCELLED', new Date());
    return next;
  }

  /**
   * Qotgan buyurtmani mijoz o'zi yopadi (egasining 2026-10-06 qarori): CONFIRMED yoki
   * IN_PROGRESS da ORDER_STUCK_DAYS kun harakat bo'lmasa. Maqsad baho: u faqat DONE ga
   * yoziladi, DONE ni esa baholanadigan terminalning o'zi bosardi.
   *
   * Akt va hisob bu yerda TUZILMAYDI (complete() dagi onOrderCompleted yo'q): ishni terminal
   * tasdiqlamagan va uning nomidan hujjat chiqarib bo'lmaydi. Slot ham tegilmaydi, complete()
   * dagi kabi. Bir paytda terminal ham bossa, move() faqat kutilgan holatdan o'tkazadi:
   * ikkinchisi ORDER_STATE_CHANGED oladi.
   */
  async closeStuck(userId: string, no: string, now = new Date()) {
    const o = await this.forShipper(userId, no);
    const at = closeAtOf(o);
    // Holat tekshiruvi o'tish jadvaliga tashlab qo'yilmaydi: u yerdagi mijoz qatorlari vaqtni bilmaydi
    if (!at) throw new ConflictException({ code: 'TRANSITION_NOT_ALLOWED', from: o.status, to: 'DONE' });
    if (now < at) throw new ConflictException({ code: 'CLOSE_TOO_EARLY', closeAt: at });
    const next = await this.move(o, 'DONE', 'CLIENT', userId, { closedAt: now }, 'IDLE_CLOSED');
    // Terminal egalariga: buyurtma ularsiz yopildi, hujjat tuzilmadi va endi baho kelishi mumkin
    void this.prisma.terminal.findUnique({ where: { id: o.terminalId }, select: { orgId: true } })
      .then((t) => notifyBoth(this.prisma, this.notifications, {
        target: { orgIds: [t?.orgId], ownersOnly: true, exceptUserId: userId },
        kind: 'orderClosedByClient',
        inApp: 'orderStatus',
        href: `/dashboard/orders/${o.no}`,
        vars: { no: o.no, terminal: o.terminalName, days: ORDER_STUCK_DAYS },
      }))
      .catch(() => {});
    return next;
  }

  /**
   * Ko'ruvchi mijoz tomonida bo'lsa, buyurtmani qachondan o'zi yopa oladi; aks holda null.
   * Buyurtma sahifasini terminal xodimi ham ochadi: unga null, yo'qsa "yopish" tugmasi va
   * mijozga yozilgan izoh terminalga ham chiqardi.
   */
  async closeAtFor(userId: string, o: OrderRecord): Promise<Date | null> {
    const at = closeAtOf(o);
    return at && (await this.access.shipperOrgIds(userId)).includes(o.shipperOrgId) ? at : null;
  }

  // ── tizim (sweeper) ──
  async expire(orderId: string, bookingId: string | null) {
    const o = await this.orders.findById(orderId);
    if (!o || o.status !== 'PENDING') return;
    try {
      await this.orders.transition(o.id, 'PENDING', 'EXPIRED', { actorRole: 'SYSTEM', reason: 'SLA_TIMEOUT', code: 'EXPIRED' }, { closedAt: new Date() });
    } catch (e) {
      if (e instanceof OrderStaleError) return; // shu orada terminal tasdiqladi
      throw e;
    }
    this.notifyClient(o, 'orderExpired');
    if (bookingId) await this.bookings.release(bookingId, 'EXPIRED', new Date());
  }

  // ── yordamchilar ──
  /** Buyurtmani yaratgan mijozga: saytdagi qo'ng'iroq va Telegram; o'tishni to'xtatmaydi. */
  private notifyClient(o: OrderRecord, kind: NotifyKind, reason?: string) {
    void notifyBoth(this.prisma, this.notifications, {
      target: { userIds: [o.createdById] },
      kind,
      inApp: 'orderStatus',
      href: `/dashboard/orders/${o.no}`,
      vars: { no: o.no, terminal: o.terminalName, reason: reason ?? '' },
    }).catch(() => {});
  }

  private async move(o: OrderRecord, to: OrderStatus, actor: Actor, userId: string, patch?: { confirmedAt?: Date; closedAt?: Date }, reason?: string | null, code?: string) {
    try {
      assertOrderTransition(o.status, to, actor);
      return await this.orders.transition(o.id, o.status, to, { actorId: userId, actorRole: actor, reason: reason ?? null, code: code ?? null }, patch);
    } catch (e) {
      if (e instanceof TransitionError) throw new ConflictException({ code: e.message, from: o.status, to });
      if (e instanceof OrderStaleError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }

  private async forTerminal(userId: string, no: string) {
    const o = await this.get(no);
    if (!(await this.access.isAdmin(userId))) await this.access.assertTerminalOf(userId, o.terminalId);
    return o;
  }

  private async forShipper(userId: string, no: string) {
    const o = await this.get(no);
    const ids = await this.access.shipperOrgIds(userId);
    if (!ids.includes(o.shipperOrgId) && !(await this.access.isAdmin(userId))) throw new ForbiddenException({ code: 'NOT_ORDER_OWNER' });
    return o;
  }

  private async get(no: string) {
    const o = await this.orders.findByNo(no);
    if (!o) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return o;
  }
}

/**
 * Domain dagi yagona qoida (orderIdleSince + customerCloseAt) buyurtma yozuviga qo'llanadi.
 * Hodisa ham, holat o'zgarishi ham tarixga tushadi, shuning uchun oxirgi harakat - tarixning
 * eng kech qatori (tartibga tayanmaydi).
 */
function closeAtOf(o: OrderRecord): Date | null {
  const last = o.history.length ? new Date(Math.max(...o.history.map((h) => h.at.getTime()))) : null;
  return customerCloseAt(o.status, orderIdleSince({ lastActivityAt: last, slotEndsAt: o.slot?.endsAt ?? null, confirmedAt: o.confirmedAt, createdAt: o.createdAt, storageDays: o.storageDays }));
}
