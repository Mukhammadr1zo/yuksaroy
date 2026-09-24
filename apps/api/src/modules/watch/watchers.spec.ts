// Kunlik chegara bazada: bugun xabar bergan kuzatuv umuman o'qilmaydi, mos
// kelganlarga esa vaqt XABARDAN OLDIN yoziladi. Ikkalasi ham shu yerda tekshiriladi.
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../common/prisma.service';
import { watchers } from './watchers';

type Any = Record<string, any>;
const NOW = new Date('2026-09-24T03:00:00Z'); // Toshkentda 08:00

function fake(rows: { id: string; userId: string; kind: string; params: Record<string, string> }[]) {
  const args: Any[] = [];
  const marked: string[][] = [];
  const prisma = {
    watch: {
      findMany: async (a: Any) => { args.push(a); return rows; },
      updateMany: async (a: Any) => { marked.push([...a.where.id.in]); return { count: a.where.id.in.length }; },
    },
  } as unknown as PrismaService;
  return { prisma, args, marked };
}

const row = (id: string, userId: string, params: Record<string, string> = {}) => ({ id, userId, kind: 'CARGO', params });
const event = { kind: 'CARGO' as const, isDemo: false, skipUserIds: [] as string[], values: { fromRegion: 'UZ-TK' } };

describe('kuzatuvchilarni topish', () => {
  it("so'rov sharti: tur, bugun yubormaganlar va faol hisob", async () => {
    const { prisma, args } = fake([]);
    await watchers(prisma, event, NOW);
    const w = args[0]!.where;
    expect(w.kind).toBe('CARGO');
    expect(w.user).toEqual({ isActive: true });
    // Toshkent yarim tuni: UTC bo'yicha oldingi kun 19:00
    expect(w.OR[0]).toEqual({ lastSentAt: null });
    expect((w.OR[1].lastSentAt.lt as Date).toISOString()).toBe('2026-09-23T19:00:00.000Z');
    expect(args[0]!.take).toBe(500);
  });

  it('mos kelganlarga vaqt yoziladi', async () => {
    const { prisma, marked } = fake([row('w1', 'u1'), row('w2', 'u2', { fromRegion: 'UZ-SA' })]);
    expect(await watchers(prisma, event, NOW)).toEqual(['u1']);
    expect(marked).toEqual([['w1']]);
  });

  it("mos kelgani yo'q bo'lsa hech narsa yozilmaydi", async () => {
    const { prisma, marked } = fake([row('w2', 'u2', { fromRegion: 'UZ-SA' })]);
    expect(await watchers(prisma, event, NOW)).toEqual([]);
    expect(marked).toEqual([]);
  });

  it("bir odamning ikki kuzatuvi: bitta xabar, ikkala qator ham belgilanadi", async () => {
    const { prisma, marked } = fake([row('w1', 'u1'), row('w2', 'u1', { truckType: 'TENT' })]);
    expect(await watchers(prisma, { ...event, values: { fromRegion: 'UZ-TK', truckType: 'TENT' } }, NOW)).toEqual(['u1']);
    expect(marked).toEqual([['w1', 'w2']]);
  });
});
