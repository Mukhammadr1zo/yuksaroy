/**
 * Payme Merchant API (JSON-RPC 2.0): Payme serveri bizning /v1/payments/payme ga so'rov yuboradi.
 * https://developer.help.paycom.uz/protokol-merchant-api/
 *
 * Buyurtma = obuna qatori, hisob maydoni `order_id` = "PAY-1042" (Payme kabinetida shu nom bilan
 * sozlanadi). Summa tiyinda. Javob HAR DOIM HTTP 200: xato ham tanadagi `error` bilan.
 *
 * Holatlar: 1 yaratildi, 2 to'landi, -1 to'lovgacha bekor, -2 to'lovdan keyin bekor.
 * Yaratilgan, lekin 12 soatda to'lanmagan tranzaksiya sabab 4 bilan bekor bo'ladi.
 */
import { timingSafeEqual } from 'node:crypto';
import type { PaymentStore, TxnRow } from './store';

export const PAYME_TIMEOUT_MS = 43_200_000;

type Msg = { uz: string; ru: string; en: string };
export class PaymeError {
  constructor(readonly code: number, readonly message: Msg, readonly data?: string) {}
}

const E = {
  auth: () => new PaymeError(-32504, { uz: "Ruxsat yo'q", ru: 'Недостаточно привилегий', en: 'Insufficient privileges' }),
  parse: () => new PaymeError(-32700, { uz: "So'rovni o'qib bo'lmadi", ru: 'Ошибка разбора JSON', en: 'Parse error' }),
  method: () => new PaymeError(-32601, { uz: 'Usul topilmadi', ru: 'Метод не найден', en: 'Method not found' }),
  params: () => new PaymeError(-32600, { uz: "Parametrlar noto'g'ri", ru: 'Неверные параметры', en: 'Invalid params' }),
  amount: () => new PaymeError(-31001, { uz: "Summa noto'g'ri", ru: 'Неверная сумма', en: 'Incorrect amount' }),
  notFound: () => new PaymeError(-31003, { uz: 'Tranzaksiya topilmadi', ru: 'Транзакция не найдена', en: 'Transaction not found' }),
  cannotPerform: () => new PaymeError(-31008, { uz: "Amalni bajarib bo'lmaydi", ru: 'Невозможно выполнить операцию', en: 'Unable to perform operation' }),
  order: () => new PaymeError(-31050, { uz: 'Buyurtma topilmadi', ru: 'Заказ не найден', en: 'Order not found' }, 'order_id'),
  orderClosed: () => new PaymeError(-31051, { uz: "Buyurtma to'langan yoki bekor qilingan", ru: 'Заказ уже оплачен или отменён', en: 'Order already paid or cancelled' }, 'order_id'),
  orderBusy: () => new PaymeError(-31052, { uz: "Buyurtma bo'yicha boshqa to'lov kutilmoqda", ru: 'По заказу ожидается другая оплата', en: 'Another payment is pending for this order' }, 'order_id'),
};

/**
 * Authorization: Basic base64("<login>:<KEY>"). Login amalda "Paycom", lekin hujjat uni Payme
 * xodimlaridan so'rashni aytadi: shuning uchun sozlanadi (PAYME_LOGIN). Taqqoslash vaqtga bog'liq emas.
 * Payme so'rovlari 185.234.113.1-15 manzillaridan keladi; kalit tekshiruvi yetarli, IP proksi ortida ishonchsiz.
 */
export function paymeAuthOk(header: string | undefined, key: string, login = 'Paycom'): boolean {
  const want = Buffer.from(`Basic ${Buffer.from(`${login}:${key}`).toString('base64')}`);
  const got = Buffer.from(header ?? '');
  return got.length === want.length && timingSafeEqual(got, want);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null);
const ms = (d: Date | null) => (d ? d.getTime() : 0);

export class Payme {
  constructor(private readonly store: PaymentStore, private readonly now: () => Date = () => new Date()) {}

  /** Bitta JSON-RPC so'rov -> javob tanasi (har doim HTTP 200). */
  async handle(body: unknown, authHeader: string | undefined, key: string, login = 'Paycom'): Promise<Record<string, unknown>> {
    const req = (body && typeof body === 'object' ? body : null) as { id?: unknown; method?: unknown; params?: unknown } | null;
    const id = req?.id ?? null;
    try {
      if (!paymeAuthOk(authHeader, key, login)) throw E.auth();
      if (!req) throw E.parse();
      const p = (req.params && typeof req.params === 'object' ? req.params : {}) as Record<string, unknown>;
      const result = await this.call(String(req.method ?? ''), p);
      return { jsonrpc: '2.0', id, result };
    } catch (e) {
      if (e instanceof PaymeError) return { jsonrpc: '2.0', id, error: { code: e.code, message: e.message, ...(e.data ? { data: e.data } : {}) } };
      throw e;
    }
  }

  private call(method: string, p: Record<string, unknown>) {
    switch (method) {
      case 'CheckPerformTransaction': return this.checkPerform(p);
      case 'CreateTransaction': return this.create(p);
      case 'PerformTransaction': return this.perform(p);
      case 'CancelTransaction': return this.cancel(p);
      case 'CheckTransaction': return this.check(p);
      case 'GetStatement': return this.statement(p);
      default: throw E.method();
    }
  }

