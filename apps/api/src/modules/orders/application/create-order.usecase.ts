import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Direction, Operation, ServiceCode } from '@yuksaroy/domain';
import { PlatformConfigService } from '../../../common/platform-config.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../../common/prisma.service';
import { notifyBoth } from '../../../common/telegram';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../../catalog/domain/ports';
import { BOOKING_REPOSITORY, type BookingRepository } from '../../booking/domain/ports';
import { HoldSlotUseCase } from '../../booking/application/hold-slot.usecase';
import { calcQuote, type QuoteTariff } from '../../pricing/domain/calc-quote';
import { ORDER_REPOSITORY, type OrderRecord, type OrderRepository } from '../domain/ports';
import { OrderAccess } from './order-access';

export interface CreateOrderInput {
  /** Bo'sh bo'lsa: mavjud tashkilot olinadi yoki foydalanuvchi nomi bilan yangisi ochiladi */
  orgId?: string | null;
  bookingId: string;
  operation: Operation;
  direction?: Direction;
  cargoCode?: string;
  weightKg: number;
  wagonCount?: number;
  storageDays?: number;
  services?: ServiceCode[];
  wagonNumbers?: string[];
  note?: string;
}

/**
 * Buyurtma yaratish (3.1, 3-qadam): hold tekshiriladi → narx serverda hisoblanadi va muzlatiladi →
 * Order PENDING + 30 daq SLA. Narx mijozdan olinmaydi.
 */
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(BOOKING_REPOSITORY) private readonly bookings: BookingRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    private readonly holds: HoldSlotUseCase,
    private readonly access: OrderAccess,
    private readonly config: PlatformConfigService,
    // ponytail: bildirishnoma uchun Prisma to'g'ridan-to'g'ri; alohida port faqat ikkinchi kanal chiqqanda kerak
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(userId: string, input: CreateOrderInput): Promise<OrderRecord> {
    const now = new Date();
    let shipperOrgId = await this.access.existingShipperOrg(userId, input.orgId);
    const booking = await this.holds.assertUsable(userId, input.bookingId, now);

    const slot = await this.bookings.findSlot(booking.slotId);
    if (!slot) throw new NotFoundException({ code: 'SLOT_NOT_FOUND' });
    if (slot.startsAt <= now) throw new ConflictException({ code: 'SLOT_PAST' });

    const terminal = await this.catalog.findTerminalById(slot.terminalId, now);
    if (!terminal || terminal.status !== 'ACTIVE') throw new ConflictException({ code: 'TERMINAL_UNAVAILABLE' });
    // Terminalni faqat egasi qo'shadi: egasiz obyektda tasdiqlaydigan tomon yo'q, shuning uchun bron ochilmaydi
    if (terminal.orgId === null) throw new ConflictException({ code: 'TERMINAL_NOT_JOINED' });
    // Arms-length: terminal egasi o'z tashkiloti nomidan o'z terminaliga buyurtma bera olmaydi (o'ziga baho qo'yish yo'li)
    if (terminal.orgId !== null && terminal.orgId === shipperOrgId) throw new ConflictException({ code: 'SELF_ORDER' });
    if (!terminal.services.some((s) => s.isEnabled && s.serviceCode === input.operation)) {
      throw new BadRequestException({ code: 'OPERATION_NOT_OFFERED', operation: input.operation });
    }

    const cargo = input.cargoCode ? await this.catalog.findCargoTypeByCode(input.cargoCode) : null;
    if (input.cargoCode && !cargo) throw new BadRequestException({ code: 'CARGO_NOT_FOUND' });

    const cfg = await this.config.get();
    const tariffs: QuoteTariff[] = terminal.tariffs.map((t) => ({ id: t.id, serviceCode: t.serviceCode, cargoGroupCode: t.cargoGroupCode, priceTiyin: t.priceTiyin, unit: t.unit, minTiyin: t.minTiyin }));
    const quote = calcQuote(
      { operation: input.operation, weightKg: input.weightKg, wagonCount: input.wagonCount, storageDays: input.storageDays, services: input.services, cargoGroupCode: cargo?.groupCode ?? null },
      tariffs,
      { commissionPct: cfg.commissionPct, commissionPayer: cfg.commissionPayer },
    );
    if (!quote.lines.some((l) => l.serviceCode === input.operation)) throw new ConflictException({ code: 'NO_TARIFF_FOR_OPERATION' });

    // Reestrdan kelgan shahobchaning stansiyasi bog'lanmagan bo'lishi mumkin, Order.stationId esa majburiy.
    // Ilgari bu `!` bilan yashirilgan edi va Prisma so'nggi bosqichda 500 berib, band qilingan joyni yeb ketardi.
    if (terminal.stationId === null) throw new ConflictException({ code: 'TERMINAL_NO_STATION' });

    // Tashkilot eng oxirida ochiladi: yuqoridagi tekshiruvlardan biri rad etsa bo'sh tashkilot qolib ketmasin
    shipperOrgId ??= await this.access.createShipperOrg(userId);

    const order = await this.orders.create({
      shipperOrgId, createdById: userId, terminalId: terminal.id, stationId: terminal.stationId,
      direction: input.direction ?? 'LOCAL', operation: input.operation, cargoTypeId: cargo?.id ?? null,
      weightKg: input.weightKg, wagonCount: input.wagonCount ?? 1, storageDays: input.storageDays ?? null,
      wagonNumbers: (input.wagonNumbers ?? []).slice(0, 100), note: input.note?.slice(0, 1000) ?? null,
      subtotalTiyin: quote.subtotalTiyin, commissionPct: quote.commissionPct, commissionPayer: quote.commissionPayer,
      commissionTiyin: quote.commissionTiyin, totalTiyin: quote.totalTiyin,
      slaConfirmUntil: new Date(now.getTime() + cfg.terminalConfirmMin * 60_000),
      items: quote.lines.map((l) => ({ serviceCode: l.serviceCode, tariffId: l.tariffId, qty: l.qty, unit: l.unit, unitPriceTiyin: l.unitPriceTiyin, amountTiyin: l.amountTiyin, minApplied: l.minApplied })),
      bookingId: booking.id,
    });
    // Terminal egalariga xabar: tasdiqlash muddati shu yerdan boshlanadi
    void notifyBoth(this.prisma, this.notifications, {
      target: { orgIds: [terminal.orgId], ownersOnly: true },
      kind: 'orderNew',
      inApp: 'orderNew',
      href: '/dashboard/terminal',
      vars: { no: order.no, terminal: terminal.name, shipper: order.shipperOrgName, minutes: cfg.terminalConfirmMin },
      card: { title: `${order.no} - ${terminal.name}`, body: order.shipperOrgName },
    }).catch(() => {});
    return order;
  }
}
