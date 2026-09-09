// Bugungi bo'sh slotlar yig'indisi. Muddati o'tgan hold'lar (sweeper hali bo'shatmagan) hisobga olinmaydi.
export interface SlotFreeRow { terminalId: string; capacity: number; booked: number; held: number; staleHolds: number }

export function sumFreeToday(rows: SlotFreeRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.terminalId] = (out[r.terminalId] ?? 0) + Math.max(0, r.capacity - r.booked - (r.held - r.staleHolds));
  return out;
}
