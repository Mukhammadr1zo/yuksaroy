// Kuzatuv qoidalari: bazasiz. Ikki majburiy qoida (namuna qator va egasi) va
// hudud bilan kuzov turi orasidagi asimmetriya shu yerda qotirilgan.
import { describe, expect, it } from 'vitest';
import { WATCH_MAX, matchWatches, pickParams, watchKey, watchSlot, watchUserIds, type WatchEvent, type WatchRow } from '@yuksaroy/domain';

const row = (id: string, userId: string, kind: string, params: Record<string, string>): WatchRow => ({ id, userId, kind, params });
const cargo = (values: WatchEvent['values'], over: Partial<WatchEvent> = {}): WatchEvent =>
  ({ kind: 'CARGO', isDemo: false, skipUserIds: [], values, ...over });
const listing = (values: WatchEvent['values'], over: Partial<WatchEvent> = {}): WatchEvent =>
  ({ kind: 'LISTING', isDemo: false, skipUserIds: [], values, ...over });

describe('mos kelish', () => {
  it("namuna qator hech qachon xabar bermaydi", () => {
    const rows = [row('w1', 'u1', 'CARGO', {})];
    expect(matchWatches(cargo({ fromRegion: 'UZ-TK' }, { isDemo: true }), rows)).toEqual([]);
  });

  it('chetlatilgan odamga yuborilmaydi (egasi va allaqachon oluvchilar)', () => {
    const rows = [row('w1', 'u1', 'CARGO', {}), row('w2', 'u2', 'CARGO', {})];
    const out = matchWatches(cargo({ fromRegion: 'UZ-TK' }, { skipUserIds: ['u1'] }), rows);
    expect(out.map((w) => w.userId)).toEqual(['u2']);
  });

  it("bo'sh shart har hodisaga mos", () => {
    expect(matchWatches(cargo({ fromRegion: 'UZ-SA' }), [row('w1', 'u1', 'CARGO', {})])).toHaveLength(1);
  });

  it("bitta shart mos kelmasa tushib qoladi", () => {
    const rows = [row('w1', 'u1', 'CARGO', { fromRegion: 'UZ-TK', toRegion: 'UZ-SA' })];
    expect(matchWatches(cargo({ fromRegion: 'UZ-TK', toRegion: 'UZ-QA' }), rows)).toEqual([]);
  });

  it("hodisadagi ro'yxat ichida bo'lsa mos (xizmat hududlari)", () => {
    const rows = [row('w1', 'u1', 'LISTING', { regionCode: 'UZ-SA' })];
    expect(matchWatches(listing({ regionCode: ['UZ-TK', 'UZ-SA'] }), rows)).toHaveLength(1);
  });

  it('boshqa turdagi kuzatuv qaralmaydi', () => {
    expect(matchWatches(listing({ regionCode: 'UZ-TK' }), [row('w1', 'u1', 'CARGO', {})])).toEqual([]);
  });

  it("oq ro'yxatdan tashqari maydon shartga aylanmaydi", () => {
    const rows = [row('w1', 'u1', 'CARGO', { terminalId: 't1' })];
    expect(matchWatches(cargo({ fromRegion: 'UZ-TK' }), rows)).toHaveLength(1);
  });

  it("noto'g'ri qiymat shartga aylanmaydi", () => {
    const rows = [row('w1', 'u1', 'CARGO', { fromRegion: 'UZ-XX' })];
    expect(matchWatches(cargo({ fromRegion: 'UZ-TK' }), rows)).toHaveLength(1);
  });

  it('bir odamning ikki kuzatuvi mos kelsa bitta id qaytadi', () => {
    const rows = [row('w1', 'u1', 'CARGO', { fromRegion: 'UZ-TK' }), row('w2', 'u1', 'CARGO', {})];
    expect(watchUserIds(matchWatches(cargo({ fromRegion: 'UZ-TK' }), rows))).toEqual(['u1']);
  });

  it("yuboruvchi kuzov turini ko'rsatmagan bo'lsa har qanday kuzovga mos", () => {
    const rows = [row('w1', 'u1', 'CARGO', { truckType: 'TENT' })];
    expect(matchWatches(cargo({ fromRegion: 'UZ-TK', truckType: null }), rows)).toHaveLength(1);
  });

  it("hudud bunday ishlamaydi: hududsiz qator hudud kutgan odamga bormaydi", () => {
    const rows = [row('w1', 'u1', 'CARGO', { fromRegion: 'UZ-TK' })];
    expect(matchWatches(cargo({ fromRegion: null }), rows)).toEqual([]);
  });

  it('bitim turi mos kelmasa tushib qoladi', () => {
    const rows = [row('w1', 'u1', 'LISTING', { deal: 'RENT' })];
    expect(matchWatches(listing({ deal: 'SALE' }), rows)).toEqual([]);
  });
});

describe('shart tozalash va kalit', () => {
  it("bo'sh satr va probel maydon yozmaydi", () => {
    expect(pickParams('CARGO', { fromRegion: '', toRegion: '   ', truckType: 'TENT' })).toEqual({ truckType: 'TENT' });
  });

  it('maydon tartibi va begona maydon kalitni o\'zgartirmaydi', () => {
    const a = watchKey('CARGO', pickParams('CARGO', { toRegion: 'UZ-SA', fromRegion: 'UZ-TK' }));
    const b = watchKey('CARGO', pickParams('CARGO', { fromRegion: 'UZ-TK', toRegion: 'UZ-SA', terminalId: 't1' }));
    expect(a).toBe(b);
  });
});

describe('joy bormi', () => {
  const mine = (n: number) => Array.from({ length: n }, (_, i) => row(`w${i}`, 'u1', 'CARGO', { fromRegion: 'UZ-TK', toRegion: `UZ-0${i}` }));

  it('aynan shunday kuzatuv bor: yangisi ochilmaydi', () => {
    const rows = [row('w1', 'u1', 'CARGO', { fromRegion: 'UZ-TK' })];
    expect(watchSlot(rows, 'CARGO', { fromRegion: 'UZ-TK' })).toEqual({ same: 'w1' });
  });

  it("chegara to'lgan: yangisi qo'shilmaydi", () => {
    expect(watchSlot(mine(WATCH_MAX), 'CARGO', { fromRegion: 'UZ-SA' })).toEqual({ full: true });
  });

  it("chegara to'lgan bo'lsa ham takroriy bosish joy yemaydi", () => {
    const rows = [...mine(WATCH_MAX - 1), row('wx', 'u1', 'CARGO', { fromRegion: 'UZ-SA' })];
    expect(watchSlot(rows, 'CARGO', { fromRegion: 'UZ-SA' })).toEqual({ same: 'wx' });
  });

  it("joy bor", () => {
    expect(watchSlot([], 'CARGO', {})).toEqual({ add: true });
  });
});
