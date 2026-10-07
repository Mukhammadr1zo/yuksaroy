// Shoshilinch so'rov kimga ketadi va yaratish javobi necha kishini aytadi. Soxta Prisma, DB yo'q.
//
// Ilgari xabar faqat tashkilot EGASIGA va faqat hududi to'g'ri kelgan tashkilotga borardi:
// dispetcher so'rovni ijrochi ro'yxatida ko'rsa ham xabarini olmasdi, hududi kiritilmagan
// tashkilot esa ro'yxatda hammasini ko'rib, birorta ham xabar olmasdi. Endi yuk bilan bitta qoida.
import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../common/audit.service';
import type { PrismaService } from '../../common/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { UrgentController } from './urgent.controller';

type Where = Record<string, any>;
type Row = { id: string; status: string; createdAt: Date };

/** team: so'rov egasining hamkasblari. broken: ijrochilar qidiruvi yiqiladi. rows: "mening ro'yxatim". */
function setup(opts: { members?: string[]; admins?: string[]; team?: string[]; broken?: boolean; rows?: Row[]; audit?: { entityId: string; meta: unknown }[] } = {}) {
  const memberWhere: Where[] = [];
  const fanout: Where[] = [];
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      $queryRaw: async () => [{ nextval: 1001n }],
      urgentRequest: { create: async (a: { data: Where }) => ({ id: 'u1', status: 'OPEN', createdAt: new Date(), updatedAt: new Date(), awardedOfferId: null, ...a.data }) },
    }),
    membership: {
      findMany: async (a: { where: Where }) => {
        if (a.where.roles) return (opts.admins ?? []).map((userId) => ({ userId }));
        if (a.where.org?.members) return (a.where.userId.in as string[]).filter((id) => (opts.team ?? []).includes(id)).map((userId) => ({ userId }));
        if (opts.broken) throw new Error('baza uzildi');
        memberWhere.push(a.where);
        return (opts.members ?? []).map((userId) => ({ userId }));
      },
    },
    // Telefon bo'yicha admin yo'q; til so'rovi hammaga uz
    user: { findMany: async (a: { where: { id?: { in: string[] }; phone?: unknown } }) => (a.where.phone ? [] : (a.where.id?.in ?? []).map((id) => ({ id, locale: 'uz' }))) },
    auditLog: {
      create: async (a: { data: Where }) => { fanout.push(a.data); return {}; },
      findMany: async () => opts.audit ?? [],
    },
    // Hech kim Telegram bog'lamagan: haqiqiy botga hech narsa ketmaydi
    telegramLink: { findMany: async () => [] },
    urgentRequest: {
      findMany: async () => (opts.rows ?? ['r1', 'r2', 'r3'].map((id) => ({ id, status: 'OPEN', createdAt: new Date() }))).map((r) => ({ ...r, statusToken: `t-${r.id}`, offers: [] })),
    },
    organization: { findMany: async () => [] },
  } as unknown as PrismaService;
  const notes: { ids: string[]; n: Where }[] = [];
  const notifications = {
    push: async (ids: readonly string[], n: Where) => { notes.push({ ids: [...ids], n }); },
    recipients: async (w: { userIds?: (string | null)[] }) => (w.userIds ?? []).filter((x): x is string => !!x),
  } as unknown as NotificationsService;
  const audit = { log: async () => {} } as unknown as AuditService;
  return { c: new UrgentController(prisma, audit, notifications), memberWhere, fanout, notes };
}

const dto = { kind: 'LOCO_CALL' as const, regionCode: 'UZ-TK' as const, description: 'Vagonlar turib qoldi', contactPhone: '+998901234567' };

