import { describe, expect, it } from 'vitest';
import { filterRoles, parseAdminPhones, rolesForKinds } from './rules';

describe('rolesForKinds / filterRoles', () => {
  it('turlar birlashmasi, takrorsiz', () => {
    expect(rolesForKinds(['SHIPPER', 'FORWARDER'])).toEqual(['CLIENT', 'FORWARDER']);
    expect(rolesForKinds([])).toEqual([]);
  });
  it('tur ruxsat bermagan rol tashlanadi (xavfsizlik)', () => {
    expect(filterRoles(['PLATFORM_ADMIN', 'TERMINAL_ADMIN'], ['TERMINAL'])).toEqual(['TERMINAL_ADMIN']);
    expect(filterRoles(['PLATFORM_ADMIN'], ['CARRIER'])).toEqual([]);
    expect(filterRoles(undefined, ['CARRIER'])).toEqual(['CARRIER', 'DRIVER']);
  });
});

describe('parseAdminPhones', () => {
  it("vergulli ro'yxat, bo'shliq va formatlar normallashadi", () => {
    const s = parseAdminPhones(' +998901234567, 90 765 43 21 ,abc,');
    expect([...s]).toEqual(['+998901234567', '+998907654321']);
    expect(parseAdminPhones(undefined).size).toBe(0);
  });
});
