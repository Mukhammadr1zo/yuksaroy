import { describe, expect, it } from 'vitest';
import { Click, clickSign } from './click';
import { PAYME_TIMEOUT_MS, Payme } from './payme';
import type { OrderRow, PaymentStore, Provider, TxnRow } from './store';
import { Uzum } from './uzum';

/** Xotiradagi do'kon: buyurtmalar va tranzaksiyalar, faollashtirish va qaytarish qayd etiladi. */
function fakeStore(orders: OrderRow[]) {
  const txns: TxnRow[] = [];
  const activated: string[] = [];
  const refunded: string[] = [];
  let seq = 0;
  const store: PaymentStore = {
    orderByNo: async (no) => orders.find((o) => o.no === no) ?? null,
    orderById: async (id) => orders.find((o) => o.id === id) ?? null,
    txn: async (provider, extId) => txns.find((t) => t.provider === provider && t.extId === extId) ?? null,
    openTxn: async (sid) => txns.filter((t) => t.subscriptionId === sid && t.state === 1).at(-1) ?? null,
    createTxn: async (d) => {
      const t: TxnRow = { id: `t${++seq}`, provider: d.provider, extId: d.extId, subscriptionId: d.subscriptionId, amountTiyin: d.amountTiyin, state: 1, reason: null, providerTime: d.providerTime ?? null, createdAt: new Date(), performedAt: null, cancelledAt: null };
      txns.push(t);
      return t;
    },
    updateTxn: async (id, d) => Object.assign(txns.find((t) => t.id === id)!, d),
    txnsBetween: async (provider: Provider, from, to) =>
      txns.filter((t) => t.provider === provider && t.providerTime !== null && t.providerTime >= from && t.providerTime <= to)
        .map((t) => ({ ...t, orderNo: orders.find((o) => o.id === t.subscriptionId)!.no })),
    activate: async (sid) => {
      const o = orders.find((x) => x.id === sid)!;
      if (o.status !== 'PENDING') return false;
      o.status = 'ACTIVE'; activated.push(sid);
      return true;
    },
    refund: async (sid) => { orders.find((x) => x.id === sid)!.status = 'CANCELLED'; refunded.push(sid); },
  };
  return { store, txns, activated, refunded };
}

const KEY = 'test-key-123';
const AUTH = `Basic ${Buffer.from(`Paycom:${KEY}`).toString('base64')}`;
const order = (): OrderRow => ({ id: 's1', no: 'PAY-1042', status: 'PENDING', amountTiyin: 9_900_000n });

