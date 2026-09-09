import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { BOOKING_REPOSITORY, type BookingRepository } from '../../booking/domain/ports';
import { ORDER_REPOSITORY, type OrderRepository } from '../domain/ports';
import { OrderActionsUseCase } from './order-actions.usecase';

const TICK_MS = 30_000;
const BATCH = 200;

/**
 * Muddatlarni tozalash: 10 daqiqalik hold'lar va 30 daqiqalik tasdiq SLA'si.
 * ponytail: bitta instansiya uchun in-process interval; ko'p instansiyada BullMQ worker (6.6) kerak bo'ladi.
 */
@Injectable()
export class SlaSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SlaSweeper');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly actions: OrderActionsUseCase,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.SWEEPER === 'off') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Bir sikl: muddati o'tgan hold'lar bo'shatiladi, tasdiqlanmagan buyurtmalar EXPIRED bo'ladi. */
  async tick(): Promise<{ holds: number; orders: number }> {
    if (this.running) return { holds: 0, orders: 0 };
    this.running = true;
    const now = new Date();
    let holds = 0, expired = 0;
    try {
      const stale = await this.orders.findExpired(now, BATCH);
      for (const o of stale) { await this.actions.expire(o.id, o.bookingId); expired++; }
      holds = await this.bookings.releaseExpired(now, BATCH);
      if (holds || expired) this.log.log(`hold bo'shatildi: ${holds}, buyurtma muddati o'tdi: ${expired}`);
    } catch (e) {
      this.log.error(`sweep xatosi: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
    return { holds, orders: expired };
  }
}
