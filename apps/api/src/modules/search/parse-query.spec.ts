import { describe, expect, it } from 'vitest';
import {
  REGIONS, REGION_ADJACENCY, URGENT_KINDS, URGENT_KIND_LABELS, URGENT_OFFER_STATUSES, URGENT_STATUSES, YORDAMCHI,
  catalogSearch, chipLabel, corridorRegions, formatUrgentNo, normalizeQuery, parseQuery, slugify,
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

// Bitta joyning har xil yozuvi bitta kalitga tushadi: katalog qidiruvi slug bo'yicha shunga tayanadi
// (slug lotin "stansiya-nom"). Rus imlosidagi nom (Фергана, Ташкент) hozircha qamrovdan tashqarida:
// u boshqa so'z ("fergana"), o'zbekcha slugga tushmaydi.
describe('normalizeQuery + slugify: lotin, kirill va telefon apostrofi', () => {
  const key = (s: string) => slugify(normalizeQuery(s));
  it.each<[string, string[]]>([
    ['bekobod', ['Bekobod', 'BEKOBOD', 'Бекобод']],
    ['fargona', ["Farg'ona", 'Farg\u2018ona', 'Farg\u2019ona', 'Farg\u02BBona', 'Farg\u02BCona', 'Farg`ona', 'Fargona', 'Фарғона']],
    ['qarshi-neft', ['qarshi neft', 'Qarshi  Neft', 'Қарши нефт', 'ҚАРШИ НЕФТ']],
  ])('%s', (slug, variants) => {
    for (const v of variants) expect(key(v)).toBe(slug);
  });

  it("normalizeQuery hamma apostrofni ' ga aylantiradi", () => {
    for (const a of ['\u2018', '\u2019', '\u02BB', '\u02BC', '`']) expect(normalizeQuery(`Farg${a}ona`)).toBe("farg'ona");
  });

  it('slugify telefon apostrofini ham tashlaydi: yangi slug ikki xil chiqmasin', () => {
    expect(slugify('Farg\u2018ona')).toBe('fargona');
    expect(slugify('Farg\u02BCona')).toBe('fargona');
  });
});

describe("parseQuery.words: filtrga aylanmagan so'zlar nom qidiruvida qoladi", () => {
  it("viloyatdan aniqroq shahar o'zbekcha nomi bilan qoladi (rus imlosidagi lug'at so'zi ham)", () => {
    for (const q of ['Bekobod', 'bekobod', 'Бекобод', 'Бекободда', 'Бекабад']) {
      const f = parseQuery(q);
      expect(f.regions).toEqual(['UZ-TO']);
      expect(f.words).toEqual(['Bekobod']);
    }
  });

  it("tanilmagan so'z yozilganicha va tartib bilan", () => {
    expect(parseQuery('qarshi neft').words).toEqual(['Qarshi', 'neft']);
    expect(parseQuery('Қарши нефт').words).toEqual(['Qarshi', 'нефт']);
    expect(parseQuery('asdf qwerty').words).toEqual(['asdf', 'qwerty']);
  });

  it("viloyat bilan bir nomli shahar va viloyat nomi qolmaydi: aks holda ro'yxat nomigagina torayardi", () => {
    for (const q of ['Toshkent', 'Toshkent shahri', 'Samarqand viloyati', "Farg'ona", 'Farg\u2018ona', 'Toshkentda konteyner']) {
      expect(parseQuery(q).words).toEqual([]);
    }
  });

  it("radius nuqtasi va koridor uchlari filtr, so'z emas", () => {
    expect(parseQuery('Bekobod 30 km').words).toEqual([]);
    expect(parseQuery('Termizdan Toshkentgacha neft').words).toEqual(['neft']);
  });

  it("ruscha kelishik qo'shimchasi bilan ham shahar (kalit + 1-2 harf)", () => {
    expect(parseQuery('в Бекабаде').words).toEqual(['Bekobod']);
    expect(parseQuery('Чирчике').words).toEqual(['Chirchiq']);
  });

  // Lug'atning taxminiy moslashi (5 harfli prefiks) oddiy so'zni shaharga aylantiradi. U faqat
  // viloyat filtri bo'lib qoladi: nom filtriga aylansa ro'yxat boshqa shaharga torayardi
  // ("Samarqand shahri" -> 2 ta Shahrixon qatori) va izohda odam yozmagan so'z chiqardi.
  it("taxminiy topilma so'zga aylanmaydi: shahri, yangi, katta, olmalar", () => {
    for (const q of ['Samarqand shahri', 'Navoiy shahri', 'Buxoro shahridagi ombor', 'Toshkentda yangi terminal', 'katta ombor', 'olmalar']) {
      expect(parseQuery(q).words).toEqual([]);
    }
  });

  it("shahar so'zi faqat so'rovda bitta joy aytilganda: aks holda ikkinchi joyning qatorlari yashirinardi", () => {
    for (const q of ['Chirchiq Toshkent', 'Bekobod Samarqand', 'Bekobod Chirchiq']) expect(parseQuery(q).words).toEqual([]);
    // Viloyat va uning shahri bitta joy
    expect(parseQuery('Toshkent viloyati Bekobod').words).toEqual(['Bekobod']);
    // Taxminiy topilma (shahri -> Andijon) joy sanog'iga kirmaydi
    expect(parseQuery('Qarshi shahri').words).toEqual(['Qarshi']);
  });
});

describe("catalogSearch: /terminals sahifasining nom qidiruvi qarori", () => {
  const run = (q: string, hasChips = parseQuery(q).chips.length > 0) => catalogSearch(q, parseQuery(q), hasChips);

  it("chip yo'q: q yozilganicha ketadi, zaxira so'rov yo'q (filtrsiz qayta so'rash ma'nosiz)", () => {
    expect(run('asdf qwerty')).toEqual({ q: 'asdf qwerty', fallback: false, withoutRegion: 'asdf qwerty' });
    expect(catalogSearch('', null, false)).toEqual({ q: '', fallback: false, withoutRegion: '' });
  });

  it("chip bor: q o'rnida so'zlar; so'z bo'lsa natija 0 chiqqanda filtrning o'zi bilan qayta so'raladi", () => {
    expect(run('Бекобод')).toEqual({ q: 'Bekobod', fallback: true, withoutRegion: '' });
    expect(run('Қўқон биокимё')).toMatchObject({ q: "Qo'qon биокимё", fallback: true });
    // Hamma so'z filtrga aylangan: q bo'sh, qayta so'rash yo'q
    expect(run('Andijon konteyner')).toEqual({ q: '', fallback: false, withoutRegion: '' });
  });

  it("viloyat chipi olib tashlanganda shahar so'zi ketadi (viloyatni qayta tiklamasin), tanilmagan so'z qoladi", () => {
    expect(run('qarshi neft').withoutRegion).toBe('neft');
    expect(run('Bekobod').withoutRegion).toBe('');
    // Havoladagi q (so'zlar) qayta tahlil qilinganda ham shu natija
    expect(run(run('Қарши нефт').q)).toEqual({ q: 'Qarshi нефт', fallback: true, withoutRegion: 'нефт' });
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
