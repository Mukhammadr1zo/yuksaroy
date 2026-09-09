// Hujjatlar ro'yxati: akt va hisob bitta jadvalda. Hisob qatori (kind INVOICE) holat va summani Invoice'dan oladi. DB kerak emas.
import type { DocKind } from '@yuksaroy/domain';

export interface MineDoc { id: string; no: string; kind: DocKind; status: string; orderNo: string; supplierName: string; payerName: string; totalTiyin: number; createdAt: Date }
export interface MineInvoice { no: string; status: string; amountTiyin: number }

/** orgName: qarshi tomon (mijozga bajaruvchi, terminalga to'lovchi). Yangi hujjat birinchi. */
export function mergeDocuments(docs: MineDoc[], invoices: MineInvoice[], scope: 'client' | 'terminal') {
  const inv = new Map(invoices.map((i) => [i.no, i]));
  return docs
    .map((d) => {
      const i = d.kind === 'INVOICE' ? inv.get(d.no) : undefined;
      return {
        id: d.id, no: d.no, kind: d.kind, orderNo: d.orderNo,
        orgName: scope === 'terminal' ? d.payerName : d.supplierName,
        amountTiyin: i?.amountTiyin ?? d.totalTiyin,
        status: i?.status ?? d.status,
        createdAt: d.createdAt,
        downloadUrl: `/v1/documents/${d.id}/download`,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
