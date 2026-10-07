// Mijozning keyingi savoli suhbatni qayta ochadi. Soxta prisma, baza yo'q.
//
// Egasi qarori (2026-10-07): javob olgan suhbatga mijoz yana yozsa suhbat OPEN ga qaytadi va
// kabinetda yana "Javob kutilmoqda" bo'ladi, platformaniki admin navbatiga ham qaytadi. Ilgari
// status faqat egasi yozganda o'zgarardi va keyingi savol hech qayerda kutilayotgan bo'lib chiqmasdi.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PlatformAdmin } from '../organizations/application/platform-admin';
import { ChatService } from './chat.service';

/** Suhbatni 'mijoz' boshlagan; egasi tarafi: o1 a'zosi 'xodim' yoki platforma. saved: yozilgan status, wheres: yozuv sharti. */
function setup(status: 'OPEN' | 'ANSWERED', toPlatform = false) {
  const saved: string[] = [];
  const wheres: unknown[] = [];
  const prisma = {
    inquiry: {
      findUnique: async () => ({ id: 'i1', fromUserId: 'mijoz', toOrgId: toPlatform ? null : 'o1', toUserId: null, toPlatform, status, listing: null, terminal: null }),
      updateMany: async (a: { where: unknown; data: { status: string } }) => { saved.push(a.data.status); wheres.push(a.where); return { count: 1 }; },
    },
    membership: { findMany: async (a: { where: { userId: string } }) => (a.where.userId === 'xodim' ? [{ orgId: 'o1' }] : []) },
    inquiryMessage: { create: async (a: { data: { text: string } }) => ({ id: 'm1', text: a.data.text, createdAt: new Date() }) },
  } as unknown as PrismaService;
  // Oluvchi yo'q: xabarnoma darhol qaytadi, Telegram ham, baza ham chaqirilmaydi
  const notifications = { recipients: async () => [] } as unknown as NotificationsService;
  const platform = { isPlatformAdmin: async (id: string) => id === 'admin', adminUserIds: async () => [] } as unknown as PlatformAdmin;
  return { svc: new ChatService(prisma, notifications, platform), saved, wheres };
}

describe('mijozning keyingi savoli', () => {
  it('javob olgan suhbatga mijoz yana yozsa OPEN ga qaytadi', async () => {
    const { svc, saved } = setup('ANSWERED');
    await svc.send('mijoz', 'i1', 'Narx hali amaldami?');
    expect(saved).toEqual(['OPEN']);
  });

  it('platformaga yozilgan suhbat ham qayta ochiladi', async () => {
    const { svc, saved } = setup('ANSWERED', true);
    await svc.send('mijoz', 'i1', 'Yana bir savol');
    expect(saved).toEqual(['OPEN']);
  });

  it('egasi tarafining xabari suhbatni hech qachon OPEN qilmaydi', async () => {
    for (const [status, who, toPlatform] of [['OPEN', 'xodim', false], ['ANSWERED', 'xodim', false], ['OPEN', 'admin', true]] as const) {
      const { svc, saved } = setup(status, toPlatform);
      await svc.send(who, 'i1', 'Ha, amalda');
      expect(saved, `${who} ${status}`).toEqual(['ANSWERED']);
    }
  });

  it('eski xabar yangisining statusini bosib ketmaydi', async () => {
    // Ikki tomon bir zumda yozsa so'rovlar teskari tartibda yetishi mumkin: bazada undan yangi
    // xabar turgan bo'lsa (lastMessageAt katta), bu xabarning statusi yozilmaydi
    const { svc, wheres } = setup('ANSWERED');
    const m = await svc.send('mijoz', 'i1', 'Yana savol');
    expect(wheres).toEqual([{ id: 'i1', OR: [{ lastMessageAt: null }, { lastMessageAt: { lte: m.createdAt } }] }]);
  });
});

describe("ro'yxatdagi matn", () => {
  it('javob kutayotgan suhbatda mijozning oxirgi savoli, javob olganida birinchi xabar', async () => {
    // Qayta ochilgan suhbatda "Javob kutilmoqda" yonida javob berilgan birinchi savol turardi
    const asked: unknown[] = [];
    const row = (id: string, status: string, message: string) => ({ id, status, message, fromOrgId: null, listing: null, terminal: null, createdAt: new Date(), lastMessageAt: new Date() });
    const prisma = {
      membership: { findMany: async () => [{ orgId: 'o1' }] },
      inquiry: { findMany: async () => [row('i1', 'OPEN', '40 futlik konteynerga joy bormi?'), row('i2', 'ANSWERED', 'Kran bormi?')] },
      inquiryMessage: { groupBy: async () => [] },
      $queryRaw: async (_sql: TemplateStringsArray, ids: unknown) => { asked.push(ids); return [{ id: 'i1', text: "Narx o'zgarmadimi?" }]; },
    } as unknown as PrismaService;
    const platform = { isPlatformAdmin: async () => false } as unknown as PlatformAdmin;
    const list = await new ChatService(prisma, {} as NotificationsService, platform).list('xodim', 'owner');
    expect(list.map((r) => r.message)).toEqual(["Narx o'zgarmadimi?", 'Kran bormi?']);
    // Javob olgan suhbat uchun xabarlar so'ralmaydi
    expect(asked).toEqual([['i1']]);
  });
});
