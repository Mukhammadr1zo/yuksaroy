// Signal ekranda gap aytadi: "bugun faol", "9 tasidan 8 tasiga javob bergan".
// Noto'g'ri chelak yoki noto'g'ri nisbat odamni yo'ldan chiqaradi, shuning uchun
// chegaralar shu yerda qotirilgan.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../common/prisma.service';
import { SIGNAL_NONE, ownerSignal, repliedRow, seenBucket } from './owner-signal';

const NOW = new Date('2026-09-24T03:00:00Z'); // Toshkentda 08:00
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('faollik chelagi', () => {
  it('kecha 20:00 UTC Toshkentda bugun: 24 soat emas, kun sanaladi', () => {
    expect(seenBucket(new Date('2026-09-23T20:00:00Z'), NOW)).toBe('today');
  });

  it('kecha va olti kun oldin: oxirgi bir haftada', () => {
    expect(seenBucket(ago(1), NOW)).toBe('week');
    expect(seenBucket(ago(6), NOW)).toBe('week');
  });

  it('yetti kun - jim oynaning aynan boshi: hech narsa aytilmaydi', () => {
    // Chegara `days < 7`, ya'ni 7.0 kun allaqachon oynadan tashqarida.
    // Eng oson buziladigan joy: `<=` ga o'zgarsa shu test yiqiladi
    expect(seenBucket(ago(7), NOW)).toBeNull();
  });

  it("sakkiz va o'n uch kun: hech narsa aytilmaydi (ikkala gap ham yolg'on bo'lardi)", () => {
    expect(seenBucket(ago(8), NOW)).toBeNull();
    expect(seenBucket(ago(13), NOW)).toBeNull();
  });

  it("o'n to'rt kun va undan ortig'i: kirmagan", () => {
    expect(seenBucket(ago(14), NOW)).toBe('away');
    expect(seenBucket(ago(200), NOW)).toBe('away');
  });

  it("sessiya qolmagan bo'lsa ham kirmagan (eskilari tozalanadi)", () => {
    expect(seenBucket(null, NOW)).toBe('away');
  });
});

describe('javob nisbati', () => {
  const row = (status: string, n: number) => ({ status, _count: { _all: n } });

  it('uchtadan kam yozishmada qator chizilmaydi', () => {
    expect(repliedRow([row('ANSWERED', 2)])).toBeNull();
    expect(repliedRow([])).toBeNull();
  });

  it('jami va javob berilgani', () => {
    expect(repliedRow([row('OPEN', 1), row('ANSWERED', 8)])).toEqual({ of: 9, answered: 8 });
  });

  it('bittasiga ham javob berilmagan: 0, null emas', () => {
    expect(repliedRow([row('OPEN', 4)])).toEqual({ of: 4, answered: 0 });
  });
});

type Calls = { session: unknown[]; inquiry: unknown[] };

function fake(last: Date | null, rows: { status: string; _count: { _all: number } }[]) {
  const calls: Calls = { session: [], inquiry: [] };
  const prisma = {
    session: { aggregate: async (a: unknown) => { calls.session.push(a); return { _max: { createdAt: last } }; } },
    inquiry: { groupBy: async (a: unknown) => { calls.inquiry.push(a); return rows; } },
  } as unknown as PrismaService;
  return { prisma, calls };
}

describe('egasi signali', () => {
  it("namuna e'lon: bazaga umuman borilmaydi", async () => {
    const { prisma, calls } = fake(NOW, []);
    expect(await ownerSignal(prisma, { isDemo: true, orgId: 'o1', ownerUserId: null }, NOW)).toEqual(SIGNAL_NONE);
    expect(calls.session).toHaveLength(0);
    expect(calls.inquiry).toHaveLength(0);
  });

  it("tashkilot egasi: a'zolari va tashkilotga kelgan yozishmalar bo'yicha", async () => {
    const { prisma, calls } = fake(ago(3), [{ status: 'ANSWERED', _count: { _all: 5 } }]);
    const out = await ownerSignal(prisma, { orgId: 'o1', ownerUserId: null }, NOW);
    expect(out).toEqual({ seen: 'week', replied: { of: 5, answered: 5 } });
    expect(calls.session[0]).toMatchObject({ where: { user: { memberships: { some: { orgId: 'o1' } } } } });
    expect(calls.inquiry[0]).toMatchObject({ by: ['status'], where: { toOrgId: 'o1' } });
  });

  it("shaxsiy e'lon: egasining o'zi bo'yicha", async () => {
    const { prisma, calls } = fake(NOW, []);
    await ownerSignal(prisma, { orgId: null, ownerUserId: 'u1' }, NOW);
    expect(calls.session[0]).toMatchObject({ where: { userId: 'u1' } });
    expect(calls.inquiry[0]).toMatchObject({ where: { toUserId: 'u1' } });
  });

  it("egasi aniqlanmasa so'rov yuborilmaydi", async () => {
    const { prisma, calls } = fake(NOW, []);
    expect(await ownerSignal(prisma, { orgId: null, ownerUserId: null }, NOW)).toEqual(SIGNAL_NONE);
    expect(calls.session).toHaveLength(0);
  });
});
