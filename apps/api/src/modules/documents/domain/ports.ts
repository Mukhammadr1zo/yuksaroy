import type { DocKind } from '@yuksaroy/domain';

/** PDF uchun muzlatilgan ma'lumot: hujjat tuzilgan paytdagi holat, keyin o'zgarmaydi. */
export interface DocPayload {
  no: string;
  issuedAt: string;
  orderNo: string;
  terminalName: string;
  stationName: string;
  slot: string | null;
  supplier: Party;
  payer: Party;
  lines: DocLine[];
  totalTiyin: number;
  vatNote: string;
  dueAt?: string;
  verifyUrl: string;
}
export interface Party {
  name: string;
  stir: string | null;
  address: string | null;
}
export interface DocLine {
  name: string;
  qty: string;
  unitPrice: string;
  amount: string;
}

export interface DocumentRecord {
  id: string;
  no: string;
  kind: DocKind;
  status: string;
  orderId: string | null;
  orgId: string;
  payload: DocPayload;
  sha256: string;
  qrToken: string;
  createdAt: Date;
}
