import { describe, expect, it } from 'vitest';
import { ListingsUseCase } from './application/listings.usecase';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

/**
 * Admin qarori egasiga yetib borishi kerak: ilgari u faqat auditda qolardi.
 * Qo'ng'iroq va Telegram bitta yordamchidan chiqadi, shuning uchun bu yerda
 * yozilgan qatorlar ikkala kanalning ham matnini bildiradi.
 */
function make(row: Record<string, unknown>, watches: { id: string; userId: string; kind: string; params: Record<string, string> }[] = []) {
  const pushed: { title: string; body: string | null }[] = [];
  const repo = {
    findById: async () => row,
    setStatus: async (_id: string, patch: Record<string, unknown>) => ({ ...row, ...patch }),
  } as never;
  const prisma = {
    user: { findMany: async (a: { where: { id: { in: string[] } } }) => a.where.id.in.map((id) => ({ id, locale: 'uz' })) },
    telegramLink: { findMany: async () => [] },
    watch: { findMany: async () => watches, updateMany: async () => ({ count: watches.length }) },
  } as unknown as PrismaService;
  const notifications = {
    recipients: async (w: { userIds?: (string | null | undefined)[] }) => (w.userIds ?? []).filter((x): x is string => !!x),
    push: async (_ids: readonly string[], n: { title: string; body?: string | null }) => { pushed.push({ title: n.title, body: n.body ?? null }); },
  } as unknown as NotificationsService;
  const subs = { raiseListing: async () => {} } as never;
  const uc = new ListingsUseCase(repo, {} as never, prisma, notifications, subs, {} as never);
  return { uc, pushed };
}

const base = { id: 'l1', status: 'PENDING_REVIEW', title: 'Kran 25 t', orgId: null, ownerUserId: 'u1', createdById: 'u1', kind: 'TRUCK',
  slug: 'kran-25-t', regionCode: 'UZ-TK', serviceRegions: [], deal: null, truckType: null, isDemo: false };

describe('e\'lon qarori egasiga aytiladi', () => {
  it('tasdiqlanganda tasdiq matni ketadi', async () => {
    const { uc, pushed } = make(base);
    await uc.decide('l1', true, null);
    await new Promise((r) => setImmediate(r));
    expect(pushed).toHaveLength(1);
    expect(pushed[0].title).toContain('tasdiqlandi');
    expect(pushed[0].body).toContain('Kran 25 t');
  });

  it('qaytarilganda sabab matnga kiradi', async () => {
    const { uc, pushed } = make(base);
    await uc.decide('l1', false, 'Rasm yo\'q');
    await new Promise((r) => setImmediate(r));
    expect(pushed).toHaveLength(1);
    expect(pushed[0].title).toContain('qaytarildi');
    expect(pushed[0].body).toContain('Rasm yo\'q');
  });

  it('namuna e\'lon egasiga xabar yozilmaydi', async () => {
    const { uc, pushed } = make({ ...base, isDemo: true });
    await uc.decide('l1', true, null);
    await new Promise((r) => setImmediate(r));
    expect(pushed).toHaveLength(0);
  });
});

/**
 * E'lon ACTIVE bo'lganda uni kutayotgan odam xabar oladi. Xabar yo'li void bilan
 * ketadi, ya'ni TARTIB kafolatlanmagan: tekshiruv some bilan.
 */
describe('kuzatuvchilarga xabar', () => {
  const w = (userId: string, params: Record<string, string> = {}) => ({ id: 'w1', userId, kind: 'LISTING', params });
  const flush = () => new Promise((r) => setImmediate(r));

  it("tasdiqlangan e'londan keyin egasiga ham, kutayotgan odamga ham xabar ketadi", async () => {
    const { uc, pushed } = make(base, [w('waiter', { listingKind: 'TRUCK', regionCode: 'UZ-TK' })]);
    await uc.decide('l1', true, null);
    await flush();
    await flush();
    expect(pushed.some((p) => p.title.includes('tasdiqlandi'))).toBe(true);
    expect(pushed.some((p) => p.title.includes('Kutgan narsangiz chiqdi'))).toBe(true);
  });

  it("namuna e'londa hech kimga bormaydi", async () => {
    const { uc, pushed } = make({ ...base, isDemo: true }, [w('waiter')]);
    await uc.decide('l1', true, null);
    await flush();
    await flush();
    expect(pushed).toHaveLength(0);
  });

  it("e'lon egasining o'zi kuzatuv xabarini olmaydi", async () => {
    const { uc, pushed } = make(base, [w('u1')]);
    await uc.decide('l1', true, null);
    await flush();
    await flush();
    expect(pushed.some((p) => p.title.includes('Kutgan narsangiz chiqdi'))).toBe(false);
  });

  it("rad etilgan e'lon kuzatuvchilarga bormaydi", async () => {
    const { uc, pushed } = make(base, [w('waiter')]);
    await uc.decide('l1', false, 'sabab');
    await flush();
    await flush();
    expect(pushed.some((p) => p.title.includes('Kutgan narsangiz chiqdi'))).toBe(false);
  });
});
