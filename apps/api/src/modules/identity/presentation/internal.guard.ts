import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../../common/env';

/** Bot → API ichki chaqiruvlari uchun umumiy sir (X-Internal-Secret). */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const h = String(ctx.switchToHttp().getRequest().headers['x-internal-secret'] ?? '');
    const ok = h.length === env.INTERNAL_SECRET.length && timingSafeEqual(Buffer.from(h), Buffer.from(env.INTERNAL_SECRET));
    if (!ok) throw new UnauthorizedException('INTERNAL_SECRET');
    return true;
  }
}
