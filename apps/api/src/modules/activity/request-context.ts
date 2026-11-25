import { AsyncLocalStorage } from 'node:async_hooks';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../common/env';
import type { Channel } from './activity.types';

/** Har so'rovning IP, qurilma va kanali: audit va faoliyat xabari shundan o'qiydi (main.ts onRequest hook). */
export type ReqCtx = { ip?: string; ua?: string; channel: Channel };
export const requestContext = new AsyncLocalStorage<ReqCtx>();

/**
 * bot: x-internal-secret bor (bot -> API); miniapp: Bearer (Mini App Bearer yuboradi, sayt cookie);
 * web: qolgani.
 */
export function channelOf(headers: Record<string, unknown>): Channel {
  // Faqat to'g'ri sir: soxta sarlavha bilan IP va qurilmani yashirib bo'lmasin
  const h = String(headers['x-internal-secret'] ?? '');
  if (h && h.length === env.INTERNAL_SECRET.length && timingSafeEqual(Buffer.from(h), Buffer.from(env.INTERNAL_SECRET))) return 'bot';
  if (String(headers['authorization'] ?? '').startsWith('Bearer ')) return 'miniapp';
  return 'web';
}

export const currentContext = (): ReqCtx | undefined => requestContext.getStore();

/** Fastify onRequest hook: qolgan hooklar va ishlovchi shu kontekst ichida ishlaydi (await dan keyin ham). */
export function contextHook(req: { ip?: string; headers: Record<string, unknown> }, _reply: unknown, done: () => void): void {
  requestContext.run({ ip: req.ip, ua: String(req.headers['user-agent'] ?? '').slice(0, 300), channel: channelOf(req.headers) }, done);
}
