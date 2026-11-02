// Namuna terminalga buyurtma yaratilmaydi, eski hold bo'lsa ham (egasi qarori, 2026-10-07).
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateOrderUseCase } from './create-order.usecase';

function setup(isDemo: boolean) {
  const created: unknown[] = [];
  const terminal = {
    id: 't1', name: 'T', status: 'ACTIVE', orgId: 'o1', stationId: 'st1', isDemo,
    services: [{ isEnabled: true, serviceCode: 'LOAD' }],
    tariffs: [{ id: 'tf1', serviceCode: 'LOAD', cargoGroupCode: null, priceTiyin: 1000, unit: 'PER_TON', minTiyin: 0 }],
  };
  const uc = new CreateOrderUseCase(
    { create: async (x: unknown) => { created.push(x); return { no: 'N1', shipperOrgName: 'S' }; } } as never,
    { findSlot: async () => ({ terminalId: 't1', startsAt: new Date(Date.now() + 3_600_000) }) } as never,
    { findTerminalById: async () => terminal, findCargoTypeByCode: async () => null } as never,
    { assertUsable: async () => ({ id: 'b1', slotId: 's1' }) } as never,
    { existingShipperOrg: async () => 'so1', createShipperOrg: async () => 'so1' } as never,
    { get: async () => ({ commissionPct: 0, commissionPayer: 'SHIPPER', terminalConfirmMin: 30 }) } as never,
    {} as never, { } as never,
  );
  return { uc, created };
}
const input = { bookingId: 'b1', operation: 'LOAD', weightKg: 1000 } as never;

describe('buyurtma: namuna terminal', () => {
  it('namuna terminalda DEMO_TARGET', async () => {
    const { uc, created } = setup(true);
    const e = await uc.execute('u1', input).catch((x) => x);
    expect(e).toBeInstanceOf(ForbiddenException);
    expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'DEMO_TARGET' });
    expect(created).toEqual([]);
  });
  it('haqiqiy terminalda buyurtma yaratiladi', async () => {
    const { uc, created } = setup(false);
    await uc.execute('u1', input);
    expect(created).toHaveLength(1);
  });
});
