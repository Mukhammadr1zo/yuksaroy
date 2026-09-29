import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { queueStats, staleQueues } from '../../../common/admin-queues';
import { closeStaleTasks } from '../../../common/admin-tasks';
import { IdempotencyService } from '../../../common/idempotency.service';
import { PrismaService } from '../../../common/prisma.service';
import { runtime, type DailyResult } from '../../../common/runtime';
import { BOOKING_REPOSITORY, type BookingRepository } from '../../booking/domain/ports';
import { ORDER_REPOSITORY, type OrderRepository } from '../domain/ports';
import { NotificationsService } from '../../notifications/notifications.service';
import { remindExpiring } from '../../subscription/expiry-reminder';
import { expireListings } from '../../listings/application/expire-listings';
import { AdminNotify } from '../../organizations/application/admin-notify';
import { OrderActionsUseCase } from './order-actions.usecase';

const TICK_MS = 30_000;
const BATCH = 200;
const DAY_MS = 86_400_000;
/** Kunlik tozalash muddatlari. Har biri qayta ishlatilmaydigan qatorlar uchun. */
const KEEP_SESSIONS_DAYS = 30;
const KEEP_OTP_DAYS = 1;
const KEEP_READ_NOTIFICATIONS_DAYS = 90;
/** Navbatdagi ish shuncha kundan oshsa adminlarga eslatiladi. */
const STALE_DAYS = 2;

/**
 * Muddatlar: 10 daqiqalik band qilishlar bo'shatiladi, 30 daqiqada tasdiqlanmagan
 * buyurtma muddati o'tadi. Kuniga bir marta esa keraksiz qatorlar o'chadi.
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
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly adminNotify: AdminNotify,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Kunlik tozalash oxirgi marta qachon ishlaganini xotirada saqlaymiz.
   * Yangi jadval, qulf va rejalashtiruvchi qo'shilmadi: prodda bitta konteyner ishlaydi
   * va har o'chirish takrorlanishga chidamli. Qayta ishga tushirilsa bir marta ortiqcha
   * ishlaydi, bu esa hech narsani buzmaydi.
   */
  private lastDaily = 0;

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
      // Navbatdan chiqqan ishning vazifasi yopiladi; xato siklni to'xtatmasin
      await closeStaleTasks(this.prisma, now).catch(() => {});
      if (now.getTime() - this.lastDaily >= DAY_MS) {
        this.lastDaily = now.getTime();
        await this.daily(now);
      }
    } catch (e) {
      this.log.error(`sweep xatosi: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
    return { holds, orders: expired };
  }

  /**
   * Kuniga bir marta: qayta ishlatilmaydigan qatorlar o'chadi.
   *
   * Idempotentlik kalitlari uchun tozalash funksiyasi bor edi, izohida "sweeper chaqiradi"
   * deb yozilgan ham edi, lekin uni hech kim chaqirmasdi: jadval boshidan buyon o'sib kelgan.
   *
   * Amallar jurnali va ko'rishlar ataylab o'chirilmaydi: telefon kvotasi jurnaldan
   * hisoblanadi, e'lon kartasidagi ko'rishlar soni esa ko'rishlar jadvalidan. Ularni
   * o'chirsak ekrandagi raqam sababsiz kichrayib ketardi.
   */
  private async daily(now: Date) {
    const t0 = Date.now();
    // Natija tizim sahifasiga (runtime.daily): yiqilsa ham qaysi bosqichgacha yetgani ko'rinsin
    const r: DailyResult = { keys: 0, sessions: 0, codes: 0, notes: 0, reminded: 0, expired: 0, stale: 0 };
    try {
      const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
      r.keys = await this.idempotency.purge(now);
      // Bekor qilingan yoki muddati o'tgan sessiya boshqa hech qachon ishlatilmaydi
      r.sessions = (await this.prisma.session.deleteMany({
        where: { OR: [{ revokedAt: { lt: ago(KEEP_SESSIONS_DAYS) } }, { expiresAt: { lt: ago(KEEP_SESSIONS_DAYS) } }] },
      })).count;
      // Bir martalik kod bir necha daqiqada tugaydi, bir kundan keyin faqat tarix
      r.codes = (await this.prisma.otpCode.deleteMany({ where: { createdAt: { lt: ago(KEEP_OTP_DAYS) } } })).count;
      // O'qilgan bildirishnoma qaytib ochilmaydi; o'qilmagani qolaveradi
      r.notes = (await this.prisma.notification.deleteMany({
        where: { readAt: { not: null, lt: ago(KEEP_READ_NOTIFICATIONS_DAYS) } },
      })).count;
      // Obuna tugashiga uch kun qolganlarga eslatma; takrorlanishni obuna qatoridagi belgi to'sadi
      r.reminded = await remindExpiring(this.prisma, this.notifications, now).catch(() => 0);
      if (r.reminded) this.log.log(`obuna eslatmasi: ${r.reminded}`);
      // Muddati o'tgan e'lon ACTIVE bo'lib qolardi: katalogda ko'rinmasdi, lekin havola bilan
      // ochilardi, unga xabar yozish mumkin edi va egasi uni qaytara olmasdi
      r.expired = await expireListings(this.prisma, this.notifications, now).catch(() => 0);
      if (r.expired) this.log.log(`e'lon muddati o'tdi: ${r.expired}`);
      // Navbatda unutilib qolgan ish: ikki kundan oshsa adminlarga bir marta eslatiladi
      // catch argumentni ham qamrasin: queueStats yiqilsa u .catch dan tashqarida qolib,
      // butun kunlik siklni uzib yuborardi
      await queueStats(this.prisma, true)
        .then((st) => {
          const stale = staleQueues(st, now, STALE_DAYS);
          r.stale = stale.length;
          return this.adminNotify.stale(stale);
        })
        .catch(() => {});
      const total = r.keys + r.sessions + r.codes + r.notes;
      if (total) {
        this.log.log(`kunlik tozalash: kalit ${r.keys}, sessiya ${r.sessions}, kod ${r.codes}, bildirishnoma ${r.notes}`);
      }
      runtime.daily = { at: now, ms: Date.now() - t0, ok: true, result: r };
    } catch (e) {
      runtime.daily = { at: now, ms: Date.now() - t0, ok: false, error: (e as Error).message, result: r };
      throw e;
    }
  }
}
