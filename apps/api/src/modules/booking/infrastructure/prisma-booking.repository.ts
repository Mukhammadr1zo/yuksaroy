import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { uzLocalToUtc } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import {
  CapacityBelowBookedError, HoldExpiredError, HoldNotExtendableError, SlotClosedError, SlotFullError, SlotPastError,
  type BookingRecord, type BookingRepository, type SlotFree, type SlotRecord, type SlotWindowInput,
} from '../domain/ports';

/** localDate DB da `date` - UTC yarim tunda saqlanadi; "2026-09-10" ↔ Date. */
const toDateCol = (d: string) => new Date(`${d}T00:00:00.000Z`);
const fromDateCol = (d: Date) => d.toISOString().slice(0, 10);

type SlotRow = Prisma.TimeSlotGetPayload<object>;
const toSlot = (s: SlotRow): SlotRecord => ({
  id: s.id, terminalId: s.terminalId, localDate: fromDateCol(s.localDate), window: s.window,
  startsAt: s.startsAt, endsAt: s.endsAt, capacity: s.capacity, booked: s.booked, held: s.held, status: s.status,
});
const toBooking = (b: Prisma.SlotBookingGetPayload<object>): BookingRecord => ({
  id: b.id, slotId: b.slotId, userId: b.userId, orgId: b.orgId, orderId: b.orderId,
  status: b.status, holdExpiresAt: b.holdExpiresAt, extendedOnce: b.extendedOnce,
});

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSlots(terminalId: string, fromLocalDate: string, toLocalDate: string, now: Date): Promise<SlotFree[]> {
    const rows = await this.prisma.timeSlot.findMany({
      where: { terminalId, localDate: { gte: toDateCol(fromLocalDate), lte: toDateCol(toLocalDate) }, endsAt: { gt: now } },
      orderBy: [{ localDate: 'asc' }, { window: 'asc' }],
      include: { bookings: { where: { status: 'HOLD', holdExpiresAt: { lt: now } }, select: { id: true } } },
    });
    // Muddati o'tgan hold'lar hali sweeper tomonidan bo'shatilmagan bo'lishi mumkin - ko'rsatishda hisobga olinmaydi
    return rows.map((r) => ({ ...toSlot(r), free: Math.max(0, r.capacity - r.booked - (r.held - r.bookings.length)) }));
  }

  async findSlot(slotId: string) {
    const s = await this.prisma.timeSlot.findUnique({ where: { id: slotId } });
    return s ? toSlot(s) : null;
  }

  async upsertSlots(terminalId: string, dates: string[], windows: SlotWindowInput[]): Promise<number> {
    let n = 0;
    for (const date of dates) {
      for (const w of windows) {
        const startsAt = uzLocalToUtc(date, w.start), endsAt = uzLocalToUtc(date, w.end);
        const existing = await this.prisma.timeSlot.findUnique({ where: { terminalId_localDate_window: { terminalId, localDate: toDateCol(date), window: w.window } } });
        if (existing && w.capacity < existing.booked + existing.held) throw new CapacityBelowBookedError();
        await this.prisma.timeSlot.upsert({
          where: { terminalId_localDate_window: { terminalId, localDate: toDateCol(date), window: w.window } },
          create: { terminalId, localDate: toDateCol(date), window: w.window, startsAt, endsAt, capacity: w.capacity },
          update: { startsAt, endsAt, capacity: w.capacity },
        });
        n++;
      }
    }
    return n;
  }

  async closeSlot(slotId: string, closed: boolean) {
    return toSlot(await this.prisma.timeSlot.update({ where: { id: slotId }, data: { status: closed ? 'CLOSED' : 'OPEN' } }));
  }

  async hold(slotId: string, userId: string, orgId: string | null, ttlMinutes: number, now: Date): Promise<BookingRecord> {
    return this.prisma.$transaction(async (tx) => {
      // Qator qulfi: bir vaqtda kelgan ikki hold sig'imni oshirib yubormasin
      const [slot] = await tx.$queryRaw<SlotRow[]>`SELECT * FROM "TimeSlot" WHERE id = ${slotId} FOR UPDATE`;
      if (!slot) throw new SlotClosedError();
      if (slot.status !== 'OPEN') throw new SlotClosedError();
      if (slot.startsAt <= now) throw new SlotPastError();

      // Shu slotdagi muddati o'tgan hold'lar avval bo'shatiladi
      const stale = await tx.slotBooking.findMany({ where: { slotId, status: 'HOLD', holdExpiresAt: { lt: now } }, select: { id: true } });
      if (stale.length) {
        await tx.slotBooking.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: 'RELEASED', releasedAt: now, releaseReason: 'EXPIRED' } });
        await tx.timeSlot.update({ where: { id: slotId }, data: { held: { decrement: stale.length } } });
      }
      const held = slot.held - stale.length;
      if (slot.booked + held >= slot.capacity) throw new SlotFullError();

      await tx.timeSlot.update({ where: { id: slotId }, data: { held: { increment: 1 } } });
      const b = await tx.slotBooking.create({
        data: { slotId, userId, orgId, status: 'HOLD', holdExpiresAt: new Date(now.getTime() + ttlMinutes * 60_000) },
      });
      return toBooking(b);
    });
  }

  async findBooking(id: string) {
    const b = await this.prisma.slotBooking.findUnique({ where: { id } });
    return b ? toBooking(b) : null;
  }

  async release(bookingId: string, reason: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const b = await tx.slotBooking.findUnique({ where: { id: bookingId } });
      if (!b || b.status === 'RELEASED') return;
      await tx.slotBooking.update({ where: { id: bookingId }, data: { status: 'RELEASED', releasedAt: now, releaseReason: reason } });
      await tx.timeSlot.update({
        where: { id: b.slotId },
        data: b.status === 'HOLD' ? { held: { decrement: 1 } } : { booked: { decrement: 1 } },
      });
    });
  }

  async extend(bookingId: string, ttlMinutes: number, now: Date): Promise<BookingRecord> {
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.slotBooking.findUnique({ where: { id: bookingId } });
      if (!b || b.status !== 'HOLD') throw new HoldExpiredError();
      if (b.holdExpiresAt && b.holdExpiresAt < now) throw new HoldExpiredError();
      if (b.extendedOnce) throw new HoldNotExtendableError();
      return toBooking(await tx.slotBooking.update({
        where: { id: bookingId },
        data: { extendedOnce: true, holdExpiresAt: new Date(now.getTime() + ttlMinutes * 60_000) },
      }));
    });
  }

  async attachOrder(bookingId: string, orderId: string): Promise<void> {
    await this.prisma.slotBooking.update({ where: { id: bookingId }, data: { orderId } });
  }

  async confirm(bookingId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const b = await tx.slotBooking.findUnique({ where: { id: bookingId } });
      if (!b || b.status !== 'HOLD') return; // idempotent
      await tx.slotBooking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', confirmedAt: now, holdExpiresAt: null } });
      await tx.timeSlot.update({ where: { id: b.slotId }, data: { held: { decrement: 1 }, booked: { increment: 1 } } });
    });
  }

  async releaseExpired(now: Date, limit: number): Promise<number> {
    const stale = await this.prisma.slotBooking.findMany({
      where: { status: 'HOLD', holdExpiresAt: { lt: now } }, select: { id: true }, take: limit,
    });
    for (const s of stale) await this.release(s.id, 'EXPIRED', now);
    return stale.length;
  }
}
