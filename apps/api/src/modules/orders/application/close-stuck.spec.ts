// Qotgan buyurtmani mijoz o'zi yopishi: soxta ombor, baza yo'q.
//
// 7 kun sharti faqat shu use-case da turadi: o'tish jadvali mijozga DONE ni istalgan paytda
// beradi. Shart tushib qolsa mijoz buyurtmani birinchi kunidayoq yopib, ish bajarilmasdan
// terminalga baho qo'ya olardi.
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '@yuksaroy/domain';
import type { PrismaService } from '../../../common/prisma.service';
import type { BookingRepository } from '../../booking/domain/ports';
import type { IssueDocumentsUseCase } from '../../documents/application/issue-documents.usecase';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { HistoryEntry, OrderRecord, OrderRepository } from '../domain/ports';
import type { OrderAccess } from './order-access';
import { OrderActionsUseCase } from './order-actions.usecase';
import { noShowFrom, noShowUntil, terminalCancelUntil } from '../../../common/stuck-orders';

const d = (s: string) => new Date(s);
const ev = (at: string, code: string | null = null) =>
  ({ id: at, fromStatus: null, toStatus: null, code, actorId: 'u-t', actorRole: 'TERMINAL', reason: null, payload: null, at: d(at) });

/** Slot 21-sentabr tugagan, terminal ishni boshlagan, keyin jim. */
function order(p: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: 'o1', no: 'YS-0001', status: 'IN_PROGRESS', shipperOrgId: 'mijoz-org', shipperOrgName: 'Mijoz', createdById: 'u-mijoz',
    terminalId: 't1', terminalName: 'Terminal', terminalSlug: 'terminal', stationId: 's1', stationName: 'Stansiya',
    direction: 'LOCAL', operation: 'LOAD', cargoTypeId: null, cargoName: null,
    weightKg: 1000, wagonCount: 1, storageDays: null, wagonNumbers: [], note: null,
    subtotalTiyin: 0, commissionPct: 0, commissionPayer: 'CLIENT', commissionTiyin: 0, totalTiyin: 0,
    slaConfirmUntil: null, confirmedAt: d('2026-09-20T08:00:00Z'), closedAt: null, createdAt: d('2026-09-20T07:00:00Z'),
    slot: { id: 'sl1', bookingId: 'b1', startsAt: d('2026-09-21T03:00:00Z'), endsAt: d('2026-09-21T05:00:00Z'), window: 1 },
    items: [],
    history: [ev('2026-09-21T04:00:00Z', 'ARRIVED')],
    ...p,
  };
}

