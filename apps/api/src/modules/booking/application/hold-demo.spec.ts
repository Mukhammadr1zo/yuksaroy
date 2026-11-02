// Namuna terminalga joy ushlanmaydi (egasi qarori, 2026-10-07). Soxta repo va prisma, baza yo'q.
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../common/prisma.service';
import type { PlatformConfigService } from '../../../common/platform-config.service';
import type { BookingRepository } from '../domain/ports';
import { HoldSlotUseCase } from './hold-slot.usecase';

function setup(isDemo: boolean) {
  const held: string[] = [];
  const repo = {
    findSlot: async () => ({ id: 's1', terminalId: 't1' }),
    hold: async (slotId: string) => { held.push(slotId); return { id: 'b1', slotId, holdExpiresAt: null }; },
  } as unknown as BookingRepository;
  const prisma = { terminal: { findUnique: async () => ({ isDemo }) } } as unknown as PrismaService;
  const config = { get: async () => ({ slotHoldTtlMin: 10 }) } as unknown as PlatformConfigService;
  return { uc: new HoldSlotUseCase(repo, config, prisma), held };
}

describe('hold: namuna terminal', () => {
  it('namuna terminalda DEMO_TARGET va hold yaratilmaydi', async () => {
    const { uc, held } = setup(true);
    const e = await uc.hold('u1', 's1', null).catch((x) => x);
    expect(e).toBeInstanceOf(ForbiddenException);
    expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'DEMO_TARGET' });
    expect(held).toEqual([]);
  });
  it('haqiqiy terminalda hold yaratiladi', async () => {
    const { uc, held } = setup(false);
    await uc.hold('u1', 's1', null);
    expect(held).toEqual(['s1']);
  });
});
