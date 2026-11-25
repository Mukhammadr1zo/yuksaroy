// Superadmin xabari uchun audit qamrovi: chat, baho, buyurtma hodisasi, slot yopish, kuzatuv, yordamchi savoli.
// Har birida audit meta aynan katalogdagi kalitlar bilan, matn va qiymatlar esa yo'q. Soxta xizmatlar, baza yo'q.
import { describe, expect, it } from 'vitest';
import { ChatController, TerminalInquiryController } from './chat/chat.controller';
import { ListingReviewsController } from './chat/listing-reviews.controller';
import { OrdersController } from './orders/presentation/orders.controller';
import { SlotsController } from './booking/presentation/slots.controller';
import { WatchController } from './watch/watch.controller';
import { HelpController } from './help/help.controller';

function auditSink() {
  const rows: Record<string, any>[] = [];
  return { rows, audit: { log: async (e: Record<string, unknown>) => { rows.push(e); } } as never };
}

describe('chat.message', () => {
  it("meta: uzunlik, fayl soni, obyekt; matn va yordamchi maydonlar javobga/auditga o'tmaydi", async () => {
    const { rows, audit } = auditSink();
    const chat = { send: async () => ({ id: 'm1', text: 'MAXFIY MATN', attachments: [{ k: 1 }, { k: 2 }], mine: true, terminalId: 't1', listingId: null }) };
    const out = await new ChatController(chat as never, audit).send('u1', 'i1', { text: ' MAXFIY MATN ', attachments: [{}, {}] });
    expect(rows[0]).toMatchObject({ actorId: 'u1', action: 'chat.message', entity: 'Inquiry', entityId: 'i1', meta: { len: 11, files: 2, terminalId: 't1' } });
    expect(JSON.stringify(rows)).not.toContain('MAXFIY');
    expect(out).not.toHaveProperty('terminalId');
    expect(out).not.toHaveProperty('listingId');
    expect(out).toMatchObject({ id: 'm1', mine: true });
  });

  it("inquiry.create: terminalId qo'shildi", async () => {
    const { rows, audit } = auditSink();
    const chat = { startTerminal: async () => ({ id: 'i1', terminalId: 't9' }) };
    await new TerminalInquiryController(chat as never, audit).start('u1', 'slug-1', { message: 'Salom, narx?' } as never);
    expect(rows[0]).toMatchObject({ action: 'inquiry.create', meta: { terminal: 'slug-1', terminalId: 't9' } });
  });
});

describe("e'lon sharhi", () => {
  it('baho: listingId va rating, matn yo\'q', async () => {
    const { rows, audit } = auditSink();
    const svc = { create: async () => ({ id: 'r1', rating: 4, text: 'SHARH MATNI', createdAt: new Date() }) };
    await new ListingReviewsController(svc as never, audit).create('u1', 'L1', { rating: 4, text: 'SHARH MATNI' });
    expect(rows[0]).toMatchObject({ action: 'listing.review.create', entityId: 'r1', meta: { listingId: 'L1', rating: 4 } });
    expect(JSON.stringify(rows)).not.toContain('SHARH');
  });

  it('javob: listingId auditda, mijozga qaytgan javobda yo\'q', async () => {
    const { rows, audit } = auditSink();
    const svc = { reply: async () => ({ id: 'r1', reply: 'JAVOB', repliedAt: new Date(), listingId: 'L1' }) };
    const out = await new ListingReviewsController(svc as never, audit).reply('u1', 'r1', { reply: 'JAVOB' });
    expect(rows[0]).toMatchObject({ action: 'listing.review.reply', meta: { listingId: 'L1' } });
    expect(JSON.stringify(rows)).not.toContain('JAVOB');
    expect(out).not.toHaveProperty('listingId');
  });
});

describe('order.event', () => {
  it('meta: raqam va kod; payload yo\'q', async () => {
    const { rows, audit } = auditSink();
    const actions = { addEvent: async () => ({ id: 'o1', no: 'B-1', events: [], status: 'CONFIRMED' }) };
    const ctl = new OrdersController({} as never, actions as never, {} as never, {} as never, audit);
    await ctl.event('u1', 'B-1', { code: 'ARRIVED', payload: { note: 'YASHIRIN' } } as never).catch(() => {});
    expect(rows[0]).toMatchObject({ action: 'order.event', entityId: 'o1', meta: { no: 'B-1', code: 'ARRIVED' } });
    expect(JSON.stringify(rows)).not.toContain('YASHIRIN');
  });
});

describe('slots.close', () => {
  const slots = (closed: boolean) => ({ setSlotClosed: async () => ({ id: 's1', localDate: '2026-12-01', status: closed ? 'CLOSED' : 'OPEN' }) });
  it('yopish: terminal va sana yoziladi', async () => {
    const { rows, audit } = auditSink();
    await new SlotsController(slots(true) as never, {} as never, audit).close('u1', 't1', 's1', { closed: true });
    expect(rows[0]).toMatchObject({ action: 'slots.close', entityId: 't1', meta: { terminalId: 't1', date: '2026-12-01' } });
  });
  it("qayta ochish xabar qilinmaydi", async () => {
    const { rows, audit } = auditSink();
    await new SlotsController(slots(false) as never, {} as never, audit).close('u1', 't1', 's1', { closed: false });
    expect(rows).toHaveLength(0);
  });
});

describe('watch.create / watch.delete', () => {
  it("yangi kuzatuv yozildi; takroriy bosish (createdAt yo'q) yozilmaydi; o'chirish kind bilan", async () => {
    const { rows, audit } = auditSink();
    let fresh = true;
    const prisma = {
      watch: {
        findMany: async () => (fresh ? [] : [{ id: 'w1', userId: 'u7', kind: 'LISTING', params: {} }]),
        create: async () => ({ id: 'w1', kind: 'LISTING', params: {}, createdAt: new Date() }),
        findFirst: async () => ({ kind: 'LISTING' }),
        deleteMany: async () => ({ count: 1 }),
      },
    };
    const ctl = new WatchController(prisma as never, audit);
    await ctl.add('u7', { kind: 'LISTING' } as never);
    expect(rows.map((r) => r.action)).toEqual(['watch.create']);
    expect(rows[0]).toMatchObject({ actorId: 'u7', meta: { kind: 'LISTING' } });
    fresh = false;
    await ctl.add('u7', { kind: 'LISTING' } as never);
    expect(rows).toHaveLength(1);
    await ctl.remove('u7', 'w1');
    expect(rows[1]).toMatchObject({ action: 'watch.delete', meta: { kind: 'LISTING' } });
  });
});

describe('help.ask', () => {
  it("savol 120 belgiga qisqartiriladi, mehmon ham yoziladi, lug'at javobi faq true", async () => {
    const records: Record<string, any>[] = [];
    const ctl = new HelpController({ verifyAccess: () => { throw new Error('token yo\'q'); } } as never, {} as never, { enabled: false } as never, { record: (e: Record<string, unknown>) => { records.push(e); } } as never);
    const q = 'Obuna narxi qancha? '.repeat(20).trim().slice(0, 400);
    await ctl.ask({ q, locale: 'uz' } as never, { headers: {}, cookies: {} } as never, '10.99.0.1');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ action: 'help.ask', actorId: null });
    expect(records[0].meta.q.length).toBeLessThanOrEqual(120);
    expect(typeof records[0].meta.faq).toBe('boolean');
  });
});