function setup(o: OrderRecord) {
  const moves: { from: OrderStatus; to: OrderStatus; entry: HistoryEntry; patch?: { closedAt?: Date } }[] = [];
  const issued: string[] = [];
  const targets: unknown[] = [];
  const added: unknown[] = [];
  const orders = {
    findByNo: async () => o,
    findById: async () => o,
    addHistory: async (_id: string, e: HistoryEntry) => { added.push(e.code); },
    transition: async (_id: string, from: OrderStatus, to: OrderStatus, entry: HistoryEntry, patch?: { closedAt?: Date }) => {
      moves.push({ from, to, entry, patch });
      return { ...o, status: to, closedAt: patch?.closedAt ?? null };
    },
  } as unknown as OrderRepository;
  const access = {
    shipperOrgIds: async (userId: string) => (userId === 'u-mijoz' ? ['mijoz-org'] : []),
    isAdmin: async () => false,
    // Terminal xodimi faqat u-t: begona terminal amali haqiqiy OrderAccess dagi kabi rad etiladi
    assertTerminalOf: async (userId: string) => { if (userId !== 'u-t') throw new ForbiddenException({ code: 'NOT_TERMINAL_STAFF' }); },
  } as unknown as OrderAccess;
  const documents = { onOrderCompleted: async (x: OrderRecord) => { issued.push(x.no); } } as unknown as IssueDocumentsUseCase;
  const prisma = {
    terminal: { findUnique: async () => ({ orgId: 'terminal-org' }) },
    user: { findMany: async () => [{ id: 'u-mijoz', locale: 'uz' }] },
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  // Oluvchi faqat aniq foydalanuvchiga (userIds) qaytadi: mijozga ketgan sayt qo'ng'irog'i matni
  // tekshiriladi. Tashkilotga yuborilganda bo'sh: notifyBoth to'xtaydi, maqsad faqat kimga yuborilgani
  const pushed: { href: string; title: string; body: string | null }[] = [];
  const notifications = {
    recipients: async (t: { userIds?: string[] }) => { targets.push(t); return t.userIds ?? []; },
    push: async (_ids: string[], n: { href: string; title: string; body: string | null }) => { pushed.push(n); },
  } as unknown as NotificationsService;
  const released: string[] = [];
  const bookings = { release: async (_id: string, why: string) => { released.push(why); } } as unknown as BookingRepository;
  return { uc: new OrderActionsUseCase(orders, bookings, access, documents, prisma, notifications), moves, issued, targets, added, released, pushed };
}

describe('qotgan buyurtmani mijoz yopadi', () => {
  it("7 kun to'lmasdan yopib bo'lmaydi: terminalning yangi hodisasi muddatni suradi", async () => {
    // Slot tugaganiga 9 kun bo'ldi, lekin 25-sentabrdagi "yuklandi" dan beri 5 kun xolos
    const f = setup(order({ history: [ev('2026-09-21T04:00:00Z', 'ARRIVED'), ev('2026-09-25T10:00:00Z', 'LOADED')] }));
    await expect(f.uc.closeStuck('u-mijoz', 'YS-0001', d('2026-09-30T10:00:00Z')))
      .rejects.toMatchObject({ response: { code: 'CLOSE_TOO_EARLY', closeAt: d('2026-10-02T10:00:00Z') } });
    expect(f.moves).toEqual([]);
  });

  it("7 kundan keyin yopiladi: DONE, tarixda mijoz va sabab, akt va hisob tuzilmaydi", async () => {
    const f = setup(order());
    const now = d('2026-09-28T05:00:00Z');
    const r = await f.uc.closeStuck('u-mijoz', 'YS-0001', now);
    expect(r.status).toBe('DONE');
    expect(f.moves).toEqual([{
      from: 'IN_PROGRESS', to: 'DONE',
      entry: { actorId: 'u-mijoz', actorRole: 'CLIENT', reason: 'IDLE_CLOSED', code: null },
      patch: { closedAt: now },
    }]);
    expect(f.issued).toEqual([]);
    // Xabar fonda ketadi: navbatdagi aylanishda terminal egalari so'raladi
    await new Promise((r) => setImmediate(r));
    expect(f.targets).toEqual([{ orgIds: ['terminal-org'], ownersOnly: true, exceptUserId: 'u-mijoz' }]);
  });

  it("terminal bir hodisani qayta yozib yopish muddatini surolmaydi", async () => {
    const f = setup(order());
    await f.uc.addEvent('u-t', 'YS-0001', 'ARRIVED');
    expect(f.added).toEqual([]);
    // Yangi hodisa odatdagidek yoziladi
    await f.uc.addEvent('u-t', 'YS-0001', 'LOADED');
    expect(f.added).toEqual(['LOADED']);
  });

  it("qotishi mumkin bo'lmagan holat rad etiladi", async () => {
    for (const status of ['PENDING', 'DONE', 'CANCELLED'] as const) {
      const f = setup(order({ status }));
      await expect(f.uc.closeStuck('u-mijoz', 'YS-0001', d('2026-12-01T00:00:00Z')))
        .rejects.toMatchObject({ response: { code: 'TRANSITION_NOT_ALLOWED' } });
      expect(f.moves).toEqual([]);
    }
  });

  it("begona buyurtmani yopib bo'lmaydi, terminal xodimi ham yopa olmaydi", async () => {
    const f = setup(order());
    await expect(f.uc.closeStuck('u-terminal', 'YS-0001', d('2026-12-01T00:00:00Z')))
      .rejects.toMatchObject({ response: { code: 'NOT_ORDER_OWNER' } });
    expect(f.moves).toEqual([]);
  });

  it("yopish vaqti faqat mijoz tomoniga ko'rsatiladi", async () => {
    const f = setup(order());
    expect(await f.uc.closeAtFor('u-mijoz', order())).toEqual(d('2026-09-28T05:00:00Z'));
    expect(await f.uc.closeAtFor('u-terminal', order())).toBeNull();
  });
});

describe('kech "Kelmadi" rad etiladi', () => {
  // Tasdiqlangan, slot 21-sentabr 05:00 da tugagan, keyin jim: mijoz 28-sentabr 05:00 dan yopa oladi
  const confirmed = () => order({ status: 'CONFIRMED', history: [ev('2026-09-20T08:00:00Z')] });

  it("mijoz yopa oladigan paytdan boshlab terminal belgilay olmaydi, taxtadagi tugma ham shu paytgacha", async () => {
    const f = setup(confirmed());
    expect(noShowUntil(confirmed())).toEqual(d('2026-09-28T05:00:00Z'));
    await expect(f.uc.noShow('u-t', 'YS-0001', d('2026-09-28T05:00:00Z')))
      .rejects.toMatchObject({ response: { code: 'NO_SHOW_TOO_LATE' } });
    // Taxtadagi tugma hodisa yo'li orqali boradi: u ham to'xtaydi
    await expect(f.uc.addEvent('u-t', 'YS-0001', 'NO_SHOW')).rejects.toMatchObject({ response: { code: 'NO_SHOW_TOO_LATE' } });
    expect(f.moves).toEqual([]);
    expect(f.released).toEqual([]);
  });

  it("muddat ichida odatdagidek: bekor, sabab NO_SHOW, joy bo'shaydi", async () => {
    const f = setup(confirmed());
    await f.uc.noShow('u-t', 'YS-0001', d('2026-09-28T04:59:00Z'));
    expect(f.moves.map((m) => [m.from, m.to, m.entry.code])).toEqual([['CONFIRMED', 'CANCELLED', 'NO_SHOW']]);
    expect(f.released).toEqual(['NO_SHOW']);
  });

  it("ish boshlangan buyurtmada muddat yo'q: u yerda tugma ham yo'q", () => {
    expect(noShowUntil(order())).toBeNull();
  });
});

// Egasining 2026-10-07 qarori: vaqt boshlanmasdan mijoz kechikkan emas. Shart tushib qolsa terminal
// o'zi voz kechgan buyurtmani ham "Kelmadi" deb yopib, aybni mijozga yozardi
describe('vaqt boshlanguncha "Kelmadi" yo\'q, terminal sabab yozib bekor qiladi', () => {
  // Tasdiqlangan, band qilingan vaqt 21-sentabr 03:00 da boshlanadi
  const confirmed = () => order({ status: 'CONFIRMED', history: [ev('2026-09-20T08:00:00Z')] });
  const before = d('2026-09-21T02:59:00Z');
  const start = d('2026-09-21T03:00:00Z');

  it('vaqt boshlanmasdan "Kelmadi" rad etiladi, boshlangach qabul qilinadi', async () => {
    const f = setup(confirmed());
    await expect(f.uc.noShow('u-t', 'YS-0001', before)).rejects.toMatchObject({ response: { code: 'NO_SHOW_TOO_EARLY' } });
    expect(f.moves).toEqual([]);
    expect(f.released).toEqual([]);
    await f.uc.noShow('u-t', 'YS-0001', start);
    expect(f.moves.map((m) => [m.to, m.entry.code])).toEqual([['CANCELLED', 'NO_SHOW']]);
  });

  it("vaqt boshlanguncha bekor qilinadi: alohida kod, joy bo'shaydi, sabab mijozga boradi", async () => {
    const f = setup(confirmed());
    const r = await f.uc.terminalCancel('u-t', 'YS-0001', '  Kran buzildi  ', before);
    expect(r.status).toBe('CANCELLED');
    expect(f.moves).toEqual([{
      from: 'CONFIRMED', to: 'CANCELLED',
      entry: { actorId: 'u-t', actorRole: 'TERMINAL', reason: 'Kran buzildi', code: 'TERMINAL_CANCEL' },
      patch: { closedAt: before },
    }]);
    expect(f.released).toEqual(['CANCELLED']);
    await new Promise((r) => setImmediate(r));
    expect(f.targets).toEqual([{ userIds: ['u-mijoz'] }]);
    expect(f.pushed).toEqual([expect.objectContaining({ href: '/dashboard/orders/YS-0001', body: expect.stringContaining('Kran buzildi') })]);
  });

  it("sababsiz, vaqt boshlangach yoki begona terminaldan bekor qilib bo'lmaydi", async () => {
    const f = setup(confirmed());
    await expect(f.uc.terminalCancel('u-t', 'YS-0001', '   ', before)).rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
    // Tizim kodiga teng sabab sahifalarda tizim xabari bo'lib chiqardi: "mijoz belgilangan vaqtda kelmadi"
    await expect(f.uc.terminalCancel('u-t', 'YS-0001', ' NO_SHOW ', before)).rejects.toMatchObject({ response: { code: 'REASON_RESERVED' } });
    await expect(f.uc.terminalCancel('u-t', 'YS-0001', 'Kran buzildi', start)).rejects.toMatchObject({ response: { code: 'TERMINAL_CANCEL_TOO_LATE' } });
    await expect(f.uc.terminalCancel('u-begona', 'YS-0001', 'Kran buzildi', before)).rejects.toMatchObject({ response: { code: 'NOT_TERMINAL_STAFF' } });
    expect(f.moves).toEqual([]);
    expect(f.released).toEqual([]);
  });

  it('taxtadagi chegaralar shu qoidadan; slotsiz buyurtmada bekor qilish "Kelmadi" muddatigacha', () => {
    expect(noShowFrom(confirmed())).toEqual(start);
    expect(terminalCancelUntil(confirmed())).toEqual(start);
    const slotless = order({ status: 'CONFIRMED', slot: null, history: [ev('2026-09-20T08:00:00Z')] });
    expect(noShowFrom(slotless)).toBeNull();
    expect(terminalCancelUntil(slotless)).toEqual(noShowUntil(slotless));
    // Ish boshlangan buyurtmada ikkalasi ham yo'q
    expect([noShowFrom(order()), terminalCancelUntil(order())]).toEqual([null, null]);
  });
});
