// "Javob shart emas" va javob kutayotgan eski suhbatlarni qayta ochish. Soxta prisma, baza yo'q.
//
// Egasi qarori (2026-10-07): qabul qiluvchi tomon OPEN suhbatni xabar yozmasdan ANSWERED qiladi,
// "rahmat" bilan tugagan suhbat navbatda turib qolmasin. Mijoz yana yozsa suhbat odatdagidek qayta
// ochiladi. ce36e0b gacha qayta ochilmay qolgan suhbatlarni migratsiya bir marta OPEN qiladi.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { queueStats } from '../../common/admin-queues';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PlatformAdmin } from '../organizations/application/platform-admin';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NO_REPLY_ACTION } from './inquiry-status';

const SEEN = new Date('2026-10-07T09:00:00.000Z');
const seen = { lastMessageAt: SEEN.toISOString() };

/**
 * Bazadagi bitta suhbat: 'mijoz' boshlagan, qabul qiluvchi o1 tashkiloti (a'zosi 'xodim') yoki
 * platforma ('admin'). updateMany where ni Postgres kabi shu qatorga solishtiradi.
 */
function setup(status: 'OPEN' | 'ANSWERED', toPlatform = false) {
  const row = { id: 'i1', fromUserId: 'mijoz', toOrgId: toPlatform ? null : 'o1', toUserId: null, toPlatform, status: status as string, lastMessageAt: SEEN as Date | null, listing: null, terminal: null };
  const messages: string[] = [];
  const audit: unknown[] = [];
  const prisma = {
    inquiry: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({ where, data }: { where: { status?: string; lastMessageAt?: Date | null }; data: Partial<typeof row> }) => {
        const hit = (where.status === undefined || where.status === row.status)
          && (!('lastMessageAt' in where) || where.lastMessageAt?.getTime() === row.lastMessageAt?.getTime());
        if (hit) Object.assign(row, data);
        return { count: hit ? 1 : 0 };
      },
    },
    membership: { findMany: async (a: { where: { userId: string } }) => (a.where.userId === 'xodim' ? [{ orgId: 'o1' }] : []) },
    inquiryMessage: {
      create: async (a: { data: { text: string } }) => {
        messages.push(a.data.text);
        return { id: 'm2', text: a.data.text, createdAt: new Date(SEEN.getTime() + 60_000) };
      },
    },
  } as unknown as PrismaService;
  // Oluvchi yo'q: xabarnoma darhol qaytadi
  const notifications = { recipients: async () => [] } as unknown as NotificationsService;
  const platform = { isPlatformAdmin: async (id: string) => id === 'admin', adminUserIds: async () => [] } as unknown as PlatformAdmin;
  const svc = new ChatService(prisma, notifications, platform);
  const ctl = new ChatController(svc, { log: async (e: unknown) => { audit.push(e); } } as unknown as AuditService);
  return { svc, ctl, row, messages, audit };
}

describe('"Javob shart emas"', () => {
  it('qabul qiluvchi OPEN suhbatni xabarsiz ANSWERED qiladi, audit qatori yoziladi', async () => {
    const { ctl, row, messages, audit } = setup('OPEN');
    expect(await ctl.noReply('xodim', 'i1', seen)).toEqual({ id: 'i1', status: 'ANSWERED' });
    expect(row.status).toBe('ANSWERED');
    // Oxirgi xabar vaqti o'zgarmaydi: ro'yxat tartibi joyida qoladi
    expect(row.lastMessageAt).toEqual(SEEN);
    expect(messages).toEqual([]);
    expect(audit).toEqual([{ actorId: 'xodim', action: NO_REPLY_ACTION, entity: 'Inquiry', entityId: 'i1' }]);
  });

  it('platforma suhbatida platforma admini ham qila oladi', async () => {
    const { ctl, row } = setup('OPEN', true);
    await ctl.noReply('admin', 'i1', seen);
    expect(row.status).toBe('ANSWERED');
  });

  it("mijoz o'z savolini javobsiz deb yopa olmaydi", async () => {
    const { ctl, row, audit } = setup('OPEN');
    await expect(ctl.noReply('mijoz', 'i1', seen)).rejects.toBeInstanceOf(ForbiddenException);
    expect(row.status).toBe('OPEN');
    expect(audit).toEqual([]);
  });

  it('faqat OPEN suhbatdan', async () => {
    const { ctl, audit } = setup('ANSWERED');
    await expect(ctl.noReply('xodim', 'i1', seen)).rejects.toBeInstanceOf(ConflictException);
    expect(audit).toEqual([]);
  });

  it("oyna ochilgandan keyin mijoz yana yozgan bo'lsa rad etiladi", async () => {
    // Qabul qiluvchi eski holatni ko'rib turibdi: yangi savol ko'rilmasdan yopilib qolmasin
    const { ctl, row } = setup('OPEN');
    const before = { lastMessageAt: new Date(SEEN.getTime() - 60_000).toISOString() };
    await expect(ctl.noReply('xodim', 'i1', before)).rejects.toBeInstanceOf(ConflictException);
    expect(row.status).toBe('OPEN');
  });

  it('keyin mijoz yana yozsa suhbat qayta ochiladi', async () => {
    const { svc, ctl, row } = setup('OPEN');
    await ctl.noReply('xodim', 'i1', seen);
    await svc.send('mijoz', 'i1', 'Yana bir savol');
    expect(row.status).toBe('OPEN');
  });
});