describe("shoshilinch so'rov: yuk bilan bitta qoida", () => {
  it("egasi ham, dispetcher ham oladi; hududsiz tashkilot ham; namuna va bloklangan chetda", async () => {
    const { c, memberWhere } = setup({ members: ['owner', 'dispatcher'] });
    const r = await c.create('client-1', dto);
    const w = memberWhere[0]!;
    expect(w).not.toHaveProperty('isOwner');
    expect(w.userId).toEqual({ not: 'client-1' });
    expect(w.user).toEqual({ isActive: true });
    expect(w.org.isDemo).toBe(false);
    expect(w.org.OR[0].regionCode.in).toContain('UZ-TK');
    expect(w.org.OR[1]).toEqual({ regionCode: null });
    expect(r.sentReal).toBe(2);
  });

  it('yaratish javobi adminlarsiz sonni aytadi, jurnalda ikkala son', async () => {
    const { c, fanout } = setup({ members: ['admin1', 'loco'], admins: ['admin1'] });
    const r = await c.create('client-2', dto);
    expect(r.sentReal).toBe(1);
    expect(fanout[0]).toMatchObject({ action: 'request.fanout', entity: 'UrgentRequest', entityId: 'u1', meta: { board: 'URGENT', region: 'UZ-TK', type: 'LOCO_CALL', sent: 2, sentReal: 1 } });
  });

  it("hech kimga ketmasa adminlarga panel qo'ng'irog'i: shoshilinch so'rovlar ekraniga, raqami bilan", async () => {
    const { c, notes } = setup({ admins: ['admin1'] });
    const r = await c.create('client-4', dto);
    await new Promise((ok) => setTimeout(ok, 0)); // ogohlantirish kutilmaydi
    expect(r.sentReal).toBe(0);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.ids).toEqual(['admin1']);
    expect(notes[0]!.n).toMatchObject({ kind: 'claim', href: '/admin/urgent?q=UR-1001' });
    expect(notes[0]!.n.body).toContain('Teplovoz chaqirish');
    expect(notes[0]!.n.body).toContain('Toshkent shahri');
  });

  it("mening ro'yxatimda son jurnaldan: eski qatordagi sent ko'rsatilmaydi (namunani ham sanagan), yozuvi yo'q so'rovda null", async () => {
    const { c } = setup({ audit: [{ entityId: 'r1', meta: { board: 'URGENT', sent: 3 } }, { entityId: 'r2', meta: { board: 'URGENT', sent: 2, sentReal: 0 } }] });
    const { items } = (await c.list('client-3')) as { items: { id: string; sentReal: number | null }[] };
    expect(items.map((x) => [x.id, x.sentReal])).toEqual([['r1', null], ['r2', 0], ['r3', null]]);
  });

  it("listed: faqat ochiq va 48 soatdan yangi so'rov ijrochilarga ko'rinib turadi", async () => {
    const h = (n: number) => new Date(Date.now() - n * 3_600_000);
    const { c } = setup({ rows: [{ id: 'fresh', status: 'OPEN', createdAt: h(1) }, { id: 'old', status: 'OPEN', createdAt: h(49) }, { id: 'closed', status: 'CLOSED', createdAt: h(1) }] });
    const { items } = (await c.list('client-5')) as { items: { id: string; listed: boolean }[] };
    expect(items.map((x) => [x.id, x.listed])).toEqual([['fresh', true], ['old', false], ['closed', false]]);
  });

  it("hamkasb xabarni oladi, lekin sanalmaydi; qidiruv yiqilsa so'rov yaratiladi, son null, jurnalda failed", async () => {
    const team = setup({ members: ['colleague', 'loco'], team: ['colleague'] });
    expect((await team.c.create('client-6', dto)).sentReal).toBe(1);
    expect(team.fanout[0]).toMatchObject({ meta: { sent: 2, sentReal: 1 } });

    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const broken = setup({ broken: true, admins: ['admin1'] });
    const r = await broken.c.create('client-7', dto);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(r).toMatchObject({ no: 'UR-1001', sentReal: null });
    expect(broken.fanout[0]).toMatchObject({ meta: { sent: 0, sentReal: 0, failed: true } });
    expect(broken.notes[0]!.n).toMatchObject({ kind: 'claim', href: '/admin/urgent?q=UR-1001' });
    vi.restoreAllMocks();
  });
});
