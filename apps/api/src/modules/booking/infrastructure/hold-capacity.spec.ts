/**
 * Sig'im invarianti: parallel hold'lar slotni sig'imdan oshirib yubormasligi kerak (FOR UPDATE + CHECK).
 * DATABASE_URL bo'lmasa (CI da DB yo'q) o'tkazib yuboriladi.
 */
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaBookingRepository } from './prisma-booking.repository';
import { SlotFullError } from '../domain/ports';

const DB = process.env.DATABASE_URL;
const prisma = DB ? new PrismaClient() : null;
const repo = prisma ? new PrismaBookingRepository(prisma as never) : null;

describe.skipIf(!DB)('slot sig\'imi (parallel hold)', () => {
  let stationId = '', terminalId = '', slotId = '';

  beforeAll(async () => {
    const p = prisma!;
    const station = await p.station.create({ data: { nameUz: `Test-${Date.now()}`, rju: 'TAS' } });
    stationId = station.id;
    const terminal = await p.terminal.create({ data: { stationId, kind: 'YARD', slug: `test-${Date.now()}`, name: 'Test terminal', status: 'ACTIVE' } });
    terminalId = terminal.id;
    const day = new Date(Date.now() + 7 * 86_400_000);
    const slot = await p.timeSlot.create({
      data: {
        terminalId, localDate: new Date(day.toISOString().slice(0, 10)), window: 1,
        startsAt: new Date(day.getTime() + 3_600_000), endsAt: new Date(day.getTime() + 7_200_000), capacity: 2,
      },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    const p = prisma;
    if (!p) return;
    if (slotId) await p.slotBooking.deleteMany({ where: { slotId } });
    if (terminalId) await p.timeSlot.deleteMany({ where: { terminalId } });
    if (terminalId) await p.terminal.delete({ where: { id: terminalId } }).catch(() => {});
    if (stationId) await p.station.delete({ where: { id: stationId } }).catch(() => {});
    await p.$disconnect();
  });

  it('sig\'im 2 da 6 ta parallel hold - 2 tasi o\'tadi, qolgani SLOT_FULL', async () => {
    const now = new Date();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => repo!.hold(slotId, `u${i}`, null, 10, now)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const full = results.filter((r) => r.status === 'rejected' && (r.reason as Error) instanceof SlotFullError);
    expect(ok).toHaveLength(2);
    expect(full).toHaveLength(4);

    const slot = await repo!.findSlot(slotId);
    expect(slot!.held).toBe(2);
    expect(slot!.booked + slot!.held).toBeLessThanOrEqual(slot!.capacity);
  });

  it('bo\'shatilgandan keyin joy qaytadi', async () => {
    const b = await prisma!.slotBooking.findFirst({ where: { slotId, status: 'HOLD' } });
    await repo!.release(b!.id, 'MANUAL', new Date());
    const slot = await repo!.findSlot(slotId);
    expect(slot!.held).toBe(1);
  });

  it('muddati o\'tgan hold yangi hold uchun joy bo\'shatadi', async () => {
    const past = new Date(Date.now() - 60_000);
    await prisma!.slotBooking.updateMany({ where: { slotId, status: 'HOLD' }, data: { holdExpiresAt: past } });
    const b = await repo!.hold(slotId, 'u-late', null, 10, new Date());
    expect(b.status).toBe('HOLD');
    const slot = await repo!.findSlot(slotId);
    expect(slot!.held).toBe(1); // eskisi bo'shadi, yangisi qo'shildi
  });
});
