/**
 * Uzum Bank Merchant API: Uzum serveri bizning /v1/payments/uzum/<method> ga JSON yuboradi.
 * Rasmiy spetsifikatsiya: https://developer.uzumbank.uz/en/redocusaurus/en_merchant.yaml
 *
 *   check   : buyurtma bormi va to'lanadimi        -> 200 { status: "OK" }
 *   create  : tranzaksiya yaratish                -> 200 { status: "CREATED", transTime }
 *   confirm : pul yechildi, xizmatni beramiz       -> 200 { status: "CONFIRMED", confirmTime }
 *   reverse : bekor (to'lovgacha yoki keyin)        -> 200 { status: "REVERSED", reverseTime }
 *   status  : holat                                -> 200 { status, transTime, confirmTime, reverseTime }
 *
 * Auth: Basic base64(login:password). Vaqtlar ms, summa tiyin, transId UUID. Xato: HTTP 400,
 * { status: "FAILED", errorCode: "100xx" }. Hisob maydoni params.account = "PAY-1042"
 * (Uzum xizmatni sozlaganda shu nom kelishiladi). Yaratilib 30 daqiqada tasdiqlanmagan
 * tranzaksiya muvaffaqiyatsiz hisoblanadi.
 */
import { timingSafeEqual } from 'node:crypto';
import type { PaymentStore, TxnRow } from './store';

export const UZUM_TIMEOUT_MS = 30 * 60_000;
export type UzumMethod = 'check' | 'create' | 'confirm' | 'reverse' | 'status';
export type UzumReply = { http: 200 | 400; body: Record<string, unknown> };

