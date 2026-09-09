import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { BOOKING, uzLocalDate } from '@yuksaroy/domain';
import { UpsertTerminalUseCase } from '../../catalog/application/upsert-terminal.usecase';
import { BOOKING_REPOSITORY, CapacityBelowBookedError, type BookingRepository, type SlotWindowInput } from '../domain/ports';

export interface OpenCapacityInput { from: string; to: string; windows?: SlotWindowInput[]; weekdaysOnly?: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Terminal kalendari: davr uchun slot oynalarini ochadi. Sig'imni band qilinganidan past qilib bo'lmaydi. */
@Injectable()
export class ManageSlotsUseCase {
  constructor(@Inject(BOOKING_REPOSITORY) private readonly repo: BookingRepository, private readonly terminals: UpsertTerminalUseCase) {}

  /** Ommaviy: terminalning bo'sh slotlari (default - bugundan 14 kun). */
  async listSlots(terminalId: string, from?: string, to?: string) {
    const now = new Date();
    const f = from && DATE_RE.test(from) ? from : uzLocalDate(now);
    const t = to && DATE_RE.test(to) ? to : uzLocalDate(new Date(now.getTime() + 14 * 86_400_000));
    if (t < f) throw new BadRequestException({ code: 'INVALID_RANGE' });
    return this.repo.listSlots(terminalId, f, t, now);
  }

  async openCapacity(userId: string, terminalId: string, input: OpenCapacityInput) {
    const t = await this.terminals.owned(userId, terminalId);
    if (!DATE_RE.test(input.from) || !DATE_RE.test(input.to) || input.to < input.from) throw new BadRequestException({ code: 'INVALID_RANGE' });

    const dates = enumerateDates(input.from, input.to, input.weekdaysOnly ?? false);
    if (!dates.length) throw new BadRequestException({ code: 'EMPTY_RANGE' });
    if (dates.length > BOOKING.horizonDays * 2) throw new BadRequestException({ code: 'RANGE_TOO_LONG', maxDays: BOOKING.horizonDays * 2 });

    const windows = input.windows?.length ? input.windows : defaultWindows();
    const seen = new Set<number>();
    for (const w of windows) {
      if (!Number.isInteger(w.window) || w.window < 1 || w.window > 24) throw new BadRequestException({ code: 'INVALID_WINDOW' });
      if (seen.has(w.window)) throw new BadRequestException({ code: 'DUPLICATE_WINDOW', window: w.window });
      seen.add(w.window);
      if (!HHMM_RE.test(w.start) || !HHMM_RE.test(w.end) || w.end <= w.start) throw new BadRequestException({ code: 'INVALID_WINDOW_TIME', window: w.window });
      if (!Number.isInteger(w.capacity) || w.capacity < 0 || w.capacity > 100) throw new BadRequestException({ code: 'INVALID_CAPACITY', window: w.window });
    }

    try {
      const created = await this.repo.upsertSlots(t.id, dates, windows);
      return { slots: created, days: dates.length, windows: windows.length };
    } catch (e) {
      if (e instanceof CapacityBelowBookedError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }

  async setSlotClosed(userId: string, terminalId: string, slotId: string, closed: boolean) {
    await this.terminals.owned(userId, terminalId);
    const slot = await this.repo.findSlot(slotId);
    if (!slot || slot.terminalId !== terminalId) throw new BadRequestException({ code: 'SLOT_NOT_FOUND' });
    return this.repo.closeSlot(slotId, closed);
  }
}

/** "2026-09-10".."2026-09-12" → kunlar ro'yxati (Toshkent kuni bo'yicha, UTC arifmetikasi bilan). */
export function enumerateDates(from: string, to: string, weekdaysOnly: boolean): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00.000Z`); d <= new Date(`${to}T00:00:00.000Z`); d = new Date(d.getTime() + 86_400_000)) {
    if (weekdaysOnly && (d.getUTCDay() === 0 || d.getUTCDay() === 6)) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const defaultWindows = (): SlotWindowInput[] =>
  BOOKING.defaultWindows.map(([start, end], i) => ({ window: i + 1, start, end, capacity: BOOKING.defaultCapacity }));
