import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { TokenService } from '../application/token.service';
import { SESSION_STORE, USER_REPOSITORY, type SessionStore, type UserRepository } from '../domain/ports';

export const ACCESS_COOKIE = 'ys_access';
export const REFRESH_COOKIE = 'ys_refresh';

export interface AuthedRequest extends FastifyRequest { userId: string }

/** Bearer (mobil/bot) yoki cookie (web) dan access token. */
export function readAccessToken(req: FastifyRequest): string | undefined {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  return bearer ?? (req as any).cookies?.[ACCESS_COOKIE];
}

/** Ixtiyoriy kirish (ochiq sahifalar): token bo'lsa va to'g'ri bo'lsa userId, aks holda null. */
export function optionalUserId(req: FastifyRequest, tokens: TokenService): string | null {
  const token = readAccessToken(req);
  if (!token) return null;
  try { return tokens.verifyAccess(token).sub; } catch { return null; }
}

/** Cookie (web) yoki Bearer (mobil/bot), ikkalasi ham. O'chirilgan (isActive=false) foydalanuvchi har so'rovda rad etiladi. */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = readAccessToken(req);
    if (!token) throw new UnauthorizedException('NO_TOKEN');
    let claims: { sub: string; sid?: string };
    try { claims = this.tokens.verifyAccess(token); } catch { throw new UnauthorizedException('TOKEN_INVALID'); }
    const sub = claims.sub;
    // ponytail: har so'rovda bitta user select; yuk oshsa qisqa muddatli kesh
    const u = await this.users.findById(sub);
    if (!u || !u.isActive) throw new UnauthorizedException({ code: 'USER_INACTIVE' });
    // sid bo'lsa sessiya bekor qilinmaganini tekshiramiz (logoutdan keyin access token ham o'lik).
    // sid'siz eski tokenlar rad etilmaydi, aks holda joriy foydalanuvchilar birdaniga chiqib ketardi.
    // ponytail: bu ikkinchi DB so'rovi; yuk oshsa sessiya holati uchun qisqa muddatli kesh
    if (claims.sid) {
      const s = await this.sessions.findById(claims.sid);
      if (!s || s.revokedAt) throw new UnauthorizedException({ code: 'SESSION_REVOKED' });
    }
    req.userId = sub;
    return true;
  }
}

export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().userId);