export function uzumAuthOk(header: string | undefined, login: string, password: string): boolean {
  const want = Buffer.from(`Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`);
  const got = Buffer.from(header ?? '');
  return got.length === want.length && timingSafeEqual(got, want);
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const ms = (d: Date | null) => (d ? d.getTime() : null);
/** Uzum holati bizning state dan. */
const statusOf = (t: TxnRow) => (t.state === 2 ? 'CONFIRMED' : t.state < 0 ? 'REVERSED' : 'CREATED');

export class Uzum {
  constructor(
    private readonly store: PaymentStore,
    private readonly cfg: { serviceId: string; login: string; password: string },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(method: UzumMethod, body: unknown, authHeader: string | undefined): Promise<UzumReply> {
    const b = (body && typeof body === 'object' ? body : null) as Record<string, unknown> | null;
    const serviceId = b ? Number(str(b.serviceId)) || null : null;
    const fail = (errorCode: string, extra: Record<string, unknown> = {}): UzumReply =>
      ({ http: 400, body: { serviceId, timestamp: this.now().getTime(), status: 'FAILED', errorCode, ...extra } });
    if (!uzumAuthOk(authHeader, this.cfg.login, this.cfg.password)) return fail('10001');
    if (!b) return fail('10002');
    if (!str(b.serviceId) || !b.timestamp) return fail('10005');
    if (str(b.serviceId) !== this.cfg.serviceId) return fail('10006');
    switch (method) {
      case 'check': return this.check(b, fail);
      case 'create': return this.create(b, fail);
      case 'confirm': return this.confirm(b, fail);
      case 'reverse': return this.reverse(b, fail);
      case 'status': return this.status(b, fail);
    }
  }

  private accountOf(b: Record<string, unknown>) {
    const p = (b.params && typeof b.params === 'object' ? b.params : {}) as Record<string, unknown>;
    return str(p.account ?? p.order_id ?? p.orderId);
  }

  /** Buyurtma bor va to'lanadi: aks holda Uzum xato kodi. */
  private async payable(b: Record<string, unknown>) {
    const no = this.accountOf(b);
    if (!no) return { err: '10005' } as const;
    const order = await this.store.orderByNo(no);
    if (!order) return { err: '10007' } as const;
    if (order.status === 'ACTIVE') return { err: '10008' } as const;
    if (order.status !== 'PENDING') return { err: '10009' } as const;
    return { order } as const;
  }

  private data(no: string) {
    return { account: { value: no } };
  }

  private async check(b: Record<string, unknown>, fail: (c: string, e?: Record<string, unknown>) => UzumReply): Promise<UzumReply> {
    const r = await this.payable(b);
    if ('err' in r) return fail(r.err!);
    return { http: 200, body: { serviceId: Number(this.cfg.serviceId), timestamp: this.now().getTime(), status: 'OK', data: this.data(r.order.no) } };
  }

  private async create(b: Record<string, unknown>, fail: (c: string, e?: Record<string, unknown>) => UzumReply): Promise<UzumReply> {
    const transId = str(b.transId);
    if (!transId || b.amount == null) return fail('10005');
    // Takror transId: spetsifikatsiya bo'yicha 10010, asl vaqt bilan
    const dup = await this.store.txn('uzum', transId);
    if (dup) return fail('10010', { transId, transTime: ms(dup.createdAt) });
    const r = await this.payable(b);
    if ('err' in r) return fail(r.err!, { transId });
    if (BigInt(Math.round(Number(b.amount))) !== r.order.amountTiyin) return fail('10011', { transId });
    // Shu buyurtmaga boshqa ochiq to'lov: eskirgan bo'lsa yopiladi, aks holda rad
    const open = await this.store.openTxn(r.order.id);
    if (open) {
      if (!this.expired(open)) return fail('10008', { transId });
      await this.store.updateTxn(open.id, { state: -1, reason: 4, cancelledAt: this.now() });
    }
    const t = await this.store.createTxn({ provider: 'uzum', extId: transId, subscriptionId: r.order.id, amountTiyin: r.order.amountTiyin });
    return { http: 200, body: { serviceId: Number(this.cfg.serviceId), transId, status: 'CREATED', transTime: ms(t.createdAt), amount: Number(t.amountTiyin), data: this.data(r.order.no) } };
  }

  private async confirm(b: Record<string, unknown>, fail: (c: string, e?: Record<string, unknown>) => UzumReply): Promise<UzumReply> {
    const transId = str(b.transId);
    if (!transId) return fail('10005');
    const t = await this.store.txn('uzum', transId);
    if (!t) return fail('10014', { transId });
    if (t.state === 2) return fail('10016', { transId, confirmTime: ms(t.performedAt) });
    if (t.state < 0) return fail('10015', { transId });
    const now = this.now();
    if (this.expired(t)) {
      await this.store.updateTxn(t.id, { state: -1, reason: 4, cancelledAt: now });
      return fail('10015', { transId });
    }
    if (!(await this.store.activate(t.subscriptionId, 'uzum', now))) {
      await this.store.updateTxn(t.id, { state: -1, cancelledAt: now });
      return fail('10015', { transId });
    }
    const u = await this.store.updateTxn(t.id, { state: 2, performedAt: now });
    const order = await this.store.orderById(t.subscriptionId);
    return { http: 200, body: { serviceId: Number(this.cfg.serviceId), transId, status: 'CONFIRMED', confirmTime: ms(u.performedAt), amount: Number(u.amountTiyin), data: this.data(order?.no ?? '') } };
  }

  private async reverse(b: Record<string, unknown>, fail: (c: string, e?: Record<string, unknown>) => UzumReply): Promise<UzumReply> {
    const transId = str(b.transId);
    if (!transId) return fail('10005');
    const t = await this.store.txn('uzum', transId);
    if (!t) return fail('10014', { transId });
    if (t.state < 0) return fail('10018', { transId, reverseTime: ms(t.cancelledAt) });
    // To'langanini bekor qilish = pul qaytdi: obuna ham yopiladi
    if (t.state === 2) await this.store.refund(t.subscriptionId, 'uzum');
    const u = await this.store.updateTxn(t.id, { state: t.state === 2 ? -2 : -1, cancelledAt: this.now() });
    const order = await this.store.orderById(t.subscriptionId);
    return { http: 200, body: { serviceId: Number(this.cfg.serviceId), transId, status: 'REVERSED', reverseTime: ms(u.cancelledAt), amount: Number(u.amountTiyin), data: this.data(order?.no ?? '') } };
  }

  private async status(b: Record<string, unknown>, fail: (c: string, e?: Record<string, unknown>) => UzumReply): Promise<UzumReply> {
    const transId = str(b.transId);
    if (!transId) return fail('10005');
    let t = await this.store.txn('uzum', transId);
    if (!t) return fail('10014', { transId });
    // Eskirgan ochiq tranzaksiya: holat so'ralganda yopiladi
    if (t.state === 1 && this.expired(t)) t = await this.store.updateTxn(t.id, { state: -1, reason: 4, cancelledAt: this.now() });
    const order = await this.store.orderById(t.subscriptionId);
    return {
      http: 200,
      body: {
        serviceId: Number(this.cfg.serviceId), transId, status: statusOf(t), transTime: ms(t.createdAt),
        confirmTime: ms(t.performedAt), reverseTime: ms(t.cancelledAt), amount: Number(t.amountTiyin), data: this.data(order?.no ?? ''),
      },
    };
  }

  private expired(t: TxnRow) {
    return this.now().getTime() - t.createdAt.getTime() > UZUM_TIMEOUT_MS;
  }
}
