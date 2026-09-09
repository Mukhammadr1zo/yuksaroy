// Akt va hisob birlashuvi: hisob holati Invoice'dan, qarshi tomon nomi scope bo'yicha. DB kerak emas.
import { describe, expect, it } from 'vitest';
import { mergeDocuments, type MineDoc } from './mine';

const doc = (id: string, kind: MineDoc['kind'], no: string, createdIso: string): MineDoc =>
  ({ id, no, kind, status: 'READY', orderNo: 'YS-1', supplierName: 'Terminal MChJ', payerName: 'Yuk egasi MChJ', totalTiyin: 500_000, createdAt: new Date(createdIso) });

describe('mergeDocuments', () => {
  const docs = [doc('a', 'ACT', 'AKT-1', '2026-09-01T10:00:00Z'), doc('b', 'INVOICE', 'INV-1', '2026-09-01T10:00:01Z')];
  const invoices = [{ no: 'INV-1', status: 'PAID_OFFLINE', amountTiyin: 500_000 }];

  it("hisob qatori Invoice holatini oladi, akt o'z holatini; yangi birinchi; havola", () => {
    const r = mergeDocuments(docs, invoices, 'client');
    expect(r.map((x) => [x.no, x.status])).toEqual([['INV-1', 'PAID_OFFLINE'], ['AKT-1', 'READY']]);
    expect(r[0]).toMatchObject({ id: 'b', kind: 'INVOICE', orderNo: 'YS-1', orgName: 'Terminal MChJ', amountTiyin: 500_000, downloadUrl: '/v1/documents/b/download' });
  });

  it("terminal scope: qarshi tomon to'lovchi; Invoice topilmasa hujjat holati", () => {
    const r = mergeDocuments(docs, [], 'terminal');
    expect(r.every((x) => x.orgName === 'Yuk egasi MChJ')).toBe(true);
    expect(r.find((x) => x.kind === 'INVOICE')?.status).toBe('READY');
    expect(mergeDocuments([], [], 'client')).toEqual([]);
  });
});
