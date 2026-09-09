import { describe, expect, it } from 'vitest';
import { corridorRegions } from '@yuksaroy/domain';
import { corridorMatch, listingOwner, parseCorridor, summarizeListings, uniqueSlug } from './listing-query';

describe('uniqueSlug', () => {
  it('bo\'sh bo\'lsa base, band bo\'lsa -2, -3 ...', async () => {
    const taken = new Set(['tem2', 'tem2-2']);
    expect(await uniqueSlug('tem2', async (s) => taken.has(s))).toBe('tem2-3');
    expect(await uniqueSlug('vagon', async () => false)).toBe('vagon');
  });
});

describe('koridor', () => {
  const tk_sa = corridorRegions('UZ-TK', 'UZ-SA');
  it('parseCorridor: A>B yo\'l, noto\'g\'ri kod yoki bir xil viloyat = yo\'q', () => {
    expect(parseCorridor('UZ-TK>UZ-SA')).toEqual(tk_sa);
    expect(parseCorridor('UZ-TK>UZ-TK')).toBeUndefined();
    expect(parseCorridor('UZ-XX>UZ-SA')).toBeUndefined();
    expect(parseCorridor(undefined)).toBeUndefined();
  });
  it('corridorMatch: yo\'nalish ikki uchi, xizmat hududi yoki bazaviy viloyat', () => {
    const none = { regionCode: 'UZ-XO', serviceRegions: [] as string[], routes: [] as { from: 'UZ-XO'; to: 'UZ-QR' }[] };
    expect(corridorMatch(none, tk_sa)).toBe(false);
    expect(corridorMatch({ ...none, routes: [{ from: 'UZ-TK', to: 'UZ-SA' }] }, tk_sa)).toBe(true);
    expect(corridorMatch({ ...none, routes: [{ from: 'UZ-TK', to: 'UZ-XO' }] }, tk_sa)).toBe(false);
    expect(corridorMatch({ ...none, serviceRegions: ['UZ-JI'] }, tk_sa)).toBe(true);
    expect(corridorMatch({ ...none, regionCode: 'UZ-SI' }, tk_sa)).toBe(true);
  });
});

describe('summarizeListings', () => {
  it('ko\'pchilik birligida eng arzon, narxsizlar soni, eng yaqini', () => {
    const s = summarizeListings([
      { priceTiyin: 500, priceUnit: 'PER_MONTH', lat: 41.3, lng: 69.28 },
      { priceTiyin: 300, priceUnit: 'PER_MONTH', lat: null, lng: null },
      { priceTiyin: 10, priceUnit: 'PER_DAY', lat: 39.65, lng: 66.96 },
      { priceTiyin: null, priceUnit: null, lat: null, lng: null },
    ], { lat: 41.311, lng: 69.28 });
    expect(s).toEqual({ cheapestTiyin: 300, cheapestUnit: 'PER_MONTH', onRequest: 1, nearestKm: 1.2 });
    expect(summarizeListings([])).toEqual({ cheapestTiyin: null, cheapestUnit: null, onRequest: 0, nearestKm: null });
  });
});

describe('listingOwner', () => {
  it("tashkilot: nom, slug, KYC; shaxs: ism va telefon tasdig'i; ismsiz shaxs = 'Yakka haydovchi'", () => {
    expect(listingOwner({ org: { name: 'Temir Yol MChJ', slug: 'temir-yol', kycStatus: 'VERIFIED' }, ownerUser: null }))
      .toEqual({ type: 'org', name: 'Temir Yol MChJ', slug: 'temir-yol', kyc: 'VERIFIED' });
    expect(listingOwner({ org: null, ownerUser: { fullName: 'Akmal', phone: '+998901234567' } }))
      .toEqual({ type: 'person', name: 'Akmal', phoneVerified: true });
    expect(listingOwner({ org: null, ownerUser: { fullName: null, phone: null } }))
      .toEqual({ type: 'person', name: 'Yakka haydovchi', phoneVerified: false });
  });
});
