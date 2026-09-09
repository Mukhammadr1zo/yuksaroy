import { describe, expect, it } from 'vitest';
import { DEAL_KINDS, LISTING_KINDS, REGIONS, SERVICE_CODES, TERMINAL_KINDS } from '@yuksaroy/domain';
import { facets } from './facets';

describe('facets', () => {
  it('bo\'sh kirish: har bir enum kaliti 0 bilan chiqadi', () => {
    const f = facets([], []);
    expect(f.terminals.total).toBe(0);
    expect(Object.keys(f.terminals.kind)).toEqual([...TERMINAL_KINDS]);
    expect(Object.keys(f.terminals.region)).toEqual([...REGIONS]);
    expect(Object.keys(f.terminals.service)).toEqual([...SERVICE_CODES]);
    expect(Object.keys(f.listings.kind)).toEqual([...LISTING_KINDS]);
    expect(Object.keys(f.listings.deal)).toEqual([...DEAL_KINDS]);
    expect(Object.values(f.listings.region).every((n) => n === 0)).toBe(true);
  });

  it('sanaydi: o\'chirilgan xizmat va noma\'lum kod hisobga olinmaydi', () => {
    const f = facets(
      [
        { kind: 'YARD', regionCode: 'UZ-TK', services: [{ serviceCode: 'LOAD', isEnabled: true }, { serviceCode: 'WEIGH', isEnabled: false }] },
        { kind: 'YARD', regionCode: 'UZ-TO', services: [{ serviceCode: 'LOAD', isEnabled: true }] },
        { kind: 'CONTAINER', regionCode: null, services: [] },
      ],
      [
        { kind: 'WAGON', regionCode: 'UZ-TK', deal: 'RENT' },
        { kind: 'TRUCK', regionCode: 'UZ-TK', deal: null },
        { kind: 'WAGON', regionCode: 'XX-ZZ', deal: 'SALE' },
      ],
    );
    expect(f.terminals.total).toBe(3);
    expect(f.terminals.kind).toMatchObject({ YARD: 2, CONTAINER: 1, LC: 0 });
    expect(f.terminals.region).toMatchObject({ 'UZ-TK': 1, 'UZ-TO': 1 });
    expect(f.terminals.service).toMatchObject({ LOAD: 2, WEIGH: 0 });
    expect(f.listings.total).toBe(3);
    expect(f.listings.kind).toMatchObject({ WAGON: 2, TRUCK: 1, SHUNTING_LOCO: 0 });
    expect(f.listings.deal).toEqual({ RENT: 1, SALE: 1 });
    expect(f.listings.region['UZ-TK']).toBe(2);
    expect('XX-ZZ' in f.listings.region).toBe(false);
  });
});
