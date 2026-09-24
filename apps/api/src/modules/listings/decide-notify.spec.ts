import { describe, expect, it } from 'vitest';
import { ListingsUseCase } from './application/listings.usecase';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

/**
 * Admin qarori egasiga yetib borishi kerak: ilgari u faqat auditda qolardi.
 * Qo'ng'iroq va Telegram bitta yordamchidan chiqadi, shuning uchun bu yerda
 * yozilgan qatorlar ikkala kanalning ham matnini bildiradi.
 */
function make(row: Record<string, unknown>) {
  const pushed: { title: string; body: string | null }[] = [];
  const repo = {
    findById: async () => row,
    setStatus: async (_id: string, patch: Record<string, unknown>) => ({ ...row, ...patch }),
  } as never;
  const prisma = {
    user: { findMany: async (a: { where: { id: { in: string[] } } }) => a.where.id.in.map((id) => ({ id, locale: 'uz' })) },
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  const notifications = {
    recipients: async (w: { userIds?: (string | null | undefined)[] }) => (w.userIds ?? []).filter((x): x is string => !!x),
    push: async (_ids: readonly string[], n: { title: string; body?: string | null }) => { pushed.push({ title: n.title, body: n.body ?? null }); },
  } as unknown as NotificationsService;
  const subs = { raiseListing: async () => {} } as never;
  const uc = new ListingsUseCase(repo, {} as never, prisma, notifications, subs, {} as never);
  return { uc, pushed };
}

const base = { id: 'l1', status: 'PENDING_REVIEW', title: 'Kran 25 t', orgId: null, ownerUserId: 'u1', createdById: 'u1', kind: 'TRUCK' };

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
