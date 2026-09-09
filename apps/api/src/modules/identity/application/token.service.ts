import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SESSION_STORE, type SessionStore } from '../domain/ports';
import { hashSecret, randomToken } from '../domain/otp';
import { env } from '../../../common/env';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 3600;

/** sid = Session.id: logoutdan keyin access token ham qabul qilinmaydi (eski, sid'siz tokenlar ishlayveradi). */
export interface AccessClaims { sub: string; sid?: string }

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService, @Inject(SESSION_STORE) private readonly sessions: SessionStore) {}

  async issuePair(userId: string, ctx: { userAgent?: string; ip?: string }) {
    const refresh = randomToken(32);
    const s = await this.sessions.create({
      userId, refreshHash: hashSecret(refresh, env.JWT_SECRET),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000), userAgent: ctx.userAgent, ip: ctx.ip,
    });
    return { accessToken: this.signAccess(userId, s.id), refreshToken: refresh };
  }

  /** Rotation: eski refresh bekor, yangisi beriladi. Qayta ishlatilgan (revoked) token → butun sessiya bekor. */
  async refresh(refreshToken: string) {
    const s = await this.sessions.findByRefreshHash(hashSecret(refreshToken, env.JWT_SECRET));
    if (!s) throw new UnauthorizedException('REFRESH_INVALID');
    if (s.revokedAt) { await this.sessions.revokeAllForUser(s.userId); throw new UnauthorizedException('REFRESH_REUSED'); }
    if (s.expiresAt < new Date()) throw new UnauthorizedException('REFRESH_EXPIRED');
    const next = randomToken(32);
    const created = await this.sessions.rotate(s.id, { refreshHash: hashSecret(next, env.JWT_SECRET), expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000) });
    return { accessToken: this.signAccess(s.userId, created.id), refreshToken: next, userId: s.userId };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    const s = await this.sessions.findByRefreshHash(hashSecret(refreshToken, env.JWT_SECRET));
    if (s) await this.sessions.revoke(s.id);
  }

  verifyAccess(token: string): AccessClaims {
    return this.jwt.verify<AccessClaims>(token, { secret: env.JWT_SECRET });
  }

  private signAccess(userId: string, sid: string) {
    return this.jwt.sign({ sub: userId, sid } satisfies AccessClaims, { secret: env.JWT_SECRET, expiresIn: ACCESS_TTL_SEC });
  }
}
