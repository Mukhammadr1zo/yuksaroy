import { describe, expect, it } from 'vitest';
import { paywallFunnel, wallPeople, type FunnelSub } from './paywall';

// Toshkent 3-noyabr 00:00 = 2-noyabr 19:00 UTC
const sub = (userId: string, grants: string[], createdAt: string, extra: Partial<FunnelSub> = {}): FunnelSub =>
  ({ userId, grants, createdAt: new Date(createdAt), status: 'PENDING', paidAt: null, ...extra });
const row = (rows: ReturnType<typeof paywallFunnel>, kind: string) => rows.find((r) => r.kind === kind)!;

describe("devorda to'xtagan odamlar", () => {
  it("(kind, odam) juftlari kind bo'yicha sanaladi, notanish kind tashlanadi", () => {
    expect(wallPeople([{ kind: 'phone' }, { kind: 'phone' }, { kind: 'wagon' }, { kind: 'x' }])).toEqual({ phone: 2, wagon: 1, metrics: 0 });
  });
});

describe("devor -> obuna: tushum sahifasidagi qator", () => {
  it("odam, buyurtma va to'lov telefon va vagon bo'yicha alohida", () => {
    const hits = [
      { userId: 'a', kind: 'phone', firstDay: '2026-11-03' },
      { userId: 'b', kind: 'phone', firstDay: '2026-11-03' },
      { userId: 'c', kind: 'phone', firstDay: '2026-11-03' },
      { userId: 'a', kind: 'wagon', firstDay: '2026-11-03' },
    ];
    const subs = [
      sub('a', ['PHONE'], '2026-11-04T10:00:00Z', { status: 'ACTIVE', paidAt: new Date('2026-11-05T10:00:00Z') }),
      sub('b', ['PHONE', 'WAGON'], '2026-11-04T10:00:00Z'), // buyurtma bor, to'lanmagan
    ];
    const r = paywallFunnel(hits, subs);
    expect(row(r, 'phone')).toEqual({ kind: 'phone', people: 3, ordered: 2, paid: 1 });
    // a ning obunasi faqat PHONE: vagon devorini ochmaydi, shuning uchun vagon qatorida buyurtma yo'q
    expect(row(r, 'wagon')).toEqual({ kind: 'wagon', people: 1, ordered: 0, paid: 0 });
  });

  it('devorga urilishdan OLDIN yaratilgan buyurtma devor natijasi emas', () => {
    const hits = [{ userId: 'a', kind: 'phone', firstDay: '2026-11-03' }];
    const before = sub('a', ['PHONE'], '2026-11-02T18:00:00Z'); // Toshkent 2-noyabr 23:00, devordan oldin
    const after = sub('a', ['PHONE'], '2026-11-02T19:00:00Z'); // Toshkent 3-noyabr 00:00 ning o'zi
    expect(row(paywallFunnel(hits, [before]), 'phone').ordered).toBe(0);
    expect(row(paywallFunnel(hits, [after]), 'phone').ordered).toBe(1);
  });

  it("bekor qilingan buyurtma to'langan emas, ikki buyurtma bitta odam", () => {
    const hits = [{ userId: 'a', kind: 'metrics', firstDay: '2026-11-03' }];
    const paid = new Date('2026-11-05T00:00:00Z');
    const subs = [
      sub('a', ['PHONE'], '2026-11-04T00:00:00Z', { status: 'CANCELLED', paidAt: paid }),
      sub('a', ['WAGON'], '2026-11-06T00:00:00Z', { status: 'PENDING' }),
    ];
    // ko'rsatkichlar devori har qanday obunani ochadi
    expect(row(paywallFunnel(hits, subs), 'metrics')).toEqual({ kind: 'metrics', people: 1, ordered: 1, paid: 0 });
  });

  it("hech kim urilmagan bo'lsa uch qator nol bilan", () => {
    expect(paywallFunnel([], [])).toEqual([
      { kind: 'phone', people: 0, ordered: 0, paid: 0 },
      { kind: 'wagon', people: 0, ordered: 0, paid: 0 },
      { kind: 'metrics', people: 0, ordered: 0, paid: 0 },
    ]);
  });
});
