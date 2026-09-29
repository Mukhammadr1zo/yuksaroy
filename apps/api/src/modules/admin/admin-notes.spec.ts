import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import { AdminNotesController } from './admin-notes.controller';

/**
 * Izoh: oq ro'yxatdan tashqari obyekt turi rad etiladi, bo'sh matn saqlanmaydi,
 * o'chirilgan izohning matni auditda qoladi (ega o'chirsa ham iz yo'qolmasin).
 */
function make(orgCount = 1) {
  const logs: { action: string; entity?: string; entityId?: string; meta?: unknown }[] = [];
  const notes = new Map<string, { id: string; entity: string; entityId: string; authorId: string; text: string; createdAt: Date }>();
  notes.set('n1', { id: 'n1', entity: 'Organization', entityId: 'o1', authorId: 'op', text: 'qo\'ng\'iroq qilindi', createdAt: new Date() });
  const prisma = {
    organization: { count: async () => orgCount },
    terminal: { count: async () => 0 },
    listing: { count: async () => 0 },
    user: {
      count: async () => 0,
      findUnique: async () => ({ id: 'op', fullName: 'Operator', phone: null }),
      findMany: async () => [],
    },
    adminNote: {
      create: async (a: { data: { entity: string; entityId: string; authorId: string; text: string } }) => {
        const n = { id: 'n2', createdAt: new Date(), ...a.data };
        notes.set(n.id, n);
        return n;
      },
      findUnique: async (a: { where: { id: string } }) => notes.get(a.where.id) ?? null,
      delete: async (a: { where: { id: string } }) => { notes.delete(a.where.id); },
      count: async () => notes.size,
      findMany: async () => [...notes.values()],
    },
  } as unknown as PrismaService;
  const audit = { log: async (e: (typeof logs)[number]) => { logs.push(e); } } as unknown as AuditService;
  return { c: new AdminNotesController(prisma, audit), logs, notes };
}

describe('ichki izohlar', () => {
  it("oq ro'yxatdan tashqari tur 400 BAD_ENTITY", async () => {
    const { c } = make();
    await expect(c.create('op', { entity: 'Session' as never, entityId: 's1', text: 'x' })).rejects.toThrow(BadRequestException);
    await expect(c.list('Session', 'x')).rejects.toThrow(BadRequestException);
  });

  it("bo'sh matn saqlanmaydi", async () => {
    const { c, logs } = make();
    await expect(c.create('op', { entity: 'Organization', entityId: 'o1', text: '   ' })).rejects.toThrow(BadRequestException);
    expect(logs).toHaveLength(0);
  });

  it("yo'q obyektga izoh yozilmaydi: 404 OBJECT_NOT_FOUND", async () => {
    const { c } = make(0);
    await expect(c.create('op', { entity: 'Organization', entityId: 'yoq', text: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('yaratilgan izoh muallif bilan qaytadi, audit obyektga yoziladi', async () => {
    const { c, logs } = make();
    const r = await c.create('op', { entity: 'Organization', entityId: 'o1', text: '  kelishildi  ' });
    expect(r.text).toBe('kelishildi');
    expect(r.author).toEqual({ id: 'op', fullName: 'Operator', phone: null });
    expect(logs[0]).toMatchObject({ action: 'admin.note.create', entity: 'Organization', entityId: 'o1', meta: { noteId: 'n2', len: 10 } });
  });

  it("o'chirishda matn audit meta da qoladi", async () => {
    const { c, logs, notes } = make();
    expect(await c.remove('ega', 'n1')).toEqual({ id: 'n1', deleted: true });
    expect(notes.has('n1')).toBe(false);
    expect(logs[0]).toMatchObject({ action: 'admin.note.delete', entity: 'Organization', entityId: 'o1', meta: { noteId: 'n1', authorId: 'op', text: 'qo\'ng\'iroq qilindi' } });
    await expect(c.remove('ega', 'n1')).rejects.toThrow(NotFoundException);
  });
});
