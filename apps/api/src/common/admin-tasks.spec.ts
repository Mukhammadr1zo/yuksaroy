// Vazifa biriktirish, sof qismi: yopilish qoidasi, havolalar, muddat, tur va navbat mosligi.
import { describe, expect, it } from 'vitest';
import { QUEUE_DEF, TASK_ENTITIES, queueOf } from './admin-queues';
import { DUE_DAYS, dueAtOf, staleTaskIds, taskHref } from './admin-tasks';

describe('staleTaskIds', () => {
  const open = [
    { id: 't1', entity: 'Listing', entityId: 'l1' },
    { id: 't2', entity: 'Listing', entityId: 'l2' },
    { id: 't3', entity: 'Report', entityId: 'r1' },
  ];

  it('navbatda qolgan yopilmaydi, chiqqan yopiladi', () => {
    const still = new Map<string, Set<string>>([['Listing', new Set(['l1'])], ['Report', new Set()]]);
    expect(staleTaskIds(open, still)).toEqual(['t2', 't3']);
  });

  it("bo'sh ro'yxat bo'sh", () => {
    expect(staleTaskIds([], new Map())).toEqual([]);
  });

  it("xaritada yo'q tur navbatdan chiqqan deb yopiladi", () => {
    expect(staleTaskIds(open, new Map())).toEqual(['t1', 't2', 't3']);
  });
});

describe('taskHref', () => {
  it("10 tur, har biri o'z sahifasiga", () => {
    expect(taskHref('Listing', 'a')).toBe('/admin/listings/a');
    expect(taskHref('Organization', 'a')).toBe('/admin/orgs/a');
    expect(taskHref('Terminal', 'a')).toBe('/admin/terminals/a');
    expect(taskHref('PremiumOrder', 'a')).toBe('/admin/moderation?tab=premium#a');
    expect(taskHref('Subscription', 'a')).toBe('/admin/subscriptions?open=a');
    expect(taskHref('Order', 'a', 'YS-1')).toBe('/admin/orders?open=YS-1');
    expect(taskHref('UrgentRequest', 'a', 'UR-7')).toBe('/admin/urgent?q=UR-7');
    expect(taskHref('ContactMessage', 'a')).toBe('/admin/moderation?tab=contact#a');
    expect(taskHref('Report', 'a')).toBe('/admin/moderation?tab=reports#a');
    expect(taskHref('Inquiry', 'a')).toBe('/dashboard/inquiries/a');
  });

  it("obyekt o'chirilgan (no yo'q): havola id bilan", () => {
    expect(taskHref('Order', 'a')).toBe('/admin/orders?open=a');
  });
});

describe('dueAtOf', () => {
  const now = new Date('2026-09-29T10:00:00Z');
  it('0 kun: bugun 23:59 Toshkent = 18:59Z', () => {
    expect(dueAtOf(now, 0)?.toISOString()).toBe('2026-09-29T18:59:00.000Z');
  });
  it('7 kun', () => {
    expect(dueAtOf(now, 7)?.toISOString()).toBe('2026-10-06T18:59:00.000Z');
  });
  it('null muddatsiz', () => {
    expect(dueAtOf(now, null)).toBeNull();
  });
  it('tanlov 0|1|3|7', () => {
    expect([...DUE_DAYS]).toEqual([0, 1, 3, 7]);
  });
});

describe('TASK_ENTITIES', () => {
  it("har biri queueOf bilan topiladi va navbatning entity si o'ziga qaytadi", () => {
    expect(TASK_ENTITIES).toHaveLength(10);
    for (const e of TASK_ENTITIES) {
      const k = queueOf(e);
      expect(k, e).toBeTruthy();
      expect(QUEUE_DEF[k].entity).toBe(e);
    }
  });
});
