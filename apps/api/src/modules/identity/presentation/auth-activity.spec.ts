// Superadmin xabari uchun kirish hodisalari: xato urinish, kod so'rovi, chiqish, profil, bot ulanishi, isNew.
// Soxta usecase va soxta ActivityService: baza, Telegram va tarmoq yo'q. Parol va kod hech qayerga tushmasligi qotiriladi.
import { describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller';
import { BadCredentialsError, OtpInvalidError } from '../domain/errors';
import { maskPhone } from '../../activity/format';

const PHONE = '+998901234567';
const flush = () => new Promise((r) => setTimeout(r, 0));
let n = 0;
const req = (extra: Record<string, unknown> = {}) => ({ ip: `10.77.${++n >> 8}.${n & 255}`, headers: {}, cookies: {}, ...extra }) as unknown as FastifyRequest;
const res = () => ({ setCookie: vi.fn(), clearCookie: vi.fn() }) as unknown as FastifyReply;

function make(over: { found?: boolean; verify?: unknown; password?: unknown; google?: unknown; tg?: unknown; link?: unknown; otp?: unknown } = {}) {
  const records: Record<string, unknown>[] = [];
  const audits: Record<string, any>[] = [];
  const activity = { record: (e: Record<string, unknown>) => { records.push(e); } };
  const users = {
    findByPhone: async () => (over.found === false ? null : { id: 'u1', phone: PHONE }),
    findById: async () => ({ id: 'u1', phone: PHONE, email: null, googleSub: null }),
    update: async (_id: string, p: Record<string, unknown>) => ({ id: 'u1', phone: PHONE, createdAt: new Date(), personalRoles: [], ...p }),
  };
  const c = new AuthController(
    (over.otp ?? { execute: async () => ({ status: 'SENT', resendAfter: 60 }) }) as never,
    (over.verify ?? { execute: async () => { throw new OtpInvalidError('WRONG'); }, consume: async () => PHONE }) as never,
    (over.google ?? {}) as never,
    (over.tg ?? {}) as never,
    (over.link ?? { execute: async () => ({ linked: true, codeSent: false, isNew: true, userId: 'u9' }) }) as never,
    (over.password ?? { login: async () => { throw new BadCredentialsError(); } }) as never,
    {} as never,
    { verifyAccess: () => ({ sub: 'u1', sid: 's1' }), logout: async () => {} } as never,
    { isPlatformAdmin: async () => false, isPlatformOwner: async () => false } as never,
    { log: async (e: Record<string, unknown>) => { audits.push(e); } } as never,
    users as never,
    activity as never,
  );
  return { c, records, audits };
}

describe('kira olmadi (auth.failed)', () => {
  it("noto'g'ri kod: sabab OTP_WRONG, yashirilgan raqam, odam bazada bo'lsa actorId; kod hech qayerda yo'q", async () => {
    const { c, records } = make();
    await expect(c.otpVerify({ phone: PHONE, code: '123456' } as never, req(), res())).rejects.toMatchObject({ status: 400 });
    await flush();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ action: 'auth.failed', actorId: 'u1', guest: { label: maskPhone(PHONE) }, meta: { via: 'otp', reason: 'OTP_WRONG' } });
    const dump = JSON.stringify(records);
    expect(dump).not.toContain('123456');
    expect(dump).not.toContain(PHONE);
  });

  it("noto'g'ri parol, raqam bazada yo'q: actorId yo'q, parol hech qayerda yo'q", async () => {
    const { c, records } = make({ found: false });
    await expect(c.login({ phone: PHONE, password: 'Maxfiy-Parol-9' } as never, req(), res())).rejects.toMatchObject({ status: 401 });
    await flush();
    expect(records[0]).toMatchObject({ action: 'auth.failed', meta: { via: 'password', reason: 'BAD_CREDENTIALS' } });
    expect((records[0] as { actorId?: string }).actorId).toBeUndefined();
    expect(JSON.stringify(records)).not.toContain('Maxfiy-Parol-9');
  });

  it("Google imzosi yaroqsiz va Mini App imzosi yaroqsiz yozib qo'yiladi, ichida credential yo'q", async () => {
    const { GoogleInvalidError } = await import('../application/google-login.usecase');
    const { TgInitDataError } = await import('../application/telegram-webapp.usecase');
    const { c, records } = make({
      google: { execute: async () => { throw new GoogleInvalidError(); } },
      tg: { execute: async () => { throw new TgInitDataError('TG_INITDATA_EXPIRED'); } },
    });
    await expect(c.google({ credential: 'eyJ.SECRET.CRED' } as never, req(), res())).rejects.toMatchObject({ status: 401 });
    await expect(c.telegramWebApp({ initData: 'hash=SECRETHASH' } as never, req(), res())).rejects.toMatchObject({ status: 401 });
    await flush();
    expect(records.map((r) => (r as any).meta)).toEqual([{ via: 'google', reason: 'GOOGLE_INVALID' }, { via: 'telegram_webapp', reason: 'TG_INITDATA_EXPIRED' }]);
    expect(JSON.stringify(records)).not.toMatch(/SECRET/);
  });

  it("kutilmagan xato (500) va cheklov (429) xabar qilinmaydi", async () => {
    const { c, records } = make({ password: { login: async () => { throw new Error('baza yiqildi'); } } });
    await expect(c.login({ phone: PHONE, password: 'x' } as never, req(), res())).rejects.toThrow('baza yiqildi');
    await flush();
    expect(records).toHaveLength(0);
  });
});

