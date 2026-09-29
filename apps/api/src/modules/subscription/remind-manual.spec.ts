// Qo'lda eslatma: kun chegarasi Toshkent, kuniga bitta, audit yozilmasa xabar ketmaydi.
import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { remindBlockedAt, remindDayStart, remindManual } from './remind-manual';

describe('remindDayStart', () => {
  it('kun Toshkent bo\'yicha boshlanadi: 20:30Z allaqachon ertangi kun', () => {
    expect(remindDayStart(new Date('2026-09-29T20:30:00Z')).toISOString()).toBe('2026-09-29T19:00:00.000Z');
    expect(remindDayStart(new Date('2026-09-29T10:00:00Z')).toISOString()).toBe('2026-09-28T19:00:00.000Z');
  });
});

describe('remindBlockedAt', () => {
  const dayStart = new Date('2026-09-28T19:00:00Z');
  const today = new Date('2026-09-29T05:00:00Z');
  const todayLater = new Date('2026-09-29T08:00:00Z');
  const yesterday = new Date('2026-09-28T10:00:00Z');

  it('ikkalasi bo\'sh: to\'siq yo\'q', () => expect(remindBlockedAt(null, null, dayStart)).toBeNull());
  it('kecha yuborilgani to\'smaydi', () => expect(remindBlockedAt(yesterday, yesterday, dayStart)).toBeNull());
  it('bugun avto eslatma ketgan bo\'lsa to\'sadi', () => expect(remindBlockedAt(yesterday, today, dayStart)).toEqual(today));
  it('ikkalasi bugun: eng yangisi qaytadi', () => expect(remindBlockedAt(todayLater, today, dayStart)).toEqual(todayLater));
});

/** Soxta bog'lanishlar: faol obuna bitta, audit bugun bo'sh. */
function fakes(o: { auditFails?: boolean; status?: string; remindedAt?: Date | null } = {}) {
  const logged: unknown[] = [];
  let recipientsCalls = 0;
  const prisma = {
    subscription: {
      findUnique: async () => ({ id: 's1', no: 'PAY-1', userId: 'u1', status: o.status ?? 'ACTIVE', endsAt: new Date('2026-10-02T00:00:00Z'), remindedAt: o.remindedAt ?? null }),
    },
    auditLog: { findFirst: async () => null },
    user: { findMany: async () => [] },
    telegramLink: { findMany: async () => [] },
  } as unknown as PrismaService;
  const audit = {
    log: async (e: unknown) => { if (o.auditFails) throw new Error('db down'); logged.push(e); },
  } as unknown as AuditService;
  const notifications = {
    recipients: async (w: { userIds?: string[] }) => { recipientsCalls++; return w.userIds ?? []; },
    push: async () => {},
  } as unknown as NotificationsService;
  return { prisma, audit, notifications, logged, recipients: () => recipientsCalls };
}

const NOW = new Date('2026-09-29T06:00:00Z');

describe('remindManual', () => {
  it('audit yoziladi, keyin xabar ketadi, sentAt qaytadi', async () => {
    const f = fakes();
    const r = await remindManual(f.prisma, f.notifications, f.audit, 'admin', 's1', NOW);
    expect(r.sentAt).toBe(NOW.toISOString());
    expect(f.logged).toHaveLength(1);
    expect(f.logged[0]).toMatchObject({ action: 'admin.subscription.remind', entityId: 's1', meta: { userId: 'u1', no: 'PAY-1', manual: true } });
    expect(f.recipients()).toBe(1);
  });

  it('audit yiqilsa xabar yuborilmaydi', async () => {
    const f = fakes({ auditFails: true });
    await expect(remindManual(f.prisma, f.notifications, f.audit, 'admin', 's1', NOW)).rejects.toThrow('db down');
    expect(f.recipients()).toBe(0);
  });

  it('bugun avto eslatma ketgan: 409 REMIND_TODAY', async () => {
    const f = fakes({ remindedAt: new Date('2026-09-29T01:00:00Z') });
    await expect(remindManual(f.prisma, f.notifications, f.audit, 'admin', 's1', NOW)).rejects.toMatchObject({ response: { code: 'REMIND_TODAY' } });
    expect(f.logged).toHaveLength(0);
  });

  it('faol bo\'lmagan obuna: 409 SUBSCRIPTION_NOT_ACTIVE', async () => {
    const f = fakes({ status: 'PENDING' });
    await expect(remindManual(f.prisma, f.notifications, f.audit, 'admin', 's1', NOW)).rejects.toMatchObject({ response: { code: 'SUBSCRIPTION_NOT_ACTIVE', status: 'PENDING' } });
  });
});
