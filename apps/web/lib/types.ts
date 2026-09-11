// API javob shakllari (apps/api presentation/mappers.ts bilan bir xil). packages/contracts F2 da avto-generatsiya.
import type { BookingStatus, ClaimStatus, CommissionPayer, Direction, OrderStatus, Operation, Rju, ServiceCode, SlotStatus, TariffUnit, TerminalKind } from '@yuksaroy/domain';

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WeekHours = Partial<Record<WeekDay, [string, string][]>>;

export interface Station { id: string; esrCode: string | null; nameUz: string; nameRu: string | null; rju: Rju; stationType: string | null; classRank: string | null; lat: number | null; lng: number | null }
export interface CargoType { id: string; code: string; codeTo: string; name: string; nameUz: string | null; groupCode: string; groupName: string }

export interface TerminalCard {
  id: string; slug: string; name: string; kind: TerminalKind; status: string; regionCode: string | null;
  station: { esrCode: string | null; nameUz: string; rju: Rju };
  address: string | null; lat: number | null; lng: number | null; is24h: boolean; hours: WeekHours | null; photos: string[];
  /** O'rtacha baho: 3 tadan kam baho bo'lsa null (ratingCount qoladi). */
  ratingAvg: number | null; ratingCount: number; claimed: boolean; orgName: string | null; services: ServiceCode[]; fromPriceTiyin: number | null;
  /** Egasiz terminalga da'vo holati (PENDING: operator tekshirmoqda). */
  claimStatus?: ClaimStatus;
  // Ro'yxat qo'shimchalari: joriy umumiy tariflar (max 6), bugungi bo'sh slotlar, near bo'lsa masofa
  tariffs?: CardTariff[]; freeToday?: number; distanceKm?: number | null;
}
export interface CardTariff { serviceCode: ServiceCode; priceTiyin: number; unit: TariffUnit; minTiyin: number | null }
export interface Tariff { id: string; serviceCode: ServiceCode; cargoGroupCode: string | null; priceTiyin: number; unit: TariffUnit; minTiyin: number | null; validFrom: string; validTo: string | null; version: number; note: string | null }
export interface TerminalDetail extends Omit<TerminalCard, 'station' | 'tariffs'> {
  station: Station; description: string | null; phone: string | null; passport: Passport | null;
  serviceDetails: { serviceCode: ServiceCode; leadTimeMin: number }[]; tariffs: Tariff[];
}
export interface Passport {
  tracks?: number; tracksLengthM?: number; cranes?: { type: string; capacityT: number }[]; warehouseM2?: number; openAreaM2?: number;
  hasSvx?: boolean; hasScale?: boolean; scaleT?: number; containerSlots?: number; customsPost?: boolean;
}

export interface Siding {
  id: string; registryNo: number; regionCode: string | null; lat: number | null; lng: number | null; station: { id: string; esrCode: string | null; nameUz: string; rju: Rju } | null; stationNameRaw: string; esrCode: string | null; rju: Rju | null;
  lengthM: number | null; unloadCapacity: number; loadCapacity: number; claimStatus: ClaimStatus; owner: string | null;
  /** Egasi yuklagan rasmlar; da'vo tasdiqlanmaguncha bo'sh keladi. */
  photos: string[];
}

export interface Page<T> { items: T[]; total: number; page: number; limit: number; summary?: ListSummary }
/** Filtrlangan to'plam bo'yicha qaror satri (GET /terminals). */
export interface ListSummary { freeToday: number; ratedCount?: number; cheapestTiyin: number | null; cheapestUnit: TariffUnit | null; nearestKm: number | null }
export interface Stats { terminals: number; sidings: number; stations: number; listings?: number; companies?: number; freeSlotsToday?: number }

export interface QuoteLine { serviceCode: ServiceCode; unit: TariffUnit; qty: number; unitPriceTiyin: number; amountTiyin: number; minApplied: boolean }
export interface QuoteOffer {
  lines: QuoteLine[]; missing: ServiceCode[]; subtotalTiyin: number; commissionPct: number; commissionPayer: 'TERMINAL' | 'CLIENT'; commissionTiyin: number; totalTiyin: number;
  terminal: TerminalCard; nearby: boolean;
}
export interface QuoteResponse { cargoGroupCode: string | null; offers: QuoteOffer[] }

// ── Booking + Orders (S3) ──

export interface Slot {
  id: string; terminalId: string; localDate: string; window: number;
  startsAt: string; endsAt: string; capacity: number; booked: number; held: number; status: SlotStatus; free: number;
}
export interface Hold {
  id: string; slotId: string; holdExpiresAt: string | null; ttlMinutes: number; slot: Slot | null;
}

export interface OrderLine {
  serviceCode: ServiceCode; qty: number; unit: TariffUnit; unitPriceTiyin: number; amountTiyin: number; minApplied: boolean;
}
export interface OrderTimelineEntry {
  at: string; fromStatus: OrderStatus | null; toStatus: OrderStatus | null; code: string | null;
  actorRole: string | null; reason: string | null; payload: Record<string, unknown> | null;
}
export interface OrderCard {
  no: string; status: OrderStatus; createdAt: string;
  terminal: { id: string; name: string; slug: string };
  station: { id: string; name: string };
  shipper: { id: string; name: string };
  operation: Operation; direction: Direction; cargoName: string | null;
  weightKg: number; wagonCount: number; totalTiyin: number;
  slot: { startsAt: string; endsAt: string; window: number } | null;
  slaConfirmUntil: string | null;
}
export interface Order extends OrderCard {
  note: string | null; wagonNumbers: string[]; storageDays: number | null;
  subtotalTiyin: number; commissionPct: number; commissionPayer: CommissionPayer; commissionTiyin: number;
  confirmedAt: string | null; closedAt: string | null;
  items: OrderLine[]; timeline: OrderTimelineEntry[];
}
export type { BookingStatus, OrderStatus };
