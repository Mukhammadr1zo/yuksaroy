import { describe, expect, it } from 'vitest';
import { SubscriptionService } from './subscription.service';

/**
 * Ikki tarif: telefon raqami va vagon qidiruvi alohida narxlanadi.
 *
 * Eng muhim qoida shu yerda: MUDDAT FAQAT BIR XIL TURDAGI OBUNADAN DAVOM ETADI.
 * Ilgari confirm() har qanday faol qatordan davom etardi va kirish startsAt ga emas,
 * endsAt ga qaraydi. Ya'ni 12 oylik telefon obunasi ustidan 1 oylik vagon tarifini
 * olgan odam bir oylik pulga 12 oyga yaqin vagon kirishini olardi.
 */
type Row = {
  id: string; no: string; userId: string; months: number; grants: string[];
  amountTiyin: bigint; status: string; provider: string | null;
  startsAt: Date | null; endsAt: Date | null; paidAt: Date | null; createdAt: Date;
};

const row = (p: Partial<Row> = {}): Row => ({
  id: 's1', no: 'PAY-1', userId: 'u1', months: 1, grants: ['WAGON'],
  amountTiyin: 9_900_000n, status: 'PENDING', provider: 'manual',
  startsAt: null, endsAt: null, paidAt: null, createdAt: new Date('2026-09-01T00:00:00Z'),
  ...p,
});

function setup(opts: { pending?: Row; activeRows?: Row[]; phoneSom?: number; wagonSom?: number } = {}) {
  const created: Record<string, unknown>[] = [];
  const updates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const activeWheres: Record<string, unknown>[] = [];
  const listingUpdates: unknown[] = [];

  const matches = (r: Row, w: Record<string, any>) => {
    if (w.status && r.status !== w.status) return false;
    if (w.grants?.has && !r.grants.includes(w.grants.has)) return false;
    if (w.grants?.hasSome && !w.grants.hasSome.some((g: string) => r.grants.includes(g))) return false;
    if (w.grants?.hasEvery && !w.grants.hasEvery.every((g: string) => r.grants.includes(g))) return false;
    return true;
  };
  const tx = {
    subscription: {
      findUnique: async () => opts.pending ?? null,
      findFirst: async (a: { where: Record<string, unknown> }) => {
        activeWheres.push(a.where);
        return (opts.activeRows ?? []).find((r) => matches(r, a.where)) ?? null;
      },
      create: async (a: { data: Record<string, unknown> }) => { created.push(a.data); return row(a.data as Partial<Row>); },
      updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => { updates.push(a); return { count: 1 }; },
    },
    membership: { findMany: async () => [] },
    listing: { updateMany: async (a: unknown) => { listingUpdates.push(a); return { count: 0 }; } },
    $queryRaw: async () => [{ nextval: 7n }],
  };
  // Uch tarif: to'liq obuna (sukut), faqat telefon, faqat vagon. Narx tarifda, sozlamada emas
  const phoneSom = opts.phoneSom ?? 99_000;
  const plans = [
    { id: 'p0', code: 'obuna', priceMonthSom: phoneSom, grants: ['PHONE', 'WAGON'], limits: { phoneRevealDaily: 50 }, maxMonths: 12, sort: 0, active: true },
    { id: 'p1', code: 'telefon', priceMonthSom: phoneSom, grants: ['PHONE'], limits: { phoneRevealDaily: 50 }, maxMonths: 12, sort: 1, active: true },
    { id: 'p2', code: 'vagon', priceMonthSom: opts.wagonSom ?? 49_000, grants: ['WAGON'], limits: null, maxMonths: 12, sort: 2, active: true },
  ];
  const prisma = { ...tx, plan: { findMany: async () => plans }, $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx) } as never;
  const config = { get: async () => ({ payDetails: '', wagonSearchFree: 1 }) } as never;
  const svc = new SubscriptionService(prisma, config, { queued: async () => {} } as never, { recipients: async () => [], push: async () => {} } as never);
  return { svc, created, updates, activeWheres, listingUpdates };
}

