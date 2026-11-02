// GET /urgent/:id: egasi va platforma adminlari ko'radi, boshqa foydalanuvchi 403, yo'q so'rov 404.
import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { UrgentController } from './urgent.controller';

function setup(opts: { owner: string | null; admin: boolean }) {
  const row = { id: 'u1', createdById: opts.owner, status: 'OPEN', createdAt: new Date(), statusToken: 't', contactPhone: '+998901112233', offers: [] as unknown[] };
  const prisma = {
    urgentRequest: {
      findUnique: async () => (opts.owner ? { createdById: opts.owner } : null),
      findMany: async () => (opts.owner ? [row] : []),
    },
    user: { findUnique: async () => ({ phone: null, memberships: opts.admin ? [{ id: 'm' }] : [] }) },
    auditLog: { findMany: async () => [] },
    organization: { findMany: async () => [] },
  } as unknown as PrismaService;
  return new UrgentController(prisma, {} as AuditService, {} as NotificationsService);
}

describe('GET /urgent/:id', () => {
  it('egasi o\'z so\'rovini oladi', async () => {
    const r = await setup({ owner: 'a', admin: false }).one('a', 'u1');
    expect(r.id).toBe('u1');
    expect(r.contactPhone).toBe('+998901112233');
  });
  it('platforma admini boshqaning so\'rovini ko\'radi', async () => {
    const r = await setup({ owner: 'a', admin: true }).one('admin', 'u1');
    expect(r.id).toBe('u1');
    expect(r.contactPhone).toBeNull(); // admin telefonni ko'rmaydi
  });
  it('begona foydalanuvchi 403 oladi', async () => {
    await expect(setup({ owner: 'a', admin: false }).one('b', 'u1')).rejects.toMatchObject({ response: { code: 'NOT_OWNER' } });
  });
  it('yo\'q so\'rov 404', async () => {
    await expect(setup({ owner: null, admin: false }).one('a', 'zzz')).rejects.toMatchObject({ response: { code: 'URGENT_NOT_FOUND' } });
  });
});
