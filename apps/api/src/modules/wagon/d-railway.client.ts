import { Injectable } from '@nestjs/common';
import { env } from '../../common/env';
import type { UpstreamEvent } from './wagon.rules';

export class UpstreamError extends Error {}

export interface UpstreamHistory { count: number; events: UpstreamEvent[] }

type FetchFn = typeof fetch;

/**
 * d-railway.uz (egasining tahlil platformasi) uchun server-server mijoz.
 * Kirish tokeni 2 soat yashaydi va yangilash yo'li yo'q: xotirada saqlanadi, 401 kelsa
 * bir marta qayta kiriladi va so'rov takrorlanadi. Boshqa qayta urinish yo'q. Butun history()
 * (login + so'rov + qayta login + takror) bitta 10 soniyalik muddatda: sekin upstream
 * foydalanuvchini bundan ortiq kuttirmasin.
 * Manzil, login va parol hech qachon javobga chiqmaydi.
 */
@Injectable()
export class DRailwayClient {
  private token: string | null = null;

  constructor(
    private readonly cfg: { url?: string; email?: string; password?: string } = { url: env.D_RAILWAY_URL, email: env.D_RAILWAY_EMAIL, password: env.D_RAILWAY_PASSWORD },
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  get configured(): boolean {
    return !!(this.cfg.url && this.cfg.email && this.cfg.password);
  }

  /** Tarix; vagon hisobotlarda yo'q bo'lsa null. Tarmoq/upstream xatosi UpstreamError. */
  async history(no: string): Promise<UpstreamHistory | null> {
    if (!this.configured) throw new UpstreamError('not configured');
    const path = `/api/v1/wagon-history/${encodeURIComponent(no)}`;
    // Bitta muddat hamma bosqichga: har fetch o'z 10 soniyasini olsa eng yomoni 40 soniya bo'lardi
    const signal = AbortSignal.timeout(10_000);
    let res = await this.get(path, signal);
    if (res.status === 401) {
      this.token = null;
      res = await this.get(path, signal);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new UpstreamError(`history ${res.status}`);
    const body = (await res.json().catch(() => null)) as { count?: number; events?: UpstreamEvent[] } | null;
    if (!body || !Array.isArray(body.events)) throw new UpstreamError('history body');
    return body.events.length ? { count: body.count ?? body.events.length, events: body.events } : null;
  }

  private base() { return (this.cfg.url as string).replace(/\/$/, ''); }

  private async get(path: string, signal: AbortSignal): Promise<Response> {
    const token = this.token ?? (await this.login(signal));
    try {
      return await this.fetchFn(`${this.base()}${path}`, { headers: { authorization: `Bearer ${token}` }, signal });
    } catch (e) {
      throw new UpstreamError(`fetch: ${(e as Error).message}`);
    }
  }

  private async login(signal: AbortSignal): Promise<string> {
    const body = new URLSearchParams({ username: this.cfg.email as string, password: this.cfg.password as string });
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base()}/api/v1/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal,
      });
    } catch (e) {
      throw new UpstreamError(`login fetch: ${(e as Error).message}`);
    }
    if (!res.ok) throw new UpstreamError(`login ${res.status}`);
    const j = (await res.json().catch(() => null)) as { access_token?: string } | null;
    if (!j?.access_token) throw new UpstreamError('login body');
    this.token = j.access_token;
    return this.token;
  }
}
