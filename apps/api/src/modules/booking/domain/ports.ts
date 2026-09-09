// booking - domen portlari. Framework va Prisma bu faylda yo'q.
import type { BookingStatus, SlotStatus } from '@yuksaroy/domain';

export interface SlotRecord {
  id: string; terminalId: string; localDate: string; window: number;
  startsAt: Date; endsAt: Date; capacity: number; booked: number; held: number; status: SlotStatus;
}
/** Ommaviy ko'rinish: bo'sh joy soni (band va ushlangan ayirilgan). */
export interface SlotFree extends SlotRecord { free: number }

export interface BookingRecord {
  id: string; slotId: string; userId: string; orgId: string | null; orderId: string | null;
  status: BookingStatus; holdExpiresAt: Date | null; extendedOnce: boolean;
}

export interface SlotWindowInput { window: number; start: string; end: string; capacity: number }

export interface BookingRepository {
  /** Ochiq slotlar (bo'sh joyi bilan). Muddati o'tgan hold'lar hisobga olinmaydi. */
  listSlots(terminalId: string, fromLocalDate: string, toLocalDate: string, now: Date): Promise<SlotFree[]>;
  findSlot(slotId: string): Promise<SlotRecord | null>;
  /** Terminal kalendari: davr uchun oynalarni yaratadi/yangilaydi. Sig'imni band qilinganidan past qilib bo'lmaydi. */
  upsertSlots(terminalId: string, dates: string[], windows: SlotWindowInput[]): Promise<number>;
  closeSlot(slotId: string, closed: boolean): Promise<SlotRecord>;

  /**
   * Slotni 1 joyga ushlab turadi (FOR UPDATE): muddati o'tgan hold'lar avval bo'shatiladi,
   * so'ng sig'im tekshiriladi. To'la bo'lsa SlotFullError.
   */
  hold(slotId: string, userId: string, orgId: string | null, ttlMinutes: number, now: Date): Promise<BookingRecord>;
  findBooking(id: string): Promise<BookingRecord | null>;
  /** HOLD → RELEASED (held−1) yoki CONFIRMED → RELEASED (booked−1). */
  release(bookingId: string, reason: string, now: Date): Promise<void>;
  /** Hold muddatini bir marta uzaytiradi. */
  extend(bookingId: string, ttlMinutes: number, now: Date): Promise<BookingRecord>;
  /** Buyurtma yaratilganda hold buyurtmaga bog'lanadi. */
  attachOrder(bookingId: string, orderId: string): Promise<void>;
  /** HOLD → CONFIRMED (held−1, booked+1) - buyurtma tasdiqlanganda. */
  confirm(bookingId: string, now: Date): Promise<void>;
  /** Muddati o'tgan barcha hold'larni bo'shatadi; nechtasi bo'shatilgani qaytadi. */
  releaseExpired(now: Date, limit: number): Promise<number>;
}

export const BOOKING_REPOSITORY = Symbol('BookingRepository');

export class SlotFullError extends Error { constructor() { super('SLOT_FULL'); } }
export class SlotClosedError extends Error { constructor() { super('SLOT_CLOSED'); } }
export class SlotPastError extends Error { constructor() { super('SLOT_PAST'); } }
export class HoldExpiredError extends Error { constructor() { super('HOLD_EXPIRED'); } }
export class HoldNotExtendableError extends Error { constructor() { super('HOLD_NOT_EXTENDABLE'); } }
export class CapacityBelowBookedError extends Error { constructor() { super('CAPACITY_BELOW_BOOKED'); } }