describe('Payme', () => {
  const T0 = new Date('2026-11-28T10:00:00Z');
  const setup = (now = T0) => {
    const f = fakeStore([order()]);
    let clock = now;
    const pm = new Payme(f.store, () => clock);
    const rpc = (method: string, params: Record<string, unknown>, auth = AUTH) => pm.handle({ id: 7, method, params }, auth, KEY);
    return { ...f, rpc, tick: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
  };
  const acct = { order_id: 'PAY-1042' };

  it("kalit noto'g'ri bo'lsa -32504", async () => {
    const { rpc } = setup();
    expect(await rpc('CheckPerformTransaction', { amount: 9_900_000, account: acct }, 'Basic xxx')).toMatchObject({ id: 7, error: { code: -32504 } });
  });

  it('tekshiruv: buyurtma, summa, holat', async () => {
    const { rpc } = setup();
    expect(await rpc('CheckPerformTransaction', { amount: 9_900_000, account: acct })).toEqual({ jsonrpc: '2.0', id: 7, result: { allow: true } });
    expect(await rpc('CheckPerformTransaction', { amount: 100, account: acct })).toMatchObject({ error: { code: -31001 } });
    expect(await rpc('CheckPerformTransaction', { amount: 9_900_000, account: { order_id: 'PAY-9' } })).toMatchObject({ error: { code: -31050, data: 'order_id' } });
    expect(await rpc('Nomalum', {})).toMatchObject({ error: { code: -32601 } });
  });

  it("to'liq yo'l: yaratish (takror ham), bajarish obunani yoqadi, tekshirish, ro'yxat", async () => {
    const { rpc, activated } = setup();
    const time = T0.getTime();
    const c1 = await rpc('CreateTransaction', { id: 'pm-1', time, amount: 9_900_000, account: acct });
    expect(c1).toMatchObject({ result: { create_time: time, state: 1 } });
    // Takror so'rov o'sha javobni oladi
    expect(await rpc('CreateTransaction', { id: 'pm-1', time, amount: 9_900_000, account: acct })).toEqual(c1);
    // Boshqa tranzaksiya shu buyurtmaga: band
    expect(await rpc('CreateTransaction', { id: 'pm-2', time, amount: 9_900_000, account: acct })).toMatchObject({ error: { code: -31052 } });
    const p = await rpc('PerformTransaction', { id: 'pm-1' });
    expect(p).toMatchObject({ result: { state: 2 } });
    expect(activated).toEqual(['s1']);
    // Takror bajarish: o'sha natija, obuna ikkinchi marta yoqilmaydi
    expect(await rpc('PerformTransaction', { id: 'pm-1' })).toEqual(p);
    expect(activated).toHaveLength(1);
    expect(await rpc('CheckTransaction', { id: 'pm-1' })).toMatchObject({ result: { state: 2, reason: null, cancel_time: 0 } });
    const st = await rpc('GetStatement', { from: time - 1, to: time + 1 }) as { result: { transactions: unknown[] } };
    expect(st.result.transactions).toEqual([expect.objectContaining({ id: 'pm-1', account: { order_id: 'PAY-1042' }, state: 2 })]);
    // To'langan buyurtmaga yangi tekshiruv: yopiq
    expect(await rpc('CheckPerformTransaction', { amount: 9_900_000, account: acct })).toMatchObject({ error: { code: -31051 } });
  });

  it("12 soatdan keyin bajarib bo'lmaydi: sabab 4 bilan bekor", async () => {
    const { rpc, tick, activated } = setup();
    await rpc('CreateTransaction', { id: 'pm-3', time: T0.getTime(), amount: 9_900_000, account: acct });
    tick(PAYME_TIMEOUT_MS + 1);
    expect(await rpc('PerformTransaction', { id: 'pm-3' })).toMatchObject({ error: { code: -31008 } });
    expect(await rpc('CheckTransaction', { id: 'pm-3' })).toMatchObject({ result: { state: -1, reason: 4 } });
    expect(activated).toHaveLength(0);
    // Eski tranzaksiya muddati o'tgan: yangisi yaratiladi
    expect(await rpc('CreateTransaction', { id: 'pm-4', time: T0.getTime() + PAYME_TIMEOUT_MS + 2, amount: 9_900_000, account: acct })).toMatchObject({ result: { state: 1 } });
  });

  it("bekor: to'lovgacha -1, to'lovdan keyin -2 va obuna yopiladi", async () => {
    const { rpc, refunded } = setup();
    await rpc('CreateTransaction', { id: 'pm-5', time: T0.getTime(), amount: 9_900_000, account: acct });
    expect(await rpc('CancelTransaction', { id: 'pm-5', reason: 3 })).toMatchObject({ result: { state: -1 } });
    expect(refunded).toHaveLength(0);
    await rpc('CreateTransaction', { id: 'pm-6', time: T0.getTime() + 1, amount: 9_900_000, account: acct });
    await rpc('PerformTransaction', { id: 'pm-6' });
    expect(await rpc('CancelTransaction', { id: 'pm-6', reason: 5 })).toMatchObject({ result: { state: -2 } });
    expect(refunded).toEqual(['s1']);
    // Takror bekor: o'sha javob
    expect(await rpc('CancelTransaction', { id: 'pm-6', reason: 5 })).toMatchObject({ result: { state: -2 } });
    expect(await rpc('CheckTransaction', { id: 'pm-x' })).toMatchObject({ error: { code: -31003 } });
  });
});

describe('Click', () => {
  const SECRET = 'click-secret';
  const cfg = { serviceId: '111', secret: SECRET };
  const signed = (b: Record<string, string>, withPrepare: boolean) => ({ ...b, sign_string: clickSign(b, SECRET, withPrepare) });
  const base = { click_trans_id: '555', service_id: '111', click_paydoc_id: '9', merchant_trans_id: 'PAY-1042', amount: '99000.00', error: '0', error_note: 'Success', sign_time: '2026-11-28 15:00:00' };

  it("prepare va complete: obuna yoqiladi, takror complete 'allaqachon to'langan'", async () => {
    const f = fakeStore([order()]);
    const c = new Click(f.store, cfg);
    const p = await c.prepare(signed({ ...base, action: '0' }, false));
    expect(p).toMatchObject({ error: 0, merchant_prepare_id: 1042 });
    const done = await c.complete(signed({ ...base, action: '1', merchant_prepare_id: '1042' }, true));
    expect(done).toMatchObject({ error: 0, merchant_confirm_id: 1042 });
    expect(f.activated).toEqual(['s1']);
    expect(await c.complete(signed({ ...base, action: '1', merchant_prepare_id: '1042' }, true))).toMatchObject({ error: -4 });
    expect(f.activated).toHaveLength(1);
  });

  it("imzo, summa, buyurtma va amal tekshiriladi", async () => {
    const f = fakeStore([order()]);
    const c = new Click(f.store, cfg);
    expect(await c.prepare({ ...base, action: '0', sign_string: 'bad' })).toMatchObject({ error: -1 });
    expect(await c.prepare(signed({ ...base, action: '0', amount: '1000' }, false))).toMatchObject({ error: -2 });
    expect(await c.prepare(signed({ ...base, action: '0', merchant_trans_id: 'PAY-1' }, false))).toMatchObject({ error: -5 });
    expect(await c.prepare(signed({ ...base, action: '1' }, false))).toMatchObject({ error: -3 });
    expect(await c.complete(signed({ ...base, action: '1', merchant_prepare_id: '1042', click_trans_id: '999' }, true))).toMatchObject({ error: -6 });
    expect(f.activated).toHaveLength(0);
  });

  it("Click xato yuborsa tranzaksiya bekor, obuna kutishda qoladi", async () => {
    const f = fakeStore([order()]);
    const c = new Click(f.store, cfg);
    await c.prepare(signed({ ...base, action: '0' }, false));
    expect(await c.complete(signed({ ...base, action: '1', merchant_prepare_id: '1042', error: '-5017' }, true))).toMatchObject({ error: -9 });
    expect(f.activated).toHaveLength(0);
    expect(f.txns[0]!.state).toBe(-1);
  });
});

describe('Uzum Bank', () => {
  const cfg = { serviceId: '101202', login: 'ys', password: 'secret-pass' };
  const AUTHU = `Basic ${Buffer.from('ys:secret-pass').toString('base64')}`;
  const setup = () => {
    const f = fakeStore([order()]);
    let clock = new Date('2026-11-28T10:00:00Z');
    const uz = new Uzum(f.store, cfg, () => clock);
    const call = (m: 'check' | 'create' | 'confirm' | 'reverse' | 'status', b: Record<string, unknown>, auth = AUTHU) =>
      uz.handle(m, { serviceId: 101202, timestamp: clock.getTime(), ...b }, auth);
    return { ...f, call, tick: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
  };
  const params = { account: 'PAY-1042' };

  it("auth, xizmat va buyurtma tekshiriladi, xato HTTP 400", async () => {
    const { call } = setup();
    expect(await call('check', { params }, 'Basic nope')).toMatchObject({ http: 400, body: { status: 'FAILED', errorCode: '10001' } });
    expect(await call('check', { params, serviceId: 1 })).toMatchObject({ http: 400, body: { errorCode: '10006' } });
    expect(await call('check', { params: { account: 'PAY-9' } })).toMatchObject({ http: 400, body: { errorCode: '10007' } });
    expect(await call('check', { params })).toMatchObject({ http: 200, body: { status: 'OK', data: { account: { value: 'PAY-1042' } } } });
  });

  it("yaratish, takror 10010, summa 10011, tasdiq obunani yoqadi, takror tasdiq 10016, holat", async () => {
    const { call, activated } = setup();
    expect(await call('create', { transId: 'u-1', params, amount: 100 })).toMatchObject({ http: 400, body: { errorCode: '10011' } });
    expect(await call('create', { transId: 'u-1', params, amount: 9_900_000 })).toMatchObject({ http: 200, body: { status: 'CREATED', amount: 9_900_000 } });
    expect(await call('create', { transId: 'u-1', params, amount: 9_900_000 })).toMatchObject({ http: 400, body: { errorCode: '10010' } });
    expect(await call('confirm', { transId: 'u-1', paymentSource: 'UZCARD', phone: '998901234567' })).toMatchObject({ http: 200, body: { status: 'CONFIRMED' } });
    expect(activated).toEqual(['s1']);
    expect(await call('confirm', { transId: 'u-1', paymentSource: 'UZCARD', phone: '998901234567' })).toMatchObject({ http: 400, body: { errorCode: '10016' } });
    expect(await call('status', { transId: 'u-1' })).toMatchObject({ http: 200, body: { status: 'CONFIRMED' } });
    expect(await call('check', { params })).toMatchObject({ http: 400, body: { errorCode: '10008' } });
  });

  it("30 daqiqadan keyin tasdiq 10015; tasdiqlangani bekor qilinsa obuna yopiladi", async () => {
    const { call, txns, refunded, activated } = setup();
    await call('create', { transId: 'u-2', params, amount: 9_900_000 });
    txns[0]!.createdAt = new Date(Date.parse('2026-11-28T10:00:00Z') - 31 * 60_000);
    expect(await call('confirm', { transId: 'u-2', paymentSource: 'HUMO', phone: '998' })).toMatchObject({ http: 400, body: { errorCode: '10015' } });
    expect(activated).toHaveLength(0);
    await call('create', { transId: 'u-3', params, amount: 9_900_000 });
    await call('confirm', { transId: 'u-3', paymentSource: 'HUMO', phone: '998' });
    expect(await call('reverse', { transId: 'u-3' })).toMatchObject({ http: 200, body: { status: 'REVERSED' } });
    expect(refunded).toEqual(['s1']);
    expect(await call('reverse', { transId: 'u-3' })).toMatchObject({ http: 400, body: { errorCode: '10018' } });
    expect(await call('status', { transId: 'u-x' })).toMatchObject({ http: 400, body: { errorCode: '10014' } });
  });
});
