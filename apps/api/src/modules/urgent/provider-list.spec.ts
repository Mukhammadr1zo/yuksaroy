// Ijrochi taxtasi: o'zim taklif bergan so'rov ro'yxatdan chiqib ketmasin.
//
// Nega alohida sinov: taklif tanlangach so'rov AWARDED bo'ladi. Ro'yxat faqat
// `status: 'OPEN'` ni so'rasa g'olib "Taklifingiz tanlandi" xabaridagi havolani bosib
// so'rovni ham, buyurtmachining raqamini ham topmaydi, ya'ni xabar odamni bo'sh
// ekranga olib boradi. Shart kodda bitta joyda, shu yerda qulflanadi.
import { describe, expect, it } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { UrgentController } from './urgent.controller';

type Where = {
  OR: { status?: string; createdAt?: unknown; regionCode?: { in: string[] }; offers?: { some: { providerUserId: string } } }[];
  createdById: { not: string };
};

/** regionCode null bo'lsa tashkilot hamma hududni ko'radi (mavjud qoida). */
function setup(regionCode: string | null) {
  const seen: { where?: Where } = {};
  const prisma = {
    membership: { findMany: async () => [{ orgId: 'o1', org: { regionCode } }] },
    urgentRequest: {
      findMany: async (a: { where: Where }) => { seen.where = a.where; return []; },
    },
  } as unknown as PrismaService;
  const c = new UrgentController(prisma, {} as AuditService, {} as NotificationsService);
  return { c, seen };
}

describe("ijrochi taxtasi: men taklif bergan so'rov", () => {
  it("shart 'OCHIQ yoki men taklif bergan': AWARDED qatori ham qoladi", async () => {
    const { c, seen } = setup('UZ-TK');
    await c.list('ijrochi', 'provider');
    const or = seen.where!.OR;
    expect(or).toHaveLength(2);
    expect(or[0].status).toBe('OPEN');
    expect(or[1]).toEqual({ offers: { some: { providerUserId: 'ijrochi' } } });
    // O'z so'rovim bu ro'yxatda hech qachon chiqmaydi
    expect(seen.where!.createdById).toEqual({ not: 'ijrochi' });
  });

  it("muddat va hudud faqat OCHIQ shoxida: o'z taklifim ikki kundan keyin ham topiladi", async () => {
    const { c, seen } = setup('UZ-TK');
    await c.list('ijrochi', 'provider');
    const or = seen.where!.OR;
    expect(or[0].createdAt).toBeTruthy();
    expect(or[0].regionCode?.in).toContain('UZ-TK');
    expect(or[1].createdAt).toBeUndefined();
    expect(or[1].regionCode).toBeUndefined();
  });

  it("hududi kiritilmagan tashkilotda hudud filtri umuman qo'yilmaydi", async () => {
    const { c, seen } = setup(null);
    await c.list('ijrochi', 'provider');
    expect(seen.where!.OR[0].regionCode).toBeUndefined();
  });
});
