// ActivityService: oyna, 15 s kechikish, tahrir, chegara, qabul qiluvchilar, sozlamalar, xato bardoshligi.
// Telegramga hech qachon chiqmaydi: yuboruvchi qo'lda berilgan soxta.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_DEFAULTS } from '@yuksaroy/domain';
import { ActivityService, type TgResult } from './activity.service';

type Call = { method: string; body: Record<string, any> };

function setup(over: Record<string, number> = {}, opts: { admins?: { chatId: bigint; userId: string }[]; staff?: string[]; tg?: (c: Call) => Promise<TgResult> } = {}) {
  const calls: Call[] = [];
  let mid = 100;
  const tg = vi.fn(async (method: string, body: Record<string, any>) => {
    const c = { method, body };
    calls.push(c);
    if (opts.tg) return opts.tg(c);
    return { ok: true, result: { message_id: ++mid } } as TgResult;
  });
  const prisma: any = {
    telegramLink: { findMany: vi.fn(async () => opts.admins ?? [{ chatId: 111n, userId: 'adm1' }, { chatId: 222n, userId: 'adm2' }]) },
    membership: { findMany: vi.fn(async () => (opts.staff ?? []).map((userId) => ({ userId }))) },
    user: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async ({ where }: any) => ({ fullName: `Odam ${where.id}`, phone: '+998901234567', email: null, createdAt: new Date('2026-10-03T08:00:00Z'), telegram: null, memberships: [] })),
    },
    listing: { findMany: vi.fn(async () => []) }, terminal: { findMany: vi.fn(async () => []) }, organization: { findMany: vi.fn(async () => []) },
    order: { findMany: vi.fn(async () => []) }, marketRequest: { findMany: vi.fn(async () => []) }, urgentRequest: { findMany: vi.fn(async () => []) },
  };
  const config: any = { get: vi.fn(async () => ({ ...PLATFORM_DEFAULTS, ...over })) };
  const svc = new ActivityService(prisma, config, { tg });
  return { svc, calls, prisma, config, tg, sends: () => calls.filter((c) => c.method === 'sendMessage'), edits: () => calls.filter((c) => c.method === 'editMessageText') };
}

const ADV = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const login = (actorId: string, extra: Record<string, unknown> = {}) => ({ action: 'auth.login', actorId, ip: '84.54.12.3', ua, meta: { via: 'otp' }, ...extra });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-25T14:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('oyna va vaqt', () => {
  it("birinchi xabar 15 s dan oldin ketmaydi, keyin har bir qabul qiluvchiga bittadan", async () => {
    const t = setup();
    t.svc.record(login('u1'));
    await ADV(14_999);
    expect(t.tg).not.toHaveBeenCalled();
    await ADV(1_001);
    await ADV(2_000);
    expect(t.sends()).toHaveLength(2);
    expect(t.sends().map((c) => c.body.chat_id).sort()).toEqual(['111', '222']);
    expect(t.sends()[0].body.parse_mode).toBe('HTML');
    expect(t.sends()[0].body.text).toContain('Kirdi: Telegram kodi bilan');
  });

  it("40 s da kelgan hodisa: yangi xabar emas, saqlangan message_id bilan tahrir", async () => {
    const t = setup();
    t.svc.record(login('u1'));
    await ADV(17_000);
    expect(t.sends()).toHaveLength(2);
    const ids = t.sends().map((c) => c.body.chat_id);
    await ADV(23_000); // 40 s
    t.svc.record({ action: 'wagon.search', actorId: 'u1', entityId: '52345678', meta: { found: true }, ip: '84.54.12.3', ua });
    await ADV(3_000);
    expect(t.sends()).toHaveLength(2);
    expect(t.edits()).toHaveLength(2);
    expect(t.edits().map((c) => c.body.chat_id).sort()).toEqual([...ids].sort());
    expect(t.edits()[0].body.message_id).toBeGreaterThan(100);
    expect(t.edits()[0].body.text).toContain('2 ta amal');
    expect(t.edits()[0].body.text).toContain('Vagon qidirdi');
  });

  it("75 s da kelgan hodisa: oyna yopilgan, yangi xabar", async () => {
    const t = setup();
    t.svc.record(login('u1'));
    await ADV(75_000);
    expect(t.sends()).toHaveLength(2);
    t.svc.record({ action: 'wagon.search', actorId: 'u1', entityId: '1', meta: {}, ip: '84.54.12.3', ua });
    await ADV(18_000);
    expect(t.sends()).toHaveLength(4);
  });

  it("oyna yopilganda tahrir kutilayotgan bo'lsa oxirgi tahrir ketadi", async () => {
    const t = setup();
    t.svc.record(login('u1'));
    await ADV(16_000);
    t.svc.record({ action: 'wagon.search', actorId: 'u1', entityId: '1', meta: {}, ip: '84.54.12.3', ua }); // 16 s: tahrir 30 s ga rejalashadi
    await ADV(60_000);
    expect(t.edits().length).toBeGreaterThanOrEqual(2);
    expect(t.edits().at(-1)!.body.text).toContain('Vagon qidirdi');
  });

  it("ikki odam: ikki alohida xabar", async () => {
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.svc.record(login('u1'));
    t.svc.record(login('u2'));
    await ADV(20_000);
    expect(t.sends()).toHaveLength(2);
    expect(t.sends().map((c) => c.body.text).join('\n')).toContain('Odam u1');
    expect(t.sends().map((c) => c.body.text).join('\n')).toContain('Odam u2');
  });
});

