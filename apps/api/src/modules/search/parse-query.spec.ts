import { describe, expect, it } from 'vitest';
import {
  REGIONS, REGION_ADJACENCY, URGENT_KINDS, URGENT_KIND_LABELS, URGENT_OFFER_STATUSES, URGENT_STATUSES, YORDAMCHI,
  chipLabel, corridorRegions, formatUrgentNo, normalizeQuery, parseQuery,
} from '@yuksaroy/domain';

describe('koridor grafi', () => {
  it('qo\'shnilik simmetrik va hamma viloyat bor', () => {
    for (const r of REGIONS) {
      for (const n of REGION_ADJACENCY[r]) expect(REGION_ADJACENCY[n]).toContain(r);
    }
  });

  it('Surxondaryo -> Toshkent eng qisqa yo\'l', () => {
    expect(corridorRegions('UZ-SU', 'UZ-TK')).toEqual(['UZ-SU', 'UZ-QA', 'UZ-SA', 'UZ-JI', 'UZ-SI', 'UZ-TO', 'UZ-TK']);
    expect(corridorRegions('UZ-AN', 'UZ-AN')).toEqual(['UZ-AN']);
  });
});

describe('normalizeQuery', () => {
  it('kirill -> lotin, apostrof, bo\'shliq', () => {
    expect(normalizeQuery('  Тошкент   Қўқон ')).toBe("toshkent qo'qon");
    expect(normalizeQuery('Ташкент Хорезм Джизак')).toBe('tashkent xorezm djizak');
    expect(normalizeQuery('Qoʻqon Farg’ona')).toBe("qo'qon farg'ona");
  });
});

describe('parseQuery', () => {
  it('koridor + xizmatlar (uz)', () => {
    const f = parseQuery("Termizdan Toshkentgacha yo'lda konteyner tushirish");
    expect(f.corridor).toEqual({ from: 'UZ-SU', to: 'UZ-TK' });
    expect(f.regions).toEqual(['UZ-SU', 'UZ-QA', 'UZ-SA', 'UZ-JI', 'UZ-SI', 'UZ-TO', 'UZ-TK']);
    expect([...f.services].sort()).toEqual(['CONTAINER', 'UNLOAD']);
    expect([null, 'terminal']).toContain(f.category);
    expect(f.lang).toBe('uz');
    expect(f.confidence).toBeGreaterThanOrEqual(0.6);
    expect(f.chips.map((c) => c.key)).toContain('corridor:UZ-SU>UZ-TK');
    expect(f.chips.some((c) => c.type === 'region')).toBe(false);
  });

  it('viloyat + miqdor + shahobcha + manevr', () => {
    const f = parseQuery("Andijonda 20 vagonga shahobcha yo'l va manevr teplovozi");
    expect(f.regions).toEqual(['UZ-AN']);
    expect(f.qty).toEqual({ wagons: 20 });
    expect(f.category).toBe('terminal');
    expect(f.kind).toBe('RAIL');
    expect(f.services).toContain('SHUNTING');
    expect(f.confidence).toBeGreaterThanOrEqual(0.6);
    expect(f.chips.map((c) => c.key)).toEqual(expect.arrayContaining(['region:UZ-AN', 'qty:wagons=20', 'category:terminal', 'kind:RAIL', 'service:SHUNTING']));
  });

  it('yaqinlik: shahar koordinatasi + radius', () => {
    const f = parseQuery("Toshkentga 50 km ichida tarozisi bor temir yo'l terminali");
    expect(f.near?.lat).toBeCloseTo(41.31, 1);
    expect(f.near?.lng).toBeCloseTo(69.28, 1);
    expect(f.near?.radiusKm).toBe(50);
    expect(f.services).toEqual(['WEIGH']);
    expect(f.kind).toBe('RAIL');
    expect(f.chips.map((c) => c.key)).toContain('near:50');
  });

  it('texnika + bitim', () => {
    const f = parseQuery("Qo'qonda vagon ijaraga");
    expect(f.regions).toEqual(['UZ-FA']);
    expect(f.category).toBe('equipment');
    expect(f.equipment).toBe('WAGON');
    expect(f.deal).toBe('RENT');
  });

  it('rus: viloyatlar + xizmatlar', () => {
    const f = parseQuery('Навои, склад СВХ и автовывоз до Самарканда');
    expect(f.lang).toBe('ru');
    expect(f.regions).toEqual(expect.arrayContaining(['UZ-NW', 'UZ-SA']));
    expect(f.services).toEqual(expect.arrayContaining(['STORAGE', 'SVX', 'LAST_MILE']));
  });

  it('rus: viloyat nomi + o\'zak bo\'yicha xizmat', () => {
    const f = parseQuery('Сурхандарья, погрузка контейнеров, ближайший');
    expect(f.regions).toEqual(['UZ-SU']);
    expect([...f.services].sort()).toEqual(['CONTAINER', 'LOAD']);
  });

  it('rus: ikki viloyat, fura, tonna', () => {
    const f = parseQuery('Бухара, Хорезм, фура 20 тонн');
    expect(f.regions).toEqual(['UZ-BU', 'UZ-XO']);
    expect(f.corridor).toBeNull();
    expect(f.category).toBe('truck');
    expect(f.qty).toEqual({ tonnes: 20 });
  });

  it('bitta so\'z', () => {
    const f = parseQuery('Andijon');
    expect(f.regions).toEqual(['UZ-AN']);
    expect(f.confidence).toBe(1);
    expect(f.chips).toEqual([{ key: 'region:UZ-AN', type: 'region', value: 'UZ-AN' }]);
  });

  it('tushunilmagan so\'zlar', () => {
    const f = parseQuery('asdf qwerty');
    expect(f.confidence).toBe(0);
    expect(f.unresolved).toEqual(['asdf', 'qwerty']);
    expect(f.chips).toEqual([]);
  });

  it('opts.lang yutadi, bugun -> bookable', () => {
    const f = parseQuery("Samarqand bugun bo'sh slot", { lang: 'ru' });
    expect(f.lang).toBe('ru');
    expect(f.bookable).toBe(true);
    expect(f.unresolved).toEqual(['slot']);
  });

  it('ingliz: from X to Y', () => {
    const f = parseQuery('from Termez to Tashkent unloading');
    expect(f.lang).toBe('en');
    expect(f.corridor).toEqual({ from: 'UZ-SU', to: 'UZ-TK' });
    expect(f.services).toEqual(['UNLOAD']);
  });
});

