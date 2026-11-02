// Ishonch qoidalari: hisob o'chganda bozordagi iz ketadi; parol/telefon almashganda boshqa sessiyalar yopiladi.
// Soxta Prisma va soxta ombor, baza va Telegram yo'q.
import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { DeleteAccountUseCase } from './delete-account.usecase';
import { PasswordUseCase } from './password.usecase';
import { TokenService } from './token.service';
import type { PrismaService } from '../../../common/prisma.service';
import type { SessionStore } from '../domain/ports';

type Call = { model: string; where: Record<string, unknown>; data: Record<string, unknown> };

function fakeDb() {
  const calls: Call[] = [];
  const upd = (model: string) => ({ updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => { calls.push({ model, ...a }); return { count: 1 }; } });
  const del = { deleteMany: async () => ({ count: 0 }) };
  const tx = {
    user: { findUniqueOrThrow: async () => ({ phone: '+998901234567' }), update: async () => ({}) },
    membership: { findMany: async () => [], deleteMany: async () => ({}) },
    listing: upd('listing'), terminal: upd('terminal'), session: upd('session'),
    telegramLink: del, watch: del,
    serviceProfile: upd('serviceProfile'), marketRequest: upd('marketRequest'), urgentRequest: upd('urgentRequest'),
  };
  const prisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } as unknown as PrismaService;
  return { prisma, calls };
}

describe('hisobni o\'chirish: bozordagi iz', () => {
  it("xizmat profili yashiriladi (BLOCKED tegilmaydi), ochiq so'rovlar yopiladi, raqam hamma joydan olinadi", async () => {
    const { prisma, calls } = fakeDb();
    await new DeleteAccountUseCase(prisma).execute('u1');
    const of = (model: string) => calls.filter((c) => c.model === model);
    expect(of('serviceProfile')[0]).toMatchObject({ where: { userId: 'u1', status: 'ACTIVE' }, data: { status: 'HIDDEN' } });
    expect(of('serviceProfile')[1]!.data).toEqual({ contactPhone: null });
    expect(of('marketRequest')[0]).toMatchObject({ where: { createdById: 'u1', status: 'OPEN' }, data: { status: 'CLOSED' } });
    expect(of('marketRequest')[1]!.data).toEqual({ contactPhone: null });
    expect(of('urgentRequest')[0]).toMatchObject({ where: { createdById: 'u1', status: 'OPEN' }, data: { status: 'CLOSED' } });
    // Majburiy ustun: null emas, bo'sh qator
    expect(of('urgentRequest')[1]!.data).toEqual({ contactPhone: '' });
  });
});

function sessions() {
  const log: string[] = [];
  const store: SessionStore = {
    create: async () => ({ id: 'new' }), findByRefreshHash: async () => null, findById: async () => null, findLive: async () => null,
    rotate: async () => ({ id: 'x' }), revoke: async () => {},
    revokeAllForUser: async (u) => { log.push(`all:${u}`); },
    revokeOthersForUser: async (u, keep) => { log.push(`others:${u}:${keep}`); },
  };
  return { log, tokens: new TokenService(new JwtService({ secret: 'test-secret-at-least-32-characters-long' }), store) };
}

describe('parol va telefon almashganda sessiyalar', () => {
  const user = { id: 'u1', passwordHash: null, isActive: true };
  const users = { findById: async () => user, update: async () => user, findByPhone: async () => user, createByPhone: async () => user } as never;

  it('parol almashtirilsa joriy qurilmadan boshqalari yopiladi', async () => {
    const { log, tokens } = sessions();
    await new PasswordUseCase(users, tokens, {} as never).setPasswordChecked('u1', 'yangi-parol-1', undefined, 's-current');
    expect(log).toEqual(['others:u1:s-current']);
  });

  it('parol tiklansa hamma eski sessiya yopiladi, keyin yangi juft beriladi', async () => {
    const { log, tokens } = sessions();
    const verify = { consume: async () => '+998901234567' } as never;
    await new PasswordUseCase(users, tokens, verify).reset('+998901234567', '123456', 'yangi-parol-1', {});
    expect(log).toEqual(['all:u1']);
  });

  it("joriy sessiya noma'lum bo'lsa ehtiyot uchun hammasi yopiladi (telefon almashishi shu yo'ldan)", async () => {
    const { log, tokens } = sessions();
    await tokens.revokeOthers('u1', 's2');
    await tokens.revokeOthers('u1', undefined);
    expect(log).toEqual(['others:u1:s2', 'all:u1']);
  });
});
