// Telefon almashtirish yo'li: kod so'rovi otp/request bilan bir xil cheklanadi, tasdiqdan keyin boshqa sessiyalar yopiladi.
import { describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller';

const req = (ip: string) => ({ ip, headers: {}, cookies: {} }) as unknown as FastifyRequest;

function make() {
  const revokeOthers = vi.fn(async () => {});
  const requestOtp = { execute: vi.fn(async () => ({ sent: true })) };
  const c = new AuthController(
    requestOtp as never, { consume: async () => '+998901112233' } as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    { revokeOthers, verifyAccess: () => ({ sid: 's1' }) } as never, { isAdmin: async () => false, permissionsOf: async () => [] } as never, { log: async () => {} } as never,
    { findById: async () => ({ id: 'u1', phone: '+998900000000' }), claimPhone: async () => ({ id: 'u1', phone: '+998901112233' }) } as never,
  );
  return { c, revokeOthers };
}

describe('phone/change yo\'li', () => {
  it("bir raqamga soatiga 5 tadan ortiq kod so'rovi 429 beradi", async () => {
    const { c } = make();
    const dto = { phone: '+998905550001', locale: 'uz' } as never;
    for (let i = 0; i < 5; i++) await c.phoneChangeRequest('u1', dto, req(`10.1.0.${i}`)).catch(() => {});
    await expect(c.phoneChangeRequest('u1', dto, req('10.1.0.99'))).rejects.toMatchObject({ status: 429 });
  });

  it('tasdiqdan keyin boshqa sessiyalar yopiladi, joriysi qoladi', async () => {
    const { c, revokeOthers } = make();
    const r = { ip: '10.2.0.1', headers: { authorization: 'Bearer tok' } } as unknown as FastifyRequest;
    await c.phoneChange('u1', { phone: '+998901112233', code: '123456' } as never, r).catch(() => {});
    expect(revokeOthers).toHaveBeenCalledWith('u1', 's1');
  });
});
