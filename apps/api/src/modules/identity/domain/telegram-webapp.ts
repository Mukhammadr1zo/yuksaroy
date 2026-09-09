// Telegram Mini App initData tekshiruvi (Telegram hujjati: secret = HMAC_SHA256('WebAppData', BOT_TOKEN)). Framework va Prisma yo'q.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const INITDATA_MAX_AGE_SEC = 24 * 3600;

export interface TgWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export type InitDataResult =
  | { ok: true; user: TgWebAppUser; authDate: number; startParam: string | null }
  | { ok: false; code: 'TG_INITDATA_INVALID' | 'TG_INITDATA_EXPIRED' };

const INVALID = { ok: false, code: 'TG_INITDATA_INVALID' } as const;

const secretKey = (botToken: string) => createHmac('sha256', 'WebAppData').update(botToken).digest();
/** data_check_string: hash siz, kalit bo'yicha saralangan key=value satrlar, \n bilan. */
const checkString = (p: URLSearchParams) =>
  [...p.entries()].filter(([k]) => k !== 'hash').sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');

/** Testlar va Playwright uchun: maydonlarni bot tokeni bilan imzolab initData satrini beradi. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const p = new URLSearchParams(fields);
  p.set('hash', createHmac('sha256', secretKey(botToken)).update(checkString(p)).digest('hex'));
  return p.toString();
}

export function validateInitData(initData: string, botToken: string, now = Date.now()): InitDataResult {
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return INVALID;
  const expected = createHmac('sha256', secretKey(botToken)).update(checkString(p)).digest('hex');
  if (hash.length !== expected.length || !timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) return INVALID;

  const authDate = Number(p.get('auth_date'));
  if (!p.get('auth_date') || !Number.isFinite(authDate)) return INVALID;
  if (now / 1000 - authDate > INITDATA_MAX_AGE_SEC) return { ok: false, code: 'TG_INITDATA_EXPIRED' };

  let user: TgWebAppUser;
  try { user = JSON.parse(p.get('user') ?? ''); } catch { return INVALID; }
  if (typeof user?.id !== 'number' || typeof user.first_name !== 'string') return INVALID;
  return { ok: true, user, authDate, startParam: p.get('start_param') };
}
