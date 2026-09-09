// Kanban taxtasi: holat -> ustun, saralash va chegara. DB kerak emas.
import type { OrderStatus } from '@yuksaroy/domain';

export const BOARD_COLUMNS = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'OTHER'] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];
export const BOARD_LIMIT = 100;

/** REJECTED, EXPIRED, CANCELLED -> OTHER. */
export const boardColumn = (s: OrderStatus): BoardColumn => (s === 'PENDING' || s === 'CONFIRMED' || s === 'IN_PROGRESS' || s === 'DONE' ? s : 'OTHER');

interface Card { status: OrderStatus; createdAt: Date; slot: { startsAt: Date } | null }
const slotAt = (c: Card) => c.slot?.startsAt.getTime() ?? Number.MAX_SAFE_INTEGER; // slotsiz oxirida
const bySlot = (a: Card, b: Card) => slotAt(a) - slotAt(b) || a.createdAt.getTime() - b.createdAt.getTime();

/**
 * Ustunlarga ajratadi; faol ustunlar (PENDING, CONFIRMED, IN_PROGRESS) slot boshlanishi bo'yicha o'sish tartibida
 * (navbatdagi ish birinchi), DONE va OTHER kamayish tartibida (oxirgisi birinchi). Har ustun ko'pi bilan 100.
 * counts: chegaragacha bo'lgan to'liq son.
 */
export function groupBoard<T extends Card>(cards: T[]) {
  const columns = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as T[]])) as Record<BoardColumn, T[]>;
  for (const c of cards) columns[boardColumn(c.status)].push(c);
  const counts = {} as Record<BoardColumn, number>;
  for (const col of BOARD_COLUMNS) {
    counts[col] = columns[col].length;
    const sorted = columns[col].sort(bySlot);
    columns[col] = (col === 'DONE' || col === 'OTHER' ? sorted.reverse() : sorted).slice(0, BOARD_LIMIT);
  }
  return { columns, counts };
}
