import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatOrderNo, type OrderStatus } from '@yuksaroy/domain';
import { PrismaService } from '../../../common/prisma.service';
import {
  OrderStaleError,
  type CreateOrderData, type HistoryEntry, type OrderFilter, type OrderRecord, type OrderRepository,
} from '../domain/ports';

const include = {
  shipperOrg: { select: { name: true } },
  terminal: { select: { name: true, slug: true } },
  station: { select: { nameUz: true } },
  cargoType: { select: { name: true, nameUz: true } },
  items: { orderBy: { amountTiyin: 'desc' as const } },
  history: { orderBy: { at: 'asc' as const } },
  booking: { include: { slot: { select: { id: true, startsAt: true, endsAt: true, window: true } } } },
};
type Row = Prisma.OrderGetPayload<{ include: typeof include }>;

const toRecord = (o: Row): OrderRecord => ({
  id: o.id, no: o.no, status: o.status,
  shipperOrgId: o.shipperOrgId, shipperOrgName: o.shipperOrg.name, createdById: o.createdById,
  terminalId: o.terminalId, terminalName: o.terminal.name, terminalSlug: o.terminal.slug,
  stationId: o.stationId, stationName: o.station.nameUz,
  direction: o.direction, operation: o.operation as OrderRecord['operation'],
  cargoTypeId: o.cargoTypeId, cargoName: o.cargoType?.nameUz ?? o.cargoType?.name ?? null,
  weightKg: o.weightKg, wagonCount: o.wagonCount, storageDays: o.storageDays, wagonNumbers: o.wagonNumbers, note: o.note,
  subtotalTiyin: Number(o.subtotalTiyin), commissionPct: o.commissionPct, commissionPayer: o.commissionPayer,
  commissionTiyin: Number(o.commissionTiyin), totalTiyin: Number(o.totalTiyin),
  slaConfirmUntil: o.slaConfirmUntil, confirmedAt: o.confirmedAt, closedAt: o.closedAt, createdAt: o.createdAt,
  slot: o.booking?.slot ? { id: o.booking.slot.id, bookingId: o.booking.id, startsAt: o.booking.slot.startsAt, endsAt: o.booking.slot.endsAt, window: o.booking.slot.window } : null,
  items: o.items.map((i) => ({ id: i.id, serviceCode: i.serviceCode, tariffId: i.tariffId, qty: i.qty, unit: i.unit, unitPriceTiyin: Number(i.unitPriceTiyin), amountTiyin: Number(i.amountTiyin), minApplied: i.minApplied })),
  history: o.history.map((h) => ({ id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, code: h.code, actorId: h.actorId, actorRole: h.actorRole, reason: h.reason, payload: h.payload, at: h.at })),
});

const historyData = (orderId: string, e: HistoryEntry) => ({
  orderId, fromStatus: e.fromStatus ?? null, toStatus: e.toStatus ?? null, code: e.code ?? null,
  actorId: e.actorId ?? null, actorRole: e.actorRole ?? null, reason: e.reason ?? null,
  payload: (e.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
});

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(d: CreateOrderData): Promise<OrderRecord> {
    const id = await this.prisma.$transaction(async (tx) => {
      const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('order_no_seq')`;
      const order = await tx.order.create({
        data: {
          no: formatOrderNo(Number(nextval)),
          shipperOrgId: d.shipperOrgId, createdById: d.createdById, terminalId: d.terminalId, stationId: d.stationId,
          direction: d.direction, operation: d.operation, cargoTypeId: d.cargoTypeId,
          weightKg: d.weightKg, wagonCount: d.wagonCount, storageDays: d.storageDays, wagonNumbers: d.wagonNumbers, note: d.note,
          subtotalTiyin: BigInt(d.subtotalTiyin), commissionPct: d.commissionPct, commissionPayer: d.commissionPayer,
          commissionTiyin: BigInt(d.commissionTiyin), totalTiyin: BigInt(d.totalTiyin), slaConfirmUntil: d.slaConfirmUntil,
          items: { create: d.items.map((i) => ({ serviceCode: i.serviceCode, tariffId: i.tariffId, qty: i.qty, unit: i.unit, unitPriceTiyin: BigInt(i.unitPriceTiyin), amountTiyin: BigInt(i.amountTiyin), minApplied: i.minApplied })) },
          history: { create: [{ toStatus: 'PENDING', actorId: d.createdById, actorRole: 'CLIENT' }] },
        },
        select: { id: true },
      });
      // Hold buyurtmaga bog'lanadi (SlotBooking.orderId @unique - ikki buyurtma bitta hold'ni egallolmaydi)
      await tx.slotBooking.update({ where: { id: d.bookingId }, data: { orderId: order.id } });
      return order.id;
    });
    return (await this.findById(id))!;
  }

  async findById(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include });
    return o ? toRecord(o) : null;
  }
  async findByNo(no: string) {
    const o = await this.prisma.order.findUnique({ where: { no }, include });
    return o ? toRecord(o) : null;
  }

  async list(f: OrderFilter, page: number, limit: number) {
    const where: Prisma.OrderWhereInput = {
      shipperOrgId: f.shipperOrgIds ? { in: f.shipperOrgIds } : undefined,
      terminalId: f.terminalIds ? { in: f.terminalIds } : undefined,
      status: f.status?.length ? { in: f.status } : undefined,
      OR: f.q ? [{ no: { contains: f.q, mode: 'insensitive' } }, { terminal: { name: { contains: f.q, mode: 'insensitive' } } }] : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { items: rows.map(toRecord), total, page, limit };
  }

  async transition(orderId: string, from: OrderStatus, to: OrderStatus, entry: HistoryEntry, patch?: { confirmedAt?: Date; closedAt?: Date }) {
    await this.prisma.$transaction(async (tx) => {
      // Optimistik: faqat kutilgan holatdan o'tadi (parallel confirm/cancel poygasi)
      const r = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to, ...patch } });
      if (r.count === 0) throw new OrderStaleError();
      await tx.orderStatusHistory.create({ data: historyData(orderId, { ...entry, fromStatus: from, toStatus: to }) });
    });
    return (await this.findById(orderId))!;
  }

  async addHistory(orderId: string, entry: HistoryEntry) {
    const h = await this.prisma.orderStatusHistory.create({ data: historyData(orderId, entry) });
    return { id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, code: h.code, actorId: h.actorId, actorRole: h.actorRole, reason: h.reason, payload: h.payload, at: h.at };
  }

  async findExpired(now: Date, limit: number) {
    const rows = await this.prisma.order.findMany({
      where: { status: 'PENDING', slaConfirmUntil: { lt: now } },
      select: { id: true, booking: { select: { id: true } } }, take: limit,
    });
    return rows.map((r) => ({ id: r.id, bookingId: r.booking?.id ?? null }));
  }

  async countByStatus(terminalIds: string[]) {
    const rows = await this.prisma.order.groupBy({ by: ['status'], where: { terminalId: { in: terminalIds } }, _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  }
}
