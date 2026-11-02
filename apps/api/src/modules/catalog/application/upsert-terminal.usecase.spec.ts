// Obyekt yozuvi: admin yashirganini egasi qayta ocha olmaydi; birinchi nashr adminlarga xabar beradi.
// Soxta repo/Prisma, Telegram yo'q (notifyBoth almashtirilgan).
import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';

const notified: { href: string }[] = [];
vi.mock('../../../common/telegram', () => ({ notifyBoth: async (_p: unknown, _n: unknown, o: { href: string }) => { notified.push(o); } }));

import { UpsertTerminalUseCase } from './upsert-terminal.usecase';

type Row = { action: string; meta?: unknown };
function make(o: { status: 'DRAFT' | 'ACTIVE' | 'HIDDEN'; audit?: Row[]; seenFirst?: boolean }) {
  const updates: unknown[] = [];
  const logged: string[] = [];
  const repo = {
    findTerminalById: async () => ({ id: 't1', orgId: 'o1', status: o.status, name: 'T', orgName: 'Org' }),
    updateTerminal: async (_id: string, d: { status?: string }) => { updates.push(d); return { id: 't1', orgId: 'o1', name: 'T', orgName: 'Org', status: d.status ?? o.status }; },
    findStationById: async () => null, findStationByEsr: async () => null,
  } as never;
  const prisma = { auditLog: {
    findMany: async () => o.audit ?? [],
    findFirst: async () => (o.seenFirst ? { id: 'x' } : null),
  } } as never;
  const audit = { log: async (e: { action: string }) => { logged.push(e.action); } } as never;
  const access = { assertObjectAdmin: async () => {} } as never;
  const admins = { adminUserIds: async () => ['a1'] } as never;
  return { uc: new UpsertTerminalUseCase(repo, access, prisma, audit, {} as never, admins), updates, logged };
}

describe('admin yashirgan obyekt', () => {
  it("admin yashirgan bo'lsa egasi tahrirlay ham, och ham olmaydi", async () => {
    const { uc, updates } = make({ status: 'HIDDEN', audit: [{ action: 'admin.terminal.bulkHide' }] });
    await expect(uc.update('u1', 't1', { status: 'ACTIVE' })).rejects.toBeInstanceOf(ConflictException);
    expect(updates).toHaveLength(0);
  });

  it('admin PATCH bilan statusni HIDDEN qilgan bo\'lsa ham yopiq', async () => {
    const { uc } = make({ status: 'HIDDEN', audit: [{ action: 'admin.terminal.update', meta: { fields: ['status'] } }] });
    await expect(uc.update('u1', 't1', { name: 'Y' })).rejects.toBeInstanceOf(ConflictException);
  });

  it("admin boshqa maydonni tahrirlagani yashirishni bekor qilmaydi (status maydoni yo'q qator o'tkazib yuboriladi)", async () => {
    const { uc } = make({ status: 'HIDDEN', audit: [{ action: 'admin.terminal.update', meta: { fields: ['name'] } }, { action: 'admin.terminal.bulkHide' }] });
    await expect(uc.update('u1', 't1', { status: 'ACTIVE' })).rejects.toBeInstanceOf(ConflictException);
  });

  it("egasining o'zi yashirgan bo'lsa qayta ocha oladi", async () => {
    const { uc, updates } = make({ status: 'HIDDEN', audit: [{ action: 'terminal.update', meta: { fields: ['status'] } }, { action: 'admin.terminal.bulkHide' }] });
    await uc.update('u1', 't1', { status: 'ACTIVE' });
    expect(updates).toHaveLength(1);
  });

  it("admin qayta ochgandan keyin yana yashirmagan bo'lsa egasi tahrirlay oladi", async () => {
    const { uc } = make({ status: 'HIDDEN', audit: [{ action: 'admin.terminal.bulkActivate' }, { action: 'admin.terminal.bulkHide' }] });
    await expect(uc.update('u1', 't1', { description: 'x' })).resolves.toBeTruthy();
  });
});

describe('birinchi nashr', () => {
  it('DRAFT dan ACTIVE ga birinchi marta: adminlarga xabar va belgi', async () => {
    notified.length = 0;
    const { uc, logged } = make({ status: 'DRAFT' });
    await uc.update('u1', 't1', { status: 'ACTIVE' });
    expect(notified.map((n) => n.href)).toEqual(['/admin/terminals/t1']);
    expect(logged).toEqual(['terminal.firstPublish']);
  });

  it("avval nashr qilingan bo'lsa (yashirib qayta ochish) xabar takrorlanmaydi", async () => {
    notified.length = 0;
    const { uc } = make({ status: 'DRAFT', seenFirst: true });
    await uc.update('u1', 't1', { status: 'ACTIVE' });
    expect(notified).toHaveLength(0);
  });

  it('ACTIVE obyektni tahrirlash nashr hisoblanmaydi', async () => {
    notified.length = 0;
    const { uc } = make({ status: 'ACTIVE' });
    await uc.update('u1', 't1', { description: 'x' });
    expect(notified).toHaveLength(0);
  });
});
