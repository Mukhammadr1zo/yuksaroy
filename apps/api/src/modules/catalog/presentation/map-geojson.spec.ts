// Xarita GeoJSON mapper: aniqlik qoidasi (exact / station / region), kategoriya, bbox va koridor filtrlari. DB kerak emas.
import { describe, expect, it } from 'vitest';
import { REGION_CENTERS, corridorRegions } from '@yuksaroy/domain';
import type { ListingRecord } from '../../listings/domain/listing-query';
import type { TerminalRecord } from '../domain/ports';
import { listingFeature, mapFeatures, parseBbox, terminalFeature, type SidingGroup } from './map-geojson';

const term = (id: string, regionCode: string | null, lat: number | null, lng: number | null) =>
  ({ id, slug: `${id}-slug`, name: id, kind: 'MULTI', regionCode, lat, lng, tariffs: [{ serviceCode: 'LOAD', unit: 'PER_TON', cargoGroupCode: null, priceTiyin: 1500 }] }) as unknown as TerminalRecord;
const listing = (p: Partial<ListingRecord>): ListingRecord =>
  ({ id: 'l1', slug: 'l1', kind: 'WAGON', deal: 'RENT', title: 'Vagon', regionCode: 'UZ-TK', terminalId: null, lat: null, lng: null,
    priceTiyin: 100, priceUnit: 'PER_MONTH', serviceRegions: [], routes: [], org: { name: 'Org', slug: 'org', kycStatus: 'VERIFIED' }, ownerUser: null, ...p }) as unknown as ListingRecord;
const sidings: SidingGroup[] = [{ id: 's1', name: 'Ablyk', lat: 40.98, lng: 70.02, count: 16, regionCode: 'UZ-TO' }, { id: 's2', name: 'Andijon', lat: 40.78, lng: 72.34, count: 3, regionCode: 'UZ-AN' }];

describe('accuracy qoidasi', () => {
  it('terminal: aniq nuqta, koordinatasiz tashlab yuboriladi', () => {
    const f = terminalFeature(term('t1', 'UZ-TK', 41.2, 69.24), 3)!;
    expect(f.geometry.coordinates).toEqual([69.24, 41.2]);
    expect(f.properties).toMatchObject({ kind: 'terminal', accuracy: 'exact', slug: 't1-slug', terminalKind: 'MULTI', freeToday: 3, fromPriceTiyin: 1500 });
    expect(terminalFeature(term('t2', 'UZ-TK', null, null), 0)).toBeNull();
  });
  it("e'lon: obyektga bog'langan = exact, aks holda viloyat markazi = region", () => {
    const exact = listingFeature(listing({ terminalId: 't1', lat: 41.2, lng: 69.24 }))!;
    expect(exact.properties.accuracy).toBe('exact');
    expect(exact.geometry.coordinates).toEqual([69.24, 41.2]);
    const region = listingFeature(listing({ lat: 41.2, lng: 69.24 }))!; // bog'lanmagan: lat/lng bo'lsa ham markaz
    expect(region.properties.accuracy).toBe('region');
    expect(region.geometry.coordinates).toEqual([REGION_CENTERS['UZ-TK'].lng, REGION_CENTERS['UZ-TK'].lat]);
    const noCoords = listingFeature(listing({ terminalId: 't1' }))!; // bog'langan, lekin obyektda koordinata yo'q
    expect(noCoords.properties.accuracy).toBe('region');
    expect(listingFeature(listing({ regionCode: 'XX' }))).toBeNull();
  });
  it("e'lon turi va egasi", () => {
    const f = listingFeature(listing({ kind: 'TRUCK', deal: null, org: null, ownerUser: { fullName: 'Ali', phone: '+998' } }))!;
    expect(f.properties).toMatchObject({ kind: 'truck', listingKind: 'TRUCK', deal: null, owner: { type: 'person', name: 'Ali' } });
    expect(listingFeature(listing({}))!.properties.owner).toEqual({ type: 'org', name: 'Org' });
  });
});

describe('mapFeatures filtrlari', () => {
  const src = {
    terminals: [term('tk', 'UZ-TK', 41.2, 69.24), term('an', 'UZ-AN', 40.78, 72.34)], free: { tk: 2 }, sidings,
    listings: [listing({ id: 'w', regionCode: 'UZ-AN' }), listing({ id: 'tr', kind: 'TRUCK', regionCode: 'UZ-FA', serviceRegions: ['UZ-FA', 'UZ-TK'] })],
  };
  const cats = ['terminal', 'equipment', 'truck'] as const;
  const kinds = (r: ReturnType<typeof mapFeatures>) => r.features.map((f) => `${f.properties.kind}:${f.properties.id}`);
  it('kategoriya: default hammasi, tanlanganlari qoladi', () => {
    expect(kinds(mapFeatures(src, { cats: [...cats] }))).toEqual(['terminal:tk', 'terminal:an', 'siding:s1', 'siding:s2', 'equipment:w', 'truck:tr']);
    expect(kinds(mapFeatures(src, { cats: ['truck'] }))).toEqual(['truck:tr']);
  });
  it('bbox: Toshkent atrofi', () => {
    expect(kinds(mapFeatures(src, { cats: [...cats], bbox: parseBbox('69,41,70,42') }))).toEqual(['terminal:tk']);
  });
  it("koridor UZ-SU>UZ-TK: viloyat bo'yicha va e'lon xizmat hududi bo'yicha", () => {
    const corridor = corridorRegions('UZ-SU', 'UZ-TK');
    expect(kinds(mapFeatures(src, { cats: [...cats], corridor }))).toEqual(['terminal:tk', 'siding:s1', 'truck:tr']); // yo'l: SU QA SA JI SI TO TK
  });
  it("parseBbox: noto'g'ri qiymat = filtr yo'q", () => {
    expect(parseBbox('69,41,70')).toBeUndefined();
    expect(parseBbox('70,41,69,42')).toBeUndefined();
    expect(parseBbox('a,b,c,d')).toBeUndefined();
    expect(parseBbox('69,41,70,42')).toEqual([69, 41, 70, 42]);
  });
});