describe('chipLabel', () => {
  it('uch tilda', () => {
    const corridor = { key: 'corridor:UZ-SU>UZ-TK', type: 'corridor' as const, value: 'UZ-SU>UZ-TK' };
    expect(chipLabel(corridor, 'uz')).toBe('Surxondaryo → Toshkent');
    expect(chipLabel({ key: 'near:50', type: 'near', value: '50' }, 'ru')).toBe('в радиусе 50 км');
    expect(chipLabel({ key: 'qty:wagons=20', type: 'qty', value: 'wagons=20' }, 'ru')).toBe('20 вагонов');
    expect(chipLabel({ key: 'qty:wagons=1', type: 'qty', value: 'wagons=1' }, 'en')).toBe('1 wagon');
    expect(chipLabel({ key: 'bookable:1', type: 'bookable', value: '1' }, 'uz')).toBe("Bugun bo'sh");
    expect(chipLabel({ key: 'service:UNLOAD', type: 'service', value: 'UNLOAD' }, 'en')).toBe('Unloading');
  });
});

describe("urgent va yordamchi lug'ati", () => {
  it('formatUrgentNo: UR-1001', () => {
    expect(formatUrgentNo(1001)).toBe('UR-1001');
    expect(formatUrgentNo(12345)).toBe('UR-12345');
  });

  it("turlar va yorliqlar uch tilda to'liq", () => {
    expect(URGENT_KINDS).toEqual(['LOCO_CALL', 'WAGON_REPAIR', 'CRANE', 'OTHER']);
    for (const lang of ['uz', 'ru', 'en'] as const) {
      for (const k of URGENT_KINDS) expect(URGENT_KIND_LABELS[lang][k]).toBeTruthy();
    }
    expect(URGENT_KIND_LABELS.uz.LOCO_CALL).toBe('Teplovoz chaqirish');
    expect(URGENT_STATUSES).toEqual(['OPEN', 'AWARDED', 'CLOSED', 'CANCELLED']);
    expect(URGENT_OFFER_STATUSES).toEqual(['SENT', 'AWARDED', 'DECLINED']);
  });

  it('YORDAMCHI chegaralari', () => {
    expect(YORDAMCHI.llmThreshold).toBe(0.6);
    expect(YORDAMCHI.guestDaily).toBeLessThan(YORDAMCHI.userDaily);
    expect(YORDAMCHI.timeoutMs).toBe(8000);
  });
});
