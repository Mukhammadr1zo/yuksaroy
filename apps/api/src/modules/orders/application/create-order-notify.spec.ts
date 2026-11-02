// Yangi buyurtma xabari terminal tashkilotining BARCHA a'zolariga ketadi (2026-11-02): tasdiqlay oladigan
// dispetcher ham muddatni bilishi kerak. Ilgari faqat egalariga ketardi (ownersOnly) va dispetcher bilmasdi.
import { describe, expect, it } from 'vitest';
import { CreateOrderUseCase } from './create-order.usecase';

describe('yangi buyurtma xabari kimga', () => {
  it("ownersOnly yo'q: butun tashkilot a'zolari", async () => {
    const targets: Record<string, unknown>[] = [];
    const terminal = {
      id: 't1', name: 'T', status: 'ACTIVE', orgId: 'o1', stationId: 'st1', isDemo: false,
      services: [{ isEnabled: true, serviceCode: 'LOAD' }],
      tariffs: [{ id: 'tf1', serviceCode: 'LOAD', cargoGroupCode: null, priceTiyin: 1000, unit: 'PER_TON', minTiyin: 0 }],
    };
    const uc = new CreateOrderUseCase(
      { create: async () => ({ no: 'N1', shipperOrgName: 'S' }) } as never,
      { findSlot: async () => ({ terminalId: 't1', startsAt: new Date(Date.now() + 3_600_000) }) } as never,
      { findTerminalById: async () => terminal, findCargoTypeByCode: async () => null } as never,
      { assertUsable: async () => ({ id: 'b1', slotId: 's1' }) } as never,
      { existingShipperOrg: async () => 'so1', createShipperOrg: async () => 'so1' } as never,
      { get: async () => ({ commissionPct: 0, commissionPayer: 'SHIPPER', terminalConfirmMin: 30 }) } as never,
      {} as never,
      { recipients: async (t: Record<string, unknown>) => { targets.push(t); return []; } } as never,
    );
    await uc.execute('u1', { bookingId: 'b1', operation: 'LOAD', weightKg: 1000 } as never);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ orgIds: ['o1'] });
    expect(targets[0]).not.toHaveProperty('ownersOnly');
  });
});