describe("muvaffaqiyatli kirish: audit meta", () => {
  const user = { id: 'u1', phone: PHONE, createdAt: new Date(), personalRoles: [] };
  it("OTP bilan yangi hisob: meta isNew true, phoneLinked yo'q", async () => {
    const { c, audits } = make({ verify: { execute: async () => ({ user, accessToken: 'a', refreshToken: 'r', isNew: true, phoneLinked: false }) } });
    await c.otpVerify({ phone: PHONE, code: '111111' } as never, req(), res());
    expect(audits[0]).toMatchObject({ action: 'auth.login', actorId: 'u1', meta: { via: 'otp', isNew: true } });
    expect(audits[0].meta).not.toHaveProperty('phoneLinked');
  });

  it("Google kirgan hisobga telefon bog'landi: phoneLinked true", async () => {
    const { c, audits } = make({ verify: { execute: async () => ({ user, accessToken: 'a', refreshToken: 'r', isNew: false, phoneLinked: true }) } });
    await c.otpVerify({ phone: PHONE, code: '111111' } as never, req(), res());
    expect(audits[0].meta).toEqual({ via: 'otp', isNew: false, phoneLinked: true });
  });

  it("Mini App: startParam 40 belgiga qisqartiriladi, isNew uzatiladi", async () => {
    const { c, audits } = make({ tg: { execute: async () => ({ user, accessToken: 'a', refreshToken: 'r', isNew: true, startParam: 'x'.repeat(80) }) } });
    await c.telegramWebApp({ initData: 'i' } as never, req(), res());
    expect(audits[0]).toMatchObject({ action: 'auth.telegram_webapp', meta: { via: 'telegram_webapp', isNew: true } });
    expect((audits[0].meta as { startParam: string }).startParam).toHaveLength(40);
  });

  it("isNew bermagan usecase (eski) -> false", async () => {
    const { c, audits } = make({ password: { login: async () => ({ user, accessToken: 'a', refreshToken: 'r' }) } });
    await c.login({ phone: PHONE, password: 'x' } as never, req(), res());
    expect(audits[0].meta).toEqual({ via: 'password', isNew: false });
  });
});

describe('kod so\'rovi, chiqish, profil, bot ulanishi', () => {
  it("otp/request: yuborildi (sent true), actorId topildi; kod yo'q", async () => {
    const { c, records } = make();
    await c.otpRequest({ phone: PHONE, locale: 'uz' } as never, req());
    await flush();
    expect(records[0]).toMatchObject({ action: 'auth.otp.request', actorId: 'u1', guest: { label: maskPhone(PHONE) }, meta: { sent: true } });
  });

  it("otp/request: bot ulanmagan (LINK_REQUIRED) -> sent false, linkToken xabarga chiqmaydi", async () => {
    const { c, records } = make({ found: false, otp: { execute: async () => ({ status: 'LINK_REQUIRED', botUrl: 'https://t.me/x?start=login_TOKEN', linkToken: 'TOKEN', resendAfter: 60 }) } });
    await c.otpRequest({ phone: PHONE, locale: 'uz' } as never, req());
    await flush();
    expect(records[0]).toMatchObject({ action: 'auth.otp.request', meta: { sent: false } });
    expect(JSON.stringify(records)).not.toContain('TOKEN');
  });

  it('parolni tiklash so\'rovi alohida nom bilan', async () => {
    const { c, records } = make();
    await c.passwordResetRequest({ phone: PHONE, locale: 'uz' } as never, req());
    await flush();
    expect(records[0]).toMatchObject({ action: 'auth.password.reset.request', meta: { sent: true } });
  });

  it("chiqish: token yaroqli bo'lsa actorId bilan, mehmon bo'lsa yozilmaydi", async () => {
    const a = make();
    await a.c.logout(req({ headers: { authorization: 'Bearer t' } }), res(), {});
    expect(a.records).toEqual([{ action: 'auth.logout', actorId: 'u1' }]);
    const b = make();
    await b.c.logout(req(), res(), {});
    expect(b.records).toHaveLength(0);
  });

  it("profil: faqat maydon nomlari, qiymat (ism) auditda yo'q", async () => {
    const { c, audits } = make();
    await c.updateMe('u1', { fullName: ' Aziz Karimov ', locale: 'ru' } as never, req());
    expect(audits[0]).toMatchObject({ action: 'auth.profile.update', actorId: 'u1', meta: { fields: ['fullName', 'locale'] } });
    expect(JSON.stringify(audits)).not.toContain('Aziz');
  });

  it("profil: hech narsa o'zgarmasa audit yozilmaydi", async () => {
    const { c, audits } = make();
    await c.updateMe('u1', {} as never, req());
    expect(audits).toHaveLength(0);
  });

  it("botga raqam ulashildi: audit isNew va codeSent bilan, javob avvalgidek (userId/isNew yo'q)", async () => {
    const { c, audits } = make();
    const out = await c.telegramLink({ chatId: '123', username: 'ali', phone: PHONE } as never);
    expect(audits[0]).toMatchObject({ action: 'auth.telegram.link', actorId: 'u9', meta: { isNew: true, username: 'ali', codeSent: false } });
    expect(out).toEqual({ linked: true, codeSent: false });
  });
});
