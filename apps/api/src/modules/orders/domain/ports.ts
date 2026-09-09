// orders - domen portlari. Framework va Prisma bu faylda yo'q.
import type { Actor, CommissionPayer, Direction, OrderStatus, Operation, ServiceCode, TariffUnit } from '@yuksaroy/domain';

export interface OrderItemRecord {
  id: string; serviceCode: ServiceCode; tariffId: string | null; qty: number; unit: TariffUnit;
  unitPriceTiyin: number; amountTiyin: number; minApplied: boolean;
}

export interface OrderHistoryRecord {
  id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus | null; code: string | null;
  actorId: string | null; actorRole: string | null; reason: string | null; payload: unknown; at: Date;
}

export interface OrderRecord {
  id: string; no: string; status: OrderStatus;
  shipperOrgId: string; shipperOrgName: string; createdById: string;
  terminalId: string; terminalName: string; terminalSlug: string;
  stationId: string; stationName: string;
  direction: Direction; operation: Operation; cargoTypeId: string | null; cargoName: string | null;
  weightKg: number; wagonCount: number; storageDays: number | null; wagonNumbers: string[]; note: string | null;
  subtotalTiyin: number; commissionPct: number; commissionPayer: CommissionPayer; commissionTiyin: number; totalTiyin: number;
  slaConfirmUntil: Date | null; confirmedAt: Date | null; closedAt: Date | null; createdAt: Date;
  slot: { id: string; bookingId: string; startsAt: Date; endsAt: Date; window: number } | null;
  items: OrderItemRecord[];
  history: OrderHistoryRecord[];
}

export interface CreateOrderData {
  shipperOrgId: string; createdById: string; terminalId: string; stationId: string;
  direction: Direction; operation: Operation; cargoTypeId: string | null;
  weightKg: number; wagonCount: number; storageDays: number | null; wagonNumbers: string[]; note: string | null;
  subtotalTiyin: number; commissionPct: number; commissionPayer: CommissionPayer; commissionTiyin: number; totalTiyin: number;
  slaConfirmUntil: Date;
  items: Omit<OrderItemRecord, 'id'>[];
  bookingId: string;
}

export interface OrderFilter {
  shipperOrgIds?: string[];
  terminalIds?: string[];
  status?: OrderStatus[];
  q?: string;
}

export interface HistoryEntry {
  fromStatus?: OrderStatus | null; toStatus?: OrderStatus | null; code?: string | null;
  actorId?: string | null; actorRole?: Actor | null; reason?: string | null; payload?: unknown;
}

export interface OrderRepository {
  /** Tranzaksiya: navbatdagi raqam + Order + OrderItem[] + tarix qatori + hold'ni buyurtmaga bog'lash. */
  create(data: CreateOrderData): Promise<OrderRecord>;
  findById(id: string): Promise<OrderRecord | null>;
  findByNo(no: string): Promise<OrderRecord | null>;
  list(f: OrderFilter, page: number, limit: number): Promise<{ items: OrderRecord[]; total: number; page: number; limit: number }>;
  /** Holatni almashtiradi (faqat kutilgan holatdan - optimistik) va tarixga yozadi. */
  transition(orderId: string, from: OrderStatus, to: OrderStatus, entry: HistoryEntry, patch?: { confirmedAt?: Date; closedAt?: Date }): Promise<OrderRecord>;
  /** Holat o'zgarmaydigan hodisa (ARRIVED/WEIGHED/…). */
  addHistory(orderId: string, entry: HistoryEntry): Promise<OrderHistoryRecord>;
  /** SLA muddati o'tgan PENDING buyurtmalar (sweeper uchun). */
  findExpired(now: Date, limit: number): Promise<{ id: string; bookingId: string | null }[]>;
  /** Terminalning bugungi yuki - inbox sarlavhasi uchun. */
  countByStatus(terminalIds: string[]): Promise<Record<string, number>>;
}

export const ORDER_REPOSITORY = Symbol('OrderRepository');

export class OrderStaleError extends Error { constructor() { super('ORDER_STATE_CHANGED'); } }
