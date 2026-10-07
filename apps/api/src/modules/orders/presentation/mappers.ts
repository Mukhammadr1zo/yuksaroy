// Javob shakllari. Pul - tiyin (Number), sana - ISO. Ichki id'lar chiqmaydi (createdById, tariffId - faqat egasiga kerak emas).
import type { OrderRecord } from '../domain/ports';

export function orderCard(o: OrderRecord) {
  return {
    no: o.no, status: o.status, createdAt: o.createdAt,
    terminal: { id: o.terminalId, name: o.terminalName, slug: o.terminalSlug },
    station: { id: o.stationId, name: o.stationName },
    shipper: { id: o.shipperOrgId, name: o.shipperOrgName },
    operation: o.operation, direction: o.direction, cargoName: o.cargoName,
    weightKg: o.weightKg, wagonCount: o.wagonCount,
    totalTiyin: o.totalTiyin,
    slot: o.slot ? { startsAt: o.slot.startsAt, endsAt: o.slot.endsAt, window: o.slot.window } : null,
    slaConfirmUntil: o.slaConfirmUntil,
  };
}

/**
 * closeAt: mijoz qotgan buyurtmani qachondan o'zi yopa oladi. Uni faqat GET :no ko'ruvchiga
 * qarab hisoblaydi (closeAtFor); amallar javobida null, chunki ularning har birida null to'g'ri:
 * terminal amali (ko'ruvchi terminal) yoki mijoz amalidan keyingi holat (PENDING, CANCELLED, DONE).
 */
export function publicOrder(o: OrderRecord, closeAt: Date | null = null) {
  return {
    ...orderCard(o),
    note: o.note, wagonNumbers: o.wagonNumbers, storageDays: o.storageDays,
    subtotalTiyin: o.subtotalTiyin, commissionPct: o.commissionPct, commissionPayer: o.commissionPayer,
    commissionTiyin: o.commissionTiyin,
    confirmedAt: o.confirmedAt, closedAt: o.closedAt, closeAt,
    items: o.items.map((i) => ({ serviceCode: i.serviceCode, qty: i.qty, unit: i.unit, unitPriceTiyin: i.unitPriceTiyin, amountTiyin: i.amountTiyin, minApplied: i.minApplied })),
    timeline: o.history.map((h) => ({ at: h.at, fromStatus: h.fromStatus, toStatus: h.toStatus, code: h.code, actorRole: h.actorRole, reason: h.reason, payload: h.payload })),
  };
}
