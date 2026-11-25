// isNew: true faqat shu chaqiruvda hisob qatori ochilgan joyda (superadmin "ro'yxatdan o'tdi" xabari shunga tayanadi).
// Soxta ombor, baza va Telegram yo'q.
import { describe, expect, it, vi } from 'vitest';
import { PasswordUseCase } from './password.usecase';
import { VerifyOtpUseCase } from './verify-otp.usecase';
import { LinkTelegramUseCase } from './link-telegram.usecase';
import { TelegramWebAppUseCase } from './telegram-webapp.usecase';

vi.mock('../domain/telegram-webapp', () => ({
  validateInitData: () => ({ ok: true, user: { id: 777, first_name: 'Ali', username: 'ali' }, startParam: 'p' }),
}));

const PHONE = '+998901234567';
const tokens = { issuePair: async () => ({ accessToken: 'a', refreshToken: 'r' }), revokeOthers: async () => {} } as never;

function users(existing: Record<string, unknown> | null) {
  const created: string[] = [];
  const u = {
    findByPhone: async () => existing,
    findById: async (id: string) => (id === 'me' ? { id: 'me', phone: null } : existing),
    createByPhone: async () => { created.push('phone'); return { id: 'new', phone: PHONE }; },
    createByTelegram: async () => { created.push('tg'); return { id: 'new', phone: null }; },
    findByTelegramChat: async () => existing,
    claimPhone: async (id: string) => ({ id, phone: PHONE }),
    linkTelegram: async () => {},
    update: async (id: string) => ({ id, phone: PHONE }),
  };
  return { u: u as never, created };
}
describe('VerifyOtpUseCase.isNew', () => {
  it("raqam bazada yo'q -> hisob ochildi (isNew true)", async () => {
    const { u, created } = users(null);
    const uc = new VerifyOtpUseCase(u, {} as never, tokens);
    uc.consume = async () => PHONE;
    const r = await uc.execute(PHONE, '111111', {});
    expect(r.isNew).toBe(true);
    expect(created).toEqual(['phone']);
  });

  it('raqam bazada bor -> isNew false', async () => {
    const { u } = users({ id: 'u1', phone: PHONE });
    const uc = new VerifyOtpUseCase(u, {} as never, tokens);
    uc.consume = async () => PHONE;
    expect((await uc.execute(PHONE, '111111', {})).isNew).toBe(false);
  });

  it("telefonsiz kirgan hisobga raqam bog'landi -> phoneLinked true, isNew false", async () => {
    const { u, created } = users(null);
    const uc = new VerifyOtpUseCase(u, {} as never, tokens);
    uc.consume = async () => PHONE;
    const r = await uc.execute(PHONE, '111111', {}, 'me');
    expect(r).toMatchObject({ isNew: false, phoneLinked: true });
    expect(created).toEqual([]);
  });
});

describe('PasswordUseCase.reset isNew', () => {
  const verify = { consume: async () => PHONE } as never;
  it("raqam yo'q edi -> isNew true", async () => {
    const { u } = users(null);
    expect((await new PasswordUseCase(u, tokens, verify).reset(PHONE, '1', 'yangi-parol-1', {})).isNew).toBe(true);
  });
  it('raqam bor edi -> isNew false', async () => {
    const { u } = users({ id: 'u1', phone: PHONE });
    expect((await new PasswordUseCase(u, tokens, verify).reset(PHONE, '1', 'yangi-parol-1', {})).isNew).toBe(false);
  });
});

describe('TelegramWebAppUseCase.isNew', () => {
  it("chat bog'lanmagan -> yangi hisob (isNew true)", async () => {
    const { u, created } = users(null);
    const r = await new TelegramWebAppUseCase(u, tokens).execute('init', {});
    expect(r.isNew).toBe(true);
    expect(created).toEqual(['tg']);
  });
  it("chat bog'langan -> isNew false", async () => {
    const { u } = users({ id: 'u1', phone: PHONE });
    expect((await new TelegramWebAppUseCase(u, tokens).execute('init', {})).isNew).toBe(false);
  });
});

describe('LinkTelegramUseCase.isNew', () => {
  const input = { chatId: 5n, username: 'ali', phone: PHONE };
  const store = { latestActive: async () => null, findByLinkToken: async () => null } as never;
  it("bot kontaktidan yangi hisob -> isNew true, userId qaytadi", async () => {
    const { u } = users(null);
    expect(await new LinkTelegramUseCase(u, store, {} as never).execute(input)).toEqual({ linked: true, codeSent: false, isNew: true, userId: 'new' });
  });
  it('mavjud hisob -> isNew false', async () => {
    const { u } = users({ id: 'u1', phone: PHONE });
    expect(await new LinkTelegramUseCase(u, store, {} as never).execute(input)).toMatchObject({ isNew: false, userId: 'u1' });
  });
});
