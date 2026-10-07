// Qaror satri namunani sanamaydi: ro'yxatda namuna belgisi bilan turadi, sonlarda yo'q. Soxta repo, baza yo'q.
import { describe, expect, it } from 'vitest';
import type { CatalogRepository, TariffRecord, TerminalFilter, TerminalRecord } from '../domain/ports';
import type { PrismaListingRepository } from '../../listings/infrastructure/prisma-listing.repository';
import { CatalogController, realSummary } from './catalog.controller';

const load = (terminalId: string, priceTiyin: number): TariffRecord =>
  ({ id: `${terminalId}-LOAD`, terminalId, serviceCode: 'LOAD', cargoGroupCode: null, version: 1, validFrom: new Date(), validTo: null, priceTiyin, unit: 'PER_TON', minTiyin: null, note: null, createdAt: new Date() });
// Namuna eng arzon, eng yaqin va bahoga ega: u sanalsa har bir son o'zgarardi
const demo = { id: 'demo', name: 'Namuna', isDemo: true, orgId: 'demo-org-1', lat: 41.31, lng: 69.28, ratingCount: 4, tariffs: [load('demo', 1000)], services: [] } as unknown as TerminalRecord;
const real = { id: 'real', name: 'Haqiqiy', isDemo: false, orgId: 'o1', lat: 41.6, lng: 69.6, ratingCount: 0, tariffs: [load('real', 2000)], services: [] } as unknown as TerminalRecord;

describe('realSummary', () => {
  it('namunani sonlardan chiqaradi va alohida sanaydi', () => {
    const s = realSummary([demo, real], { demo: 9, real: 2 }, { lat: 41.31, lng: 69.28, radiusKm: 100 });
    expect(s).toMatchObject({ freeToday: 1, ratedCount: 0, cheapestTiyin: 2000, demo: 1 });
    // Eng yaqini namuna (0 km) emas, haqiqiy obyekt
    expect(s.nearestKm).toBeGreaterThan(30);
  });

  it('faqat namuna bo\'lsa qaror satri bo\'sh, namuna soni qoladi', () => {
    expect(realSummary([demo], { demo: 9 })).toEqual({ freeToday: 0, ratedCount: 0, cheapestTiyin: null, cheapestUnit: null, nearestKm: null, demo: 1 });
    expect(realSummary([], {})).toMatchObject({ demo: 0 });
  });
});

/** listTerminals: egali to'plam (qaror satri uchun) yoki sahifa qatorlari; jami son alohida. */
function controller(owned: TerminalRecord[], total: number) {
  const repo = {
    countTerminals: async () => total,
    listTerminals: async (f: TerminalFilter) => (f.owned ? owned : [real]),
    freeTodayByTerminal: async () => ({ demo: 9, real: 0 }),
  } as unknown as CatalogRepository;
  return new CatalogController(repo, {} as PrismaListingRepository);
}

describe('GET /terminals summary', () => {
  it('bazadagi sahifa: jami ro\'yxat uchun qoladi, qaror satri namunasiz', async () => {
    const r = await controller([demo, real], 5).terminals();
    expect(r.total).toBe(5);
    expect(r.summary).toMatchObject({ freeToday: 0, cheapestTiyin: 2000, demo: 1 });
  });

  it('"bugun bo\'sh joy" filtri: namuna ro\'yxatda, lekin bo\'sh joy sonida yo\'q', async () => {
    const r = await controller([demo, real], 0).terminals(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '1');
    // freeToday: real = 0, shuning uchun ro'yxatda faqat namuna qoladi
    expect(r.items.map((x) => x.id)).toEqual(['demo']);
    expect(r.summary).toMatchObject({ freeToday: 0, cheapestTiyin: null, demo: 1 });
  });
});