describe('ikki tarif: telefon va vagon', () => {
  it('vagon buyurtmasi vagon narxidan hisoblanadi', async () => {
    const f = setup({ phoneSom: 99_000, wagonSom: 49_000 });
    await f.svc.order('u1', 2, 'WAGON');
    expect(f.created[0]!.grants).toEqual(['WAGON']);
    // 2 oy * 49 000 so'm, tiyinda
    expect(f.created[0]!.amountTiyin).toBe(BigInt(2 * 49_000 * 100));
  });

  it("tur berilmasa SUKUT tarif: ikkala ruxsat, to'liq obuna narxida", async () => {
    // Ekranda hali bitta karta bor va u turni yubormaydi. Sukut faqat telefon bo'lsa,
    // obuna sotib olgan yangi odamga vagon qidiruvi ochilmay qolardi.
    const f = setup({ phoneSom: 99_000, wagonSom: 49_000 });
    await f.svc.order('u1', 1);
    expect(f.created[0]!.grants).toEqual(['PHONE', 'WAGON']);
    expect(f.created[0]!.amountTiyin).toBe(BigInt(99_000 * 100));
    expect(f.created[0]!.planId).toBe('p0');
  });

  it('telefon tarifi ataylab tanlansa faqat telefonni ochadi', async () => {
    const f = setup({ phoneSom: 99_000 });
    await f.svc.order('u1', 1, 'PHONE');
    expect(f.created[0]!.grants).toEqual(['PHONE']);
  });

  it("ochiq buyurtma tur bo'yicha ajratiladi", async () => {
    const f = setup();
    await f.svc.order('u1', 1, 'WAGON');
    // Ochiq buyurtmani qidirishda ham tur sharti bo'lishi kerak, aks holda telefon
    // buyurtmasi vagon tarifini so'ragan odamga qaytarilardi
    expect((f.activeWheres[0] as { grants?: unknown }).grants).toEqual({ hasEvery: ['WAGON'] });
  });

  it('vagon tarifi telefon obunasining muddatidan davom ETMAYDI', async () => {
    const phone = row({ id: 'p1', grants: ['PHONE'], status: 'ACTIVE', endsAt: new Date('2027-09-01T00:00:00Z') });
    const f = setup({ pending: row({ grants: ['WAGON'] }), activeRows: [phone] });
    const now = new Date('2026-09-01T00:00:00Z');
    await f.svc.confirm('s1', now);
    const data = f.updates[0]!.data;
    // Boshlanish hozirdan: telefon obunasining tugash sanasidan emas
    expect(data.startsAt).toEqual(now);
    // Tugash bir oydan keyin, 2027 dan emas
    expect((data.endsAt as Date).getFullYear()).toBe(2026);
  });

  it('bir xil turdagi obuna muddatidan davom etadi', async () => {
    const wagonActive = row({ id: 'w1', grants: ['WAGON'], status: 'ACTIVE', endsAt: new Date('2026-12-01T00:00:00Z') });
    const f = setup({ pending: row({ grants: ['WAGON'] }), activeRows: [wagonActive] });
    await f.svc.confirm('s1', new Date('2026-09-01T00:00:00Z'));
    expect(f.updates[0]!.data.startsAt).toEqual(wagonActive.endsAt);
  });

  it("to'liq tarif vagon obunasining muddatidan davom ETMAYDI", async () => {
    // Vagon qatori faqat bitta ruxsatni qoplaydi: undan davom etilsa telefon bugundan
    // 12 oyga ochilardi, ya'ni bir oylik pulga 12 oy telefon
    const wagon = row({ id: 'w1', grants: ['WAGON'], status: 'ACTIVE', endsAt: new Date('2027-08-01T00:00:00Z') });
    const f = setup({ pending: row({ grants: ['PHONE', 'WAGON'] }), activeRows: [wagon] });
    const now = new Date('2026-09-01T00:00:00Z');
    await f.svc.confirm('s1', now);
    expect(f.updates[0]!.data.startsAt).toEqual(now);
    expect((f.updates[0]!.data.endsAt as Date).getFullYear()).toBe(2026);
  });

  it('eski obuna ikkalasini ham ochadi, shuning uchun undan davom etadi', async () => {
    // Migratsiya eski qatorlarga ikkala ruxsatni yozgan
    const both = row({ id: 'b1', grants: ['PHONE', 'WAGON'], status: 'ACTIVE', endsAt: new Date('2026-12-01T00:00:00Z') });
    const f = setup({ pending: row({ grants: ['WAGON'] }), activeRows: [both] });
    await f.svc.confirm('s1', new Date('2026-09-01T00:00:00Z'));
    expect(f.updates[0]!.data.startsAt).toEqual(both.endsAt);
  });

  it("vagon tarifi e'lonlarni ko'tarmaydi", async () => {
    const f = setup({ pending: row({ grants: ['WAGON'] }) });
    await f.svc.confirm('s1', new Date('2026-09-01T00:00:00Z'));
    // E'lonni ko'tarish telefon obunasining imtiyozi: arzon tarif uni bepul bermasin
    expect(f.listingUpdates).toHaveLength(0);
  });

  it("telefon tarifi e'lonlarni ko'taradi", async () => {
    const f = setup({ pending: row({ grants: ['PHONE'] }) });
    await f.svc.confirm('s1', new Date('2026-09-01T00:00:00Z'));
    expect(f.listingUpdates).toHaveLength(1);
  });

  it("isActive tur bo'yicha so'raydi", async () => {
    const f = setup({ activeRows: [row({ grants: ['PHONE'], status: 'ACTIVE' })] });
    expect(await f.svc.isActive('u1', 'PHONE')).toBe(true);
    expect(await f.svc.isActive('u1', 'WAGON')).toBe(false);
    // Tursiz so'rov har qanday faol qatorni topadi
    expect(await f.svc.isActive('u1')).toBe(true);
  });
});
