/**
 * Click SHOP API: Click serveri ikki bosqichda forma (x-www-form-urlencoded) yuboradi.
 * https://docs.click.uz/click-api-request/
 *
 *   Prepare  (action=0) -> /v1/payments/click/prepare : buyurtma bormi, summa to'g'rimi
 *   Complete (action=1) -> /v1/payments/click/complete: to'lov bo'ldi, obunani yoqamiz
 *
 * merchant_trans_id = "PAY-1042", summa so'mda (kasr bilan). Imzo MD5:
 *   prepare : md5(click_trans_id + service_id + SECRET + merchant_trans_id + amount + action + sign_time)
 *   complete: md5(click_trans_id + service_id + SECRET + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 * merchant_prepare_id / merchant_confirm_id butun son bo'lishi kerak: buyurtma raqamining
 * raqam qismi (PAY-1042 -> 1042), u noyob va Complete da qayta tekshiriladi.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { PaymentStore } from './store';

export const CLICK_ERR = {
  OK: 0, SIGN: -1, AMOUNT: -2, ACTION: -3, ALREADY_PAID: -4, ORDER: -5, TXN: -6, UPDATE: -7, REQUEST: -8, CANCELLED: -9,
} as const;
const NOTE: Record<number, string> = {
  0: 'Success', [-1]: 'SIGN CHECK FAILED', [-2]: 'Incorrect parameter amount', [-3]: 'Action not found', [-4]: 'Already paid',
  [-5]: 'Order does not exist', [-6]: 'Transaction does not exist', [-7]: 'Failed to update order', [-8]: 'Error in request from click', [-9]: 'Transaction cancelled',
};

type Body = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export function clickSign(b: Body, secret: string, withPrepare: boolean): string {
  const parts = [s(b.click_trans_id), s(b.service_id), secret, s(b.merchant_trans_id), withPrepare ? s(b.merchant_prepare_id) : '', s(b.amount), s(b.action), s(b.sign_time)];
  return createHash('md5').update(parts.join('')).digest('hex');
}
const signOk = (b: Body, secret: string, withPrepare: boolean) => {
  const want = Buffer.from(clickSign(b, secret, withPrepare));
  const got = Buffer.from(s(b.sign_string).toLowerCase());
  return got.length === want.length && timingSafeEqual(got, want);
};
/** "99000" yoki "99000.00" so'm -> tiyin. Noto'g'ri yozuv null. */
const tiyinOf = (amount: string): bigint | null => (/^\d+(\.\d{1,2})?$/.test(amount) ? BigInt(Math.round(Number(amount) * 100)) : null);
/** PAY-1042 -> 1042: Click butun son kutadi. */
export const prepareIdOf = (no: string): number => Number(no.replace(/\D/g, '')) || 0;

export class Click {
  constructor(private readonly store: PaymentStore, private readonly cfg: { serviceId: string; secret: string }, private readonly now: () => Date = () => new Date()) {}

  private reply(b: Body, error: number, extra: Record<string, unknown> = {}) {
    return { click_trans_id: s(b.click_trans_id), merchant_trans_id: s(b.merchant_trans_id), ...extra, error, error_note: NOTE[error] ?? 'Error' };
  }

  /** Umumiy tekshiruv: maydonlar, xizmat, imzo, amal. */
  private base(b: Body, action: '0' | '1') {
    if (!s(b.click_trans_id) || !s(b.merchant_trans_id) || !s(b.amount) || !s(b.sign_time) || !s(b.sign_string)) return CLICK_ERR.REQUEST;
    if (s(b.service_id) !== this.cfg.serviceId) return CLICK_ERR.REQUEST;
    if (!signOk(b, this.cfg.secret, action === '1')) return CLICK_ERR.SIGN;
    if (s(b.action) !== action) return CLICK_ERR.ACTION;
    return CLICK_ERR.OK;
  }

  async prepare(b: Body) {
    const bad = this.base(b, '0');
    if (bad) return this.reply(b, bad);
    const order = await this.store.orderByNo(s(b.merchant_trans_id));
    if (!order) return this.reply(b, CLICK_ERR.ORDER);
    if (order.status === 'ACTIVE') return this.reply(b, CLICK_ERR.ALREADY_PAID);
    if (order.status !== 'PENDING') return this.reply(b, CLICK_ERR.CANCELLED);
    if (tiyinOf(s(b.amount)) !== order.amountTiyin) return this.reply(b, CLICK_ERR.AMOUNT);
    const extId = s(b.click_trans_id);
    // Takror Prepare: mavjud qator, yangisi yozilmaydi
    const t = (await this.store.txn('click', extId)) ?? await this.store.createTxn({ provider: 'click', extId, subscriptionId: order.id, amountTiyin: order.amountTiyin });
    if (t.subscriptionId !== order.id) return this.reply(b, CLICK_ERR.TXN);
    if (t.state < 0) return this.reply(b, CLICK_ERR.CANCELLED);
    return this.reply(b, CLICK_ERR.OK, { merchant_prepare_id: prepareIdOf(order.no) });
  }

  async complete(b: Body) {
    const bad = this.base(b, '1');
    if (bad) return this.reply(b, bad);
    const t = await this.store.txn('click', s(b.click_trans_id));
    if (!t) return this.reply(b, CLICK_ERR.TXN);
    const order = await this.store.orderById(t.subscriptionId);
    if (!order || order.no !== s(b.merchant_trans_id) || String(prepareIdOf(order.no)) !== s(b.merchant_prepare_id)) return this.reply(b, CLICK_ERR.TXN);
    const ok = { merchant_confirm_id: prepareIdOf(order.no) };
    if (t.state === 2) return this.reply(b, CLICK_ERR.ALREADY_PAID, ok);
    if (t.state < 0) return this.reply(b, CLICK_ERR.CANCELLED);
    if (tiyinOf(s(b.amount)) !== t.amountTiyin) return this.reply(b, CLICK_ERR.AMOUNT);
    const now = this.now();
    // Click o'zi xato yuborsa (to'lov o'tmadi): tranzaksiya bekor, obuna kutishda qoladi
    if (Number(s(b.error) || '0') < 0) {
      await this.store.updateTxn(t.id, { state: -1, cancelledAt: now });
      return this.reply(b, CLICK_ERR.CANCELLED);
    }
    if (!(await this.store.activate(t.subscriptionId, 'click', now))) {
      await this.store.updateTxn(t.id, { state: -1, cancelledAt: now });
      return this.reply(b, CLICK_ERR.UPDATE);
    }
    await this.store.updateTxn(t.id, { state: 2, performedAt: now });
    return this.reply(b, CLICK_ERR.OK, ok);
  }
}
