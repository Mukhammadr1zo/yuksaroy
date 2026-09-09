// Server komponentlar → NestJS (ichki URL). Brauzer uchun lib/api.ts (/api/v1 rewrite).
const BASE = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export class ServerApiError extends Error {
  constructor(public readonly status: number, path: string) { super(`API ${status} ${path}`); }
}

/** GET; ISR: revalidate soniyada (default 5 daq, ochiq katalog). */
export async function sapi<T>(path: string, revalidate: number | false = 300): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, { next: { revalidate } });
  if (!res.ok) throw new ServerApiError(res.status, path);
  return res.json() as Promise<T>;
}

/** 404 → null (sahifa `notFound()` chaqiradi). */
export async function sapiOrNull<T>(path: string, revalidate: number | false = 300): Promise<T | null> {
  try { return await sapi<T>(path, revalidate); }
  catch (e) { if (e instanceof ServerApiError && e.status === 404) return null; throw e; }
}

/** Ochiq POST (masalan /quote): kesh sahifa darajasidagi revalidate bilan. */
export async function spost<T>(path: string, body: unknown, revalidate: number | false = 300): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), next: { revalidate } });
  if (!res.ok) throw new ServerApiError(res.status, path);
  return res.json() as Promise<T>;
}

/** { a: '1', b: undefined } → "?a=1" */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