describe('platforma navbati yoshi', () => {
  it('"Javob shart emas" dan oldingi mijoz xabarlari kutayotgan hisoblanmaydi', async () => {
    // Xabar yozilmaydi, shuning uchun yosh audit qatoriga qaraydi. Amal nomi controller yozadigani
    // bilan bir xil bo'lishi shart: aks holda yosh yopilgan "rahmat" dan sanalardi
    const sqls: string[] = [];
    const none = { count: async () => 0, findFirst: async () => null };
    const prisma = {
      listing: none, organization: none, terminal: none, premiumOrder: none, subscription: none,
      order: none, urgentRequest: none, contactMessage: none, report: none, inquiry: none,
      membership: { findMany: async () => [] }, user: { findMany: async () => [] },
      $queryRaw: async (sql: TemplateStringsArray) => { sqls.push(sql.join('?')); return [{ at: null }]; },
    } as never;
    await queueStats(prisma, true);
    expect(sqls.join(' ').replace(/\s+/g, ' ')).toContain(`a."action" = '${NO_REPLY_ACTION}' AND a."createdAt" > m."createdAt"`);
  });
});

describe('javob kutayotgan eski suhbatlarni qayta ochish (migratsiya)', () => {
  // Baza yo'q: SQL matnining o'zi tekshiriladi, izohlarsiz va bo'shliqlar bittaga keltirilib
  const sql = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261007020000_reopen_waiting_chats', 'migration.sql'), 'utf8')
    .replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();

  it('bitta UPDATE: faqat ANSWERED dan OPEN ga va faqat status', () => {
    expect(sql.split(';').filter((s) => s.trim())).toHaveLength(1);
    expect(sql).toMatch(/^UPDATE "Inquiry" i SET "status" = 'OPEN' WHERE i\."status" = 'ANSWERED' AND /);
    // lastMessageAt yozilmaydi: ro'yxat tartibi o'zgarmasin
    expect(sql).not.toMatch(/lastMessageAt|updatedAt/);
  });

  it("eng yangi xabar (vaqti teng bo'lsa id) mijozniki; xabarsiz suhbatda NULL, qator o'zgarmaydi", () => {
    expect(sql).toContain('i."fromUserId" = ( SELECT m."fromUserId" FROM "InquiryMessage" m WHERE m."inquiryId" = i."id" ORDER BY m."createdAt" DESC, m."id" DESC LIMIT 1 )');
  });

  it("qayta ochilgani kelganlar ro'yxatida tepada: 200 chegarasi uni kesmaydi", async () => {
    // Oxirgi xabari eski, faqat vaqt bo'yicha tartibda 200 tadan tashqarida qolib, ochib bo'lmasdi
    const orders: unknown[] = [];
    const prisma = {
      membership: { findMany: async () => [{ orgId: 'o1' }] },
      inquiry: { findMany: async (a: { orderBy: unknown }) => { orders.push(a.orderBy); return []; } },
    } as unknown as PrismaService;
    const svc = new ChatService(prisma, {} as NotificationsService, { isPlatformAdmin: async () => false } as unknown as PlatformAdmin);
    await svc.list('xodim', 'owner');
    await svc.list('mijoz', 'mine');
    const byTime = [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }];
    expect(orders).toEqual([[{ status: 'desc' }, ...byTime], byTime]);
  });
});
