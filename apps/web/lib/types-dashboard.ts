// Kabinet taxtasi, hujjatlar va bosh sahifa plitkalari uchun API javob shakllari. lib/types.ts ga tegilmaydi.
import type { DocKind } from '@yuksaroy/domain';
import type { OrderCard } from './types';

/** GET /orders/board: OTHER = REJECTED, EXPIRED, CANCELLED. counts chegaragacha bo'lgan to'liq son. */
export type BoardColumn = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'OTHER';
export interface Board { columns: Record<BoardColumn, OrderCard[]>; counts: Record<BoardColumn, number> }

/** GET /documents/mine: hisob qatori (kind INVOICE) holat va summani Invoice'dan oladi. downloadUrl API yo'li (/v1/...). */
export interface MineDoc {
  id: string; no: string; kind: DocKind; orderNo: string; orgName: string; amountTiyin: number; status: string; createdAt: string; downloadUrl: string;
}
export interface MineDocs { items: MineDoc[]; total: number; page: number; limit: number }

/** GET /terminals/mine: plitkalar uchun kerakli maydonlar. */
export interface MyTerminalRow { id: string; name: string; status: string; freeToday: number; tariffs: unknown[] }