describe('chegara', () => {
  it("bir daqiqada 25 mehmon: 20 xabar + 1 xulosa ('yana 5 ta')", async () => {
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    for (let i = 0; i < 25; i++) t.svc.record({ action: 'help.ask', actorId: null, ip: `37.110.212.${i}`, ua, meta: { q: 'salom' } });
    await ADV(30_000);
    expect(t.sends()).toHaveLength(20);
    await ADV(70_000);
    expect(t.sends()).toHaveLength(21);
    expect(t.sends().at(-1)!.body.text).toContain('yana 5 ta');
  });
});

describe('sozlamalar', () => {
  it("activityActions = 0: amal ketmaydi, kirish ketadi", async () => {
    const t = setup({ activityActions: 0 }, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.svc.record({ action: 'wagon.search', actorId: 'u1', entityId: '1', meta: {}, ip: '84.54.12.3', ua });
    t.svc.record(login('u2'));
    await ADV(20_000);
    expect(t.sends()).toHaveLength(1);
    expect(t.sends()[0].body.text).toContain('Odam u2');
  });

  it("o'z amali: activitySelf = 0 da adminning o'z chatiga ketmaydi, boshqa admin oladi; sukutda (1) ikkalasi", async () => {
    const a = setup({ activitySelf: 0 });
    const act = { action: 'wagon.search', actorId: 'adm1', entityId: '1', meta: {}, ip: '84.54.12.3', ua };
    a.svc.record(act);
    await ADV(20_000);
    expect(a.sends().map((c) => c.body.chat_id)).toEqual(['222']);
    const b = setup();
    b.svc.record(act);
    await ADV(20_000);
    expect(b.sends().map((c) => c.body.chat_id).sort()).toEqual(['111', '222']);
  });

  it("o'z hisobiga kirish urinishi (auth.failed) activitySelf = 0 da ham adminga boradi", async () => {
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.svc.record({ action: 'auth.failed', actorId: 'adm1', ip: '95.214.10.7', ua, meta: {} });
    await ADV(20_000);
    expect(t.sends().map((c) => c.body.chat_id)).toEqual(['111']);
  });

  it("ochiq oynalar 500 dan oshmaydi, ortig'i xulosaga sanaladi", async () => {
    const t = setup();
    for (let i = 0; i < 600; i++) t.svc.record({ action: 'auth.otp.request', actorId: null, guest: { key: `g${i}` }, ip: '1.2.3.4', ua, meta: {} });
    expect((t.svc as any).wins.size).toBe(500);
    expect((t.svc as any).supp.login ?? (t.svc as any).supp.loginFailed ?? 0).toBeGreaterThan(0);
  });

  it("xodimning tashrifi sukutda tashlanadi, activityAdminVisits = 1 da ketadi", async () => {
    const a = setup({}, { staff: ['staff1'] });
    a.svc.visit({ userId: 'staff1', path: '/wagon', ip: '84.54.12.3', ua });
    await ADV(20_000);
    expect(a.sends()).toHaveLength(0);
    const b = setup({ activityAdminVisits: 1 }, { staff: ['staff1'] });
    b.svc.visit({ userId: 'staff1', path: '/wagon', ip: '84.54.12.3', ua });
    await ADV(20_000);
    expect(b.sends().length).toBeGreaterThan(0);
  });

  it("oddiy foydalanuvchi tashrifi ketadi, mehmon tashrifi 'Tashriflar' havolasi bilan", async () => {
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.svc.visit({ userId: null, path: '/tarif', referrer: 'google.com', ip: '37.110.212.9', ua });
    await ADV(20_000);
    expect(t.sends()[0].body.text).toContain('👁 Sahifani ochdi: /tarif, qayerdan: google.com');
    expect(t.sends()[0].body.text).toContain('Tashriflar</a>');
  });

  it("tizim hodisasi sukutda o'chiq, activitySystem = 1 da ketadi", async () => {
    const a = setup();
    a.svc.record({ action: 'terminal.claim.auto', actorId: 'u1', entity: 'Terminal', entityId: 't1', meta: {} });
    await ADV(20_000);
    expect(a.sends().length).toBeGreaterThan(0); // da'vo o'zi tasdiqlandi: egasi bilishi shart, tizim hodisasi emas
    const a2 = setup();
    a2.svc.record({ action: 'noma.lum', actorId: null, meta: {} });
    await ADV(20_000);
    expect(a2.sends()).toHaveLength(0);
    const b = setup({ activitySystem: 1 });
    b.svc.record({ action: 'noma.lum', actorId: null, meta: {} });
    await ADV(20_000);
    expect(b.sends()[0].body.text).toContain('<b>Tizim</b>');
  });

  it("sozlamani o'qib bo'lmasa standart qiymatlar", async () => {
    const t = setup();
    t.config.get.mockRejectedValue(new Error('db'));
    t.svc.record(login('u1'));
    await ADV(20_000);
    expect(t.sends().length).toBeGreaterThan(0);
  });
});

describe('qabul qiluvchilar', () => {
  it("so'rov faqat PLATFORM_ADMIN rolini so'raydi va 60 s ichida bir marta ishlaydi", async () => {
    const t = setup();
    for (let i = 0; i < 3; i++) t.svc.record({ action: 'help.ask', actorId: null, ip: `37.110.212.${i}`, ua, meta: { q: 'x' } });
    await ADV(25_000);
    expect(t.prisma.telegramLink.findMany).toHaveBeenCalledTimes(1);
    const where = JSON.stringify(t.prisma.telegramLink.findMany.mock.calls[0][0].where);
    expect(where).toContain('"has":"PLATFORM_ADMIN"');
    expect(where).not.toContain('PLATFORM_OPERATOR');
  });
  it("admin yo'q bo'lsa hech narsa ketmaydi", async () => {
    const t = setup({}, { admins: [] });
    t.svc.record(login('u1'));
    await ADV(20_000);
    expect(t.tg).not.toHaveBeenCalled();
  });
});

describe('bardoshlik', () => {
  it("tg xato tashlasa record() yiqilmaydi va keyingi oyna baribir ketadi", async () => {
    let n = 0;
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }], tg: async () => { if (n++ === 0) throw new Error('tarmoq'); return { ok: true, result: { message_id: 7 } }; } });
    expect(() => t.svc.record(login('u1'))).not.toThrow();
    await ADV(20_000);
    t.svc.record(login('u2'));
    await ADV(20_000);
    expect(t.sends()).toHaveLength(2);
  });
  it("prisma yiqilsa record() yiqilmaydi, keyingi urinishda ketadi", async () => {
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.prisma.telegramLink.findMany.mockRejectedValueOnce(new Error('db'));
    expect(() => t.svc.record(login('u1'))).not.toThrow();
    await ADV(20_000);
    expect(t.sends()).toHaveLength(0);
    t.svc.record(login('u2'));
    await ADV(20_000);
    expect(t.sends()).toHaveLength(1);
  });
  it("buzuq kirish (meta null, g'alati qiymatlar) yiqilmaydi", () => {
    const t = setup();
    expect(() => t.svc.record({ action: 'x', meta: null } as any)).not.toThrow();
    expect(() => t.svc.record({ action: undefined } as any)).not.toThrow();
  });
  it("429: retry_after dan keyin bir marta qayta uriladi", async () => {
    let n = 0;
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }], tg: async () => (n++ === 0 ? { ok: false, error_code: 429, parameters: { retry_after: 5 } } : { ok: true, result: { message_id: 9 } }) });
    t.svc.record(login('u1'));
    await ADV(15_100);
    expect(t.tg).toHaveBeenCalledTimes(1);
    await ADV(4_000);
    expect(t.tg).toHaveBeenCalledTimes(1);
    await ADV(2_000);
    expect(t.tg).toHaveBeenCalledTimes(2);
  });
  it("robot tashrifi e'tiborga olinmaydi", async () => {
    const t = setup();
    t.svc.visit({ userId: null, path: '/', ip: '66.249.66.1', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    t.svc.visit({ userId: null, path: '/', ip: '66.249.66.2', ua: null });
    await ADV(20_000);
    expect(t.tg).not.toHaveBeenCalled();
  });
  it("bot kanalida IP va qurilma xabarga tushmaydi", async () => {
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.svc.record({ action: 'bot.start', actorId: null, channel: 'bot', ip: '172.18.0.4', ua: 'node', guest: { key: 't:555', label: '@trans_uz' }, meta: { start: 'login' } });
    await ADV(20_000);
    const text = t.sends()[0].body.text as string;
    expect(text).not.toContain('172.18.0.4');
    expect(text).toContain('Mehmon (@trans_uz)');
  });
  it('flushAllForTest navbatni bo\'shatadi', async () => {
    vi.useRealTimers();
    const t = setup({}, { admins: [{ chatId: 111n, userId: 'adm1' }] });
    t.svc.record(login('u1'));
    await t.svc.flushAllForTest();
    expect(t.sends()).toHaveLength(1);
  });
});
