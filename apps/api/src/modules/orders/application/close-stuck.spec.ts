// Qotgan buyurtmani mijoz o'zi yopishi: soxta ombor, baza yo'q.
//
// 7 kun sharti faqat shu use-case da turadi: o'tish jadvali mijozga DONE ni istalgan paytda
// beradi. Shart tushib qolsa mijoz buyurtmani birinchi kunidayoq yopib, ish bajarilmasdan
// terminalga baho qo'ya olardi.
import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '@yuksaroy/domain';
import type { PrismaService } from '../../../common/prisma.service';
import type { BookingRepository } from '../../booking/domain/ports';
import type { IssueDocumentsUseCase } from '../../documents/application/issue-documents.usecase';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { HistoryEntry, OrderRecord, OrderRepository } from '../domain/ports';
import type { OrderAccess } from './order-access';
import { OrderActionsUseCase } from './order-actions.usecase';

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
    assertTerminalOf: async () => {},
  } as unknown as OrderAccess;
  const documents = { onOrderCompleted: async (x: OrderRecord) => { issued.push(x.no); } } as unknown as IssueDocumentsUseCase;
  const prisma = { terminal: { findUnique: async () => ({ orgId: 'terminal-org' }) } } as unknown as PrismaService;
  // Oluvchi bo'sh qaytadi: notifyBoth shu yerda to'xtaydi, maqsad faqat kimga yuborilgani
  const notifications = { recipients: async (t: unknown) => { targets.push(t); return []; } } as unknown as NotificationsService;
  return { uc: new OrderActionsUseCase(orders, {} as BookingRepository, access, documents, prisma, notifications), moves, issued, targets, added };
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
