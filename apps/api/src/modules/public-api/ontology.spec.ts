import { describe, expect, it } from 'vitest';
import { CONDITIONS, DEAL_KINDS, LISTING_KINDS, ORG_KINDS, PRICE_UNITS, PUBLIC_API, REGIONS, SERVICE_CODES, TERMINAL_KINDS, TRUCK_TYPES, WAGON_TYPES } from '@yuksaroy/domain';
import { CHANGELOG, buildOntology } from './ontology';

const ENUMS = {
  regions: REGIONS, services: SERVICE_CODES, terminalKinds: TERMINAL_KINDS, listingKinds: LISTING_KINDS, deals: DEAL_KINDS,
  conditions: CONDITIONS, wagonTypes: WAGON_TYPES, truckTypes: TRUCK_TYPES, priceUnits: PRICE_UNITS, orgKinds: ORG_KINDS,
} as const;

describe('buildOntology', () => {
  const o = buildOntology();

  it('versiya PUBLIC_API bilan bir xil, changelog boshida shu versiya', () => {
    expect(o.version).toBe(PUBLIC_API.version);
    expect(CHANGELOG[0].version).toBe(PUBLIC_API.version);
  });

  it('har bir enum to\'liq qamrab olingan, tartib saqlangan', () => {
    for (const [key, codes] of Object.entries(ENUMS)) {
      expect(o[key as keyof typeof ENUMS].map((x) => x.code), key).toEqual([...codes]);
    }
  });

  it('har bir kodda uch til yorlig\'i bor, bo\'sh emas', () => {
    for (const key of Object.keys(ENUMS) as (keyof typeof ENUMS)[]) {
      for (const row of o[key]) {
        for (const lang of ['uz', 'ru', 'en'] as const) {
          expect(typeof row[lang], `${key}.${row.code}.${lang}`).toBe('string');
          expect(row[lang].trim().length, `${key}.${row.code}.${lang}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('uzun tire yo\'q, taqiqlangan so\'z yo\'q', () => {
    const text = JSON.stringify(o) + JSON.stringify(CHANGELOG);
    expect(text).not.toContain(String.fromCharCode(0x2014)); // uzun tire (kod bilan yozilgan, grep tozaligi uchun)
    expect(text.toLowerCase()).not.toContain('tup' + 'ik'); // "shahobcha yo'l" o'rniga ishlatilmasin
  });
});
