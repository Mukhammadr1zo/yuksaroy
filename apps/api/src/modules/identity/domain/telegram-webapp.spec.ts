import { describe, expect, it } from 'vitest';
import { signInitData, validateInitData } from './telegram-webapp';

const TOKEN = '123456:TEST_FAKE_TOKEN';
const now = Date.UTC(2026, 8, 9, 6, 0, 0);
const user = JSON.stringify({ id: 42, first_name: 'Ali', last_name: 'Valiyev', username: 'ali', language_code: 'uz' });
const fresh = () => ({ auth_date: String(Math.floor(now / 1000) - 60), query_id: 'AAH', user, start_param: 'terminal_abc' });

describe('validateInitData', () => {
  it("to'g'ri imzo: user va start_param qaytadi", () => {
    const r = validateInitData(signInitData(fresh(), TOKEN), TOKEN, now);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.user).toMatchObject({ id: 42, first_name: 'Ali', username: 'ali' });
      expect(r.startParam).toBe('terminal_abc');
    }
  });

  it('buzilgan hash, boshqa token yoki o\'zgargan maydon rad', () => {
    const s = signInitData(fresh(), TOKEN);
    expect(validateInitData(s.replace(/hash=\w{6}/, 'hash=000000'), TOKEN, now)).toEqual({ ok: false, code: 'TG_INITDATA_INVALID' });
    expect(validateInitData(s, 'other:token', now).ok).toBe(false);
    expect(validateInitData(s.replace('Ali', 'Vali'), TOKEN, now).ok).toBe(false);
    expect(validateInitData('', TOKEN, now).ok).toBe(false);
  });

  it('24 soatdan eski auth_date rad', () => {
    const old = signInitData({ ...fresh(), auth_date: String(Math.floor(now / 1000) - 25 * 3600) }, TOKEN);
    expect(validateInitData(old, TOKEN, now)).toEqual({ ok: false, code: 'TG_INITDATA_EXPIRED' });
  });

  it('user yo\'q yoki buzuq JSON rad', () => {
    const { user: _u, ...noUser } = fresh();
    expect(validateInitData(signInitData(noUser, TOKEN), TOKEN, now)).toEqual({ ok: false, code: 'TG_INITDATA_INVALID' });
    expect(validateInitData(signInitData({ ...fresh(), user: '{bad' }, TOKEN), TOKEN, now).ok).toBe(false);
  });
});