  /** Buyurtma bor, to'lanmagan va summa aynan o'zi. Boshqa ochiq to'lov bo'lsa ham rad. */
  private async payableOrder(p: Record<string, unknown>) {
    const amount = num(p.amount);
    const no = str((p.account as Record<string, unknown> | undefined)?.order_id);
    if (amount === null || !no) throw E.params();
    const order = await this.store.orderByNo(no);
    if (!order) throw E.order();
    if (order.status !== 'PENDING') throw E.orderClosed();
    if (BigInt(Math.round(amount)) !== order.amountTiyin) throw E.amount();
    return order;
  }

  private async checkPerform(p: Record<string, unknown>) {
    const order = await this.payableOrder(p);
    const open = await this.store.openTxn(order.id);
    if (open && !this.expired(open)) throw E.orderBusy();
    return { allow: true };
  }

  private async create(p: Record<string, unknown>) {
    const extId = str(p.id);
    const time = num(p.time);
    if (!extId || time === null) throw E.params();
    const t = await this.store.txn('payme', extId);
    if (t) {
      // Takror so'rov: o'sha javob. Ochiq, lekin muddati o'tgan bo'lsa bekor qilinadi
      if (t.state !== 1) throw E.cannotPerform();
      if (this.expired(t)) { await this.expire(t); throw E.cannotPerform(); }
      return { create_time: Number(t.providerTime ?? BigInt(ms(t.createdAt))), transaction: t.id, state: 1 };
    }
    const order = await this.payableOrder(p);
    const open = await this.store.openTxn(order.id);
    if (open) {
      if (!this.expired(open)) throw E.orderBusy();
      await this.expire(open);
    }
    const n = await this.store.createTxn({ provider: 'payme', extId, subscriptionId: order.id, amountTiyin: order.amountTiyin, providerTime: BigInt(Math.round(time)) });
    return { create_time: time, transaction: n.id, state: 1 };
  }

  private async perform(p: Record<string, unknown>) {
    const t = await this.txnOf(p);
    if (t.state === 2) return { transaction: t.id, perform_time: ms(t.performedAt), state: 2 };
    if (t.state !== 1) throw E.cannotPerform();
    if (this.expired(t)) { await this.expire(t); throw E.cannotPerform(); }
    const now = this.now();
    // Obuna shu orada bekor qilingan yoki qo'lda tasdiqlangan bo'lsa pul olinmaydi
    if (!(await this.store.activate(t.subscriptionId, 'payme', now))) throw E.cannotPerform();
    const u = await this.store.updateTxn(t.id, { state: 2, performedAt: now });
    return { transaction: u.id, perform_time: ms(u.performedAt), state: 2 };
  }

  private async cancel(p: Record<string, unknown>) {
    const t = await this.txnOf(p);
    const reason = num(p.reason);
    if (t.state < 0) return { transaction: t.id, cancel_time: ms(t.cancelledAt), state: t.state };
    const now = this.now();
    // To'langanini bekor qilish = pulni qaytarish: obuna ham yopiladi
    if (t.state === 2) await this.store.refund(t.subscriptionId, 'payme');
    const u = await this.store.updateTxn(t.id, { state: t.state === 2 ? -2 : -1, reason, cancelledAt: now });
    return { transaction: u.id, cancel_time: ms(u.cancelledAt), state: u.state };
  }

  private async check(p: Record<string, unknown>) {
    const t = await this.txnOf(p);
    return {
      create_time: Number(t.providerTime ?? BigInt(ms(t.createdAt))), perform_time: ms(t.performedAt), cancel_time: ms(t.cancelledAt),
      transaction: t.id, state: t.state, reason: t.reason,
    };
  }

  private async statement(p: Record<string, unknown>) {
    const from = num(p.from); const to = num(p.to);
    if (from === null || to === null) throw E.params();
    const rows = await this.store.txnsBetween('payme', BigInt(Math.round(from)), BigInt(Math.round(to)));
    return {
      transactions: rows.map((t) => ({
        id: t.extId, time: Number(t.providerTime ?? 0n), amount: Number(t.amountTiyin), account: { order_id: t.orderNo },
        create_time: Number(t.providerTime ?? 0n), perform_time: ms(t.performedAt), cancel_time: ms(t.cancelledAt),
        transaction: t.id, state: t.state, reason: t.reason,
      })),
    };
  }

  private async txnOf(p: Record<string, unknown>): Promise<TxnRow> {
    const extId = str(p.id);
    if (!extId) throw E.params();
    const t = await this.store.txn('payme', extId);
    if (!t) throw E.notFound();
    return t;
  }

  private expired(t: TxnRow) {
    const created = t.providerTime !== null ? Number(t.providerTime) : ms(t.createdAt);
    return this.now().getTime() - created > PAYME_TIMEOUT_MS;
  }

  /** Muddati o'tgan ochiq tranzaksiya: sabab 4 (vaqt tugadi) bilan bekor. */
  private expire(t: TxnRow) {
    return this.store.updateTxn(t.id, { state: -1, reason: 4, cancelledAt: this.now() });
  }
}
