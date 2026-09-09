// Taxta guruhlash: ustun, saralash, chegara. DB kerak emas.
import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '@yuksaroy/domain';
import { BOARD_LIMIT, groupBoard } from './board';

const card = (no: string, status: OrderStatus, slotIso: string | null, createdIso = '2026-09-01T00:00:00Z') =>
  ({ no, status, createdAt: new Date(createdIso), slot: slotIso ? { startsAt: new Date(slotIso) } : null });

describe('groupBoard', () => {
  it("holat -> ustun; faol ustunlar slot bo'yicha o'sish, DONE kamayish, slotsiz oxirida", () => {
    const r = groupBoard([
      card('p2', 'PENDING', '2026-09-10T10:00:00Z'),
      card('p3', 'PENDING', null),
      card('p1', 'PENDING', '2026-09-10T08:00:00Z'),
      card('d1', 'DONE', '2026-09-01T08:00:00Z'),
      card('d2', 'DONE', '2026-09-05T08:00:00Z'),
      card('x1', 'REJECTED', null),
      card('x2', 'CANCELLED', '2026-09-02T08:00:00Z'),
      card('x3', 'EXPIRED', null, '2026-09-03T00:00:00Z'),
      card('c1', 'CONFIRMED', '2026-09-11T08:00:00Z'),
    ]);
    expect(r.columns.PENDING.map((c) => c.no)).toEqual(['p1', 'p2', 'p3']);
    expect(r.columns.CONFIRMED.map((c) => c.no)).toEqual(['c1']);
    expect(r.columns.IN_PROGRESS).toEqual([]);
    expect(r.columns.DONE.map((c) => c.no)).toEqual(['d2', 'd1']);
    expect(r.columns.OTHER.map((c) => c.no)).toEqual(['x3', 'x1', 'x2']); // kamayish: slotsizlar (createdAt bo'yicha) birinchi, slotli oxirida
    expect(r.counts).toEqual({ PENDING: 3, CONFIRMED: 1, IN_PROGRESS: 0, DONE: 2, OTHER: 3 });
  });

  it('har ustun 100 tagacha, counts esa to\'liq', () => {
    const many = Array.from({ length: 130 }, (_, i) => card(`p${i}`, 'PENDING', `2026-09-10T${String(i % 24).padStart(2, '0')}:00:00Z`));
    const r = groupBoard(many);
    expect(r.columns.PENDING).toHaveLength(BOARD_LIMIT);
    expect(r.counts.PENDING).toBe(130);
    expect(groupBoard([])).toEqual({ columns: { PENDING: [], CONFIRMED: [], IN_PROGRESS: [], DONE: [], OTHER: [] }, counts: { PENDING: 0, CONFIRMED: 0, IN_PROGRESS: 0, DONE: 0, OTHER: 0 } });
  });
});
