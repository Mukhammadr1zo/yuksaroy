// Yordamchi (sayt va bot) aytadigan son namunani sanamaydi. Soxta repo, LLM o'chiq, baza yo'q.
import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import type { CatalogRepository, TariffRecord, TerminalRecord } from '../catalog/domain/ports';
import type { TokenService } from '../identity/application/token.service';
import { SearchController } from './search.controller';
import type { Yordamchi } from './yordamchi';

const load = (terminalId: string, priceTiyin: number): TariffRecord =>
  ({ id: `${terminalId}-LOAD`, terminalId, serviceCode: 'LOAD', cargoGroupCode: null, version: 1, validFrom: new Date(), validTo: null, priceTiyin, unit: 'PER_TON', minTiyin: null, note: null, createdAt: new Date() });
const row = (id: string, isDemo: boolean, price: number) =>
  ({ id, isDemo, orgId: `o-${id}`, lat: null, lng: null, ratingCount: 0, tariffs: [load(id, price)], services: [] }) as unknown as TerminalRecord;

describe('POST /search/parse decision', () => {
  it('jami sondan namuna ayiriladi, bo\'sh joy va eng arzon faqat haqiqiydan', async () => {
    const repo = {
      // Egali to'plam: ikki namuna (biri eng arzon, bugun bo'sh joyi bor) va bitta haqiqiy
      listTerminals: async () => [row('d1', true, 1000), row('d2', true, 1500), row('r1', false, 3000)],
      // Ochiq katalog qamrovi: reestr qatorlari ham shu songa kiradi
      countTerminals: async () => 10,
      freeTodayByTerminal: async () => ({ d1: 5 }),
    } as unknown as CatalogRepository;
    const ctl = new SearchController(repo, {} as TokenService, { enabled: false } as unknown as Yordamchi);
    const r = await ctl.parse({ q: 'Toshkentda yuklash', lang: 'uz' }, {} as FastifyRequest, '127.0.0.1');
    expect(r.decision).toMatchObject({ terminals: 8, demo: 2, freeToday: 0, cheapestTiyin: 3000 });
  });
});
