import { describe, expect, it } from 'vitest';
import { cheapestByUnit, corridorRegions, regionRouteKm } from '@yuksaroy/domain';
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

/**
 * Birlik aralash bo'lganda "eng arzon" qaror qatori yolg'on gapirmasligi kerak:
 * 2 500 so'm/km reys narxidan raqam sifatida kichik, lekin u javob emas.
 */
describe('cheapestByUnit', () => {
  it("birlik aralash bo'lsa ko'pchilik birligi olinadi", () => {
    expect(cheapestByUnit([
      { priceTiyin: 300_000_000, priceUnit: 'PER_TRIP' },
      { priceTiyin: 250_000_000, priceUnit: 'PER_TRIP' },
      { priceTiyin: 250_000, priceUnit: 'PER_KM' },
    ])).toEqual({ cheapestTiyin: 250_000_000, cheapestUnit: 'PER_TRIP' });
  });

  it("narxsiz qatorlar hisobga olinmaydi, umuman narx bo'lmasa null", () => {
    expect(cheapestByUnit([
      { priceTiyin: null, priceUnit: null },
      { priceTiyin: 5_000, priceUnit: 'PER_KM' },
    ])).toEqual({ cheapestTiyin: 5_000, cheapestUnit: 'PER_KM' });
    expect(cheapestByUnit([])).toEqual({ cheapestTiyin: null, cheapestUnit: null });
    expect(cheapestByUnit([{ priceTiyin: 100, priceUnit: null }])).toEqual({ cheapestTiyin: null, cheapestUnit: null });
  });

  it('teng sonli birliklarda birinchi uchragani qoladi', () => {
    expect(cheapestByUnit([
      { priceTiyin: 900, priceUnit: 'PER_TON' },
      { priceTiyin: 100, priceUnit: 'PER_KM' },
    ]).cheapestUnit).toBe('PER_TON');
  });

  it("summarizeListings ham shu qoidadan foydalanadi", () => {
    const s = summarizeListings([
      { priceTiyin: 300_000_000, priceUnit: 'PER_TRIP', lat: null, lng: null },
      { priceTiyin: 250_000_000, priceUnit: 'PER_TRIP', lat: null, lng: null },
      { priceTiyin: 250_000, priceUnit: 'PER_KM', lat: null, lng: null },
    ]);
    expect(s.cheapestTiyin).toBe(250_000_000);
    expect(s.cheapestUnit).toBe('PER_TRIP');
    expect(s.onRequest).toBe(0);
  });
});

/**
 * Yo'l uzunligi viloyat markazlaridan: yuk so'rovida aniq manzil yo'q, shuning uchun
 * bu taqqoslash uchun asos, marshrut emas.
 */
describe('regionRouteKm', () => {
  it('ikki viloyat markazi orasidagi masofa, butun km', () => {
    const d = regionRouteKm('UZ-TK', 'UZ-SA');
    expect(d).not.toBeNull();
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(350);
    expect(Number.isInteger(d)).toBe(true);
  });

  it("qaysi tomondan bo'lsa ham bir xil", () => {
    expect(regionRouteKm('UZ-TK', 'UZ-QR')).toBe(regionRouteKm('UZ-QR', 'UZ-TK'));
  });

  it("bir viloyat, noma'lum kod yoki bo'sh qiymat = null", () => {
    expect(regionRouteKm('UZ-TK', 'UZ-TK')).toBeNull();
    expect(regionRouteKm('UZ-XX', 'UZ-TK')).toBeNull();
    expect(regionRouteKm(null, 'UZ-TK')).toBeNull();
    expect(regionRouteKm('UZ-TK', undefined)).toBeNull();
  });
});
