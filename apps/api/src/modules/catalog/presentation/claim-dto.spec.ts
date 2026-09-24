import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClaimSidingDto } from './dto';

/**
 * Izoh ishonch chegarasida: moderator "meniki" degan gapni nimaga qarab tekshirishini
 * bilishi kerak. Brauzer tugmani o'chiradi, lekin qoida shu yerda turadi.
 */
const codes = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(ClaimSidingDto, body)).flatMap((e) => Object.keys(e.constraints ?? {}));

describe("da'vo formasi", () => {
  it('izohsiz yuborilmaydi', () => {
    expect(codes({ orgId: 'o1' }).length).toBeGreaterThan(0);
  });

  it("qisqa izoh o'tmaydi", () => {
    expect(codes({ orgId: 'o1', note: '123456789' })).toContain('isLength');
  });

  it("o'nta belgidan uzun izoh o'tadi", () => {
    expect(codes({ orgId: 'o1', note: 'guvohnoma bizda' })).toEqual([]);
  });
});
