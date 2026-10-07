// Namuna terminalga yozishma ochilmaydi: egasi yo'q, xabar hech kimga bormaydi. Soxta prisma, baza yo'q.
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PlatformAdmin } from '../organizations/application/platform-admin';
import { ChatService } from './chat.service';

/**
 * created: ochilgan yozishmalar; terminal namuna yoki haqiqiy. sent: yozilgan xabarlar.
 * thread: namuna bilan avval ochilgan yozishma (i-old): subject namuna terminal yoki e'lon.
 */
function setup(isDemo: boolean, thread: { terminal?: { isDemo: boolean } | null; listing?: { isDemo: boolean } | null } = {}) {
  const created: unknown[] = [];
  const sent: unknown[] = [];
  const prisma = {
    terminal: { findFirst: async () => ({ id: 't1', name: 'Sergeli konteyner maydoni', slug: 'sergeli', orgId: 'o1', status: 'ACTIVE', isDemo }) },
    inquiry: {
      findFirst: async () => null,
      create: async (a: unknown) => { created.push(a); return { id: 'i1' }; },
      findUnique: async () => ({
        id: 'i-old', fromUserId: 'mijoz', toOrgId: 'o1', toUserId: null, toPlatform: false, status: 'OPEN',
        terminal: thread.terminal ? { id: 't1', slug: 'sergeli', name: 'Sergeli konteyner maydoni', kind: 'AUTO', ...thread.terminal } : null,
        listing: thread.listing ? { id: 'l1', slug: 'vagon', title: 'Vagon', kind: 'WAGON', ...thread.listing } : null,
      }),
      update: async () => ({}),
      updateMany: async () => ({ count: 1 }),
    },
    membership: { findMany: async () => [] },
    inquiryMessage: { create: async (a: unknown) => { sent.push(a); return { id: 'm1', text: 'x', createdAt: new Date() }; } },
  } as unknown as PrismaService;
  // Oluvchi yo'q: xabarnoma darhol qaytadi, Telegram chaqirilmaydi
  const notifications = { recipients: async () => [] } as unknown as NotificationsService;
  const platform = { adminUserIds: async () => [] } as unknown as PlatformAdmin;
  return { svc: new ChatService(prisma, notifications, platform), created, sent };
}

const codeOf = (e: unknown) => (e instanceof ForbiddenException ? (e.getResponse() as { code?: string }).code : e);

describe('namuna terminalga yozish', () => {
  it('yozishma ochilmaydi: DEMO_TARGET, bazaga hech narsa yozilmaydi', async () => {
    const { svc, created } = setup(true);
    expect(codeOf(await svc.startTerminal('mijoz', 'sergeli', 'Bugun joy bormi?', null).catch((e) => e))).toBe('DEMO_TARGET');
    expect(created).toEqual([]);
  });

  it('avvalgi yozishmani qidirish ham rad etiladi', async () => {
    const { svc } = setup(true);
    expect(codeOf(await svc.findForSubject('mijoz', 'sergeli').catch((e) => e))).toBe('DEMO_TARGET');
  });

  it('haqiqiy terminalga yozishma ochiladi', async () => {
    const { svc, created } = setup(false);
    expect(await svc.startTerminal('mijoz', 'sergeli', 'Bugun joy bormi?', null)).toEqual({ id: 'i1' });
    expect(created).toHaveLength(1);
  });
});

// Yangi yozishma yopilgan, lekin namuna bilan avval ochilgani bor bo'lishi mumkin: unga ham yozilmaydi
describe('namuna bilan avval ochilgan yozishma', () => {
  it("terminal yoki e'lon namuna bo'lsa xabar yozilmaydi: DEMO_TARGET", async () => {
    for (const thread of [{ terminal: { isDemo: true } }, { listing: { isDemo: true } }]) {
      const { svc, sent } = setup(true, thread);
      expect(codeOf(await svc.send('mijoz', 'i-old', 'Javob bormi?').catch((e) => e))).toBe('DEMO_TARGET');
      expect(sent).toEqual([]);
    }
  });

  it("haqiqiy obyekt bilan yozishmada xabar odatdagidek yoziladi", async () => {
    const { svc, sent } = setup(false, { terminal: { isDemo: false } });
    expect(await svc.send('mijoz', 'i-old', 'Javob bormi?')).toMatchObject({ id: 'm1', mine: true });
    expect(sent).toHaveLength(1);
  });
});
