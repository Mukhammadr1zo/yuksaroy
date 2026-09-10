// Brauzer → /api/v1 (Next rewrite → NestJS). Cookie'lar avtomatik. 401 da bir marta refresh.
// Telegram Mini App: token sessionStorage'da (ys-tg-token), bo'lsa Authorization: Bearer qo'shiladi va refresh token bilan yangilanadi.
/** Sessiya bayrog'i (httpOnly emas): mehmonda /auth/me va /auth/refresh umuman chaqirilmaydi. */
export function hasSession(): boolean {
  try { return document.cookie.includes('ys_in=1') || !!tgTokens(); } catch { return false; }
}

/** Sessiya keshlari: kirish, chiqish va 401 dan keyin tozalanadi.
 * Ikkalasi birga: aks holda kirgan odam sarlavhada hamon "Kirish" tugmasini ko'radi. */
export function clearAuthedCache() {
  try { sessionStorage.removeItem('ys-authed'); sessionStorage.removeItem('ys-me'); } catch { /* xususiy rejim */ }
}

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
  // 401 da bir marta refresh: access cookie 15 daqiqada tugaydi, refresh 30 kun turadi.
  // Busiz kirgan foydalanuvchi 15 daqiqadan keyin mehmon deb hisoblanardi (kabinet tugmalari yo'qolardi).
  if (res.status === 401 && retry && path !== '/auth/refresh' && hasSession()) {
    if (await refresh()) res = await raw(path, init);
    else clearAuthedCache();
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const post = <T,>(path: string, data: unknown, headers?: Record<string, string>) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data), headers });
