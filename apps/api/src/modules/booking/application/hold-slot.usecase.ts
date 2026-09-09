import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlatformConfigService } from '../../../common/platform-config.service';
import {
  BOOKING_REPOSITORY, HoldExpiredError, HoldNotExtendableError, SlotClosedError, SlotFullError, SlotPastError,
  type BookingRepository,
} from '../domain/ports';

/** Slotni vaqtincha ushlab turish (default 10 daq, PlatformConfig). Vizardning 2-ekrani. */
@Injectable()
export class HoldSlotUseCase {
  constructor(@Inject(BOOKING_REPOSITORY) private readonly repo: BookingRepository, private readonly config: PlatformConfigService) {}

  async hold(userId: string, slotId: string, orgId: string | null) {
    const cfg = await this.config.get();
    const now = new Date();
    const slot = await this.repo.findSlot(slotId);
    if (!slot) throw new NotFoundException({ code: 'SLOT_NOT_FOUND' });
    try {
      const b = await this.repo.hold(slotId, userId, orgId, cfg.slotHoldTtlMin, now);
      return { id: b.id, slotId: b.slotId, holdExpiresAt: b.holdExpiresAt, ttlMinutes: cfg.slotHoldTtlMin, slot: await this.repo.findSlot(slotId) };
    } catch (e) {
      if (e instanceof SlotFullError) throw new ConflictException({ code: e.message });
      if (e instanceof SlotClosedError) throw new ConflictException({ code: e.message });
      if (e instanceof SlotPastError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }

  async release(userId: string, bookingId: string) {
    const b = await this.mine(userId, bookingId);
    if (b.orderId) throw new ConflictException({ code: 'BOOKING_HAS_ORDER' }); // buyurtmani bekor qiling
    await this.repo.release(bookingId, 'MANUAL', new Date());
  }

  async extend(userId: string, bookingId: string) {
    await this.mine(userId, bookingId);
    const cfg = await this.config.get();
    try {
      const b = await this.repo.extend(bookingId, cfg.slotHoldTtlMin, new Date());
      return { id: b.id, holdExpiresAt: b.holdExpiresAt, extendedOnce: b.extendedOnce };
    } catch (e) {
      if (e instanceof HoldExpiredError) throw new ConflictException({ code: e.message });
      if (e instanceof HoldNotExtendableError) throw new ConflictException({ code: e.message });
      throw e;
    }
  }

  /** Hold egasi shu foydalanuvchimi va hali amaldami. */
  async mine(userId: string, bookingId: string) {
    const b = await this.repo.findBooking(bookingId);
    if (!b) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND' });
    if (b.userId !== userId) throw new ForbiddenException({ code: 'NOT_BOOKING_OWNER' });
    return b;
  }

  /** Buyurtma yaratishda: hold amaldami (HOLD va muddati o'tmagan). */
  async assertUsable(userId: string, bookingId: string, now = new Date()) {
    const b = await this.mine(userId, bookingId);
    if (b.status !== 'HOLD' || (b.holdExpiresAt && b.holdExpiresAt < now)) throw new ConflictException({ code: 'HOLD_EXPIRED' });
    if (b.orderId) throw new ConflictException({ code: 'HOLD_ALREADY_USED' });
    return b;
  }
}

