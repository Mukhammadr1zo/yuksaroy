// Brauzer → /api/v1 (Next rewrite → NestJS). Cookie'lar avtomatik. 401 da bir marta refresh.
// Telegram Mini App: token sessionStorage'da (ys-tg-token), bo'lsa Authorization: Bearer qo'shiladi va refresh token bilan yangilanadi.
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: any) { super(body?.code ?? `HTTP_${status}`); }
}

const TG_KEY = 'ys-tg-token';
type TgTokens = { access: string; refresh: string };
let tg: TgTokens | null | undefined; // undefined = sessionStorage hali o'qilmagan

export function tgTokens(): TgTokens | null {
  if (tg === undefined) {
    tg = null;
    try { tg = JSON.parse(sessionStorage.getItem(TG_KEY) || 'null'); } catch { /* SSR yoki xususiy rejim */ }
  }
  return tg ?? null;
}
export function setTgTokens(t: TgTokens | null) {
  tg = t;
  try { t ? sessionStorage.setItem(TG_KEY, JSON.stringify(t)) : sessionStorage.removeItem(TG_KEY); } catch { /* xususiy rejim */ }
}
/** Mini App'da Bearer sarlavhasi, oddiy saytda bo'sh (cookie yetarli). Multipart fetch'lar uchun ham. */
export const authHeaders = (): Record<string, string> => { const t = tgTokens(); return t ? { authorization: `Bearer ${t.access}` } : {}; };

async function raw(path: string, init: RequestInit = {}) {
  return fetch(`/api/v1${path}`, { ...init, headers: { 'content-type': 'application/json', ...authHeaders(), ...(init.headers ?? {}) }, credentials: 'include' });
}

/** Yangilash: Mini App'da refresh token tanadan, saytda cookie'dan. Muvaffaqiyat = true. */
async function refresh(): Promise<boolean> {
  const t = tgTokens();
  const r = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify(t ? { refreshToken: t.refresh } : {}) });
  if (!r.ok) return false;
  if (t) { const b = await r.json().catch(() => null); if (b?.accessToken) setTgTokens({ access: b.accessToken, refresh: b.refreshToken ?? t.refresh }); }
  return true;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  let res = await raw(path, init);
  // /auth/me faqat Mini App'da yangilanadi (saytda avvalgidek: anonim tashrifga ortiqcha refresh so'rovi yo'q)
  if (res.status === 401 && retry && (!path.startsWith('/auth/') || (path === '/auth/me' && !!tgTokens()))) {
    if (await refresh()) res = await raw(path, init);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const post = <T,>(path: string, data: unknown, headers?: Record<string, string>) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data), headers });
