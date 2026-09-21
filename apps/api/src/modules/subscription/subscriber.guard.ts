import { CanActivate, ExecutionContext, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthedRequest } from '../identity/presentation/jwt.guard';
import { SubscriptionService } from './subscription.service';

/**
 * Obunachi uchun guard. JwtGuard dan KEYIN turadi (u req.userId ni qo'yadi).
 *
 * Telefon raqami va vagon qidiruvi kabi pullik yo'llar shu bilan yopiladi. Kod 402:
 * mijoz uni "kirish kerak" (401) dan ajratib, obuna sahifasiga yo'naltiradi.
 *
 * Ishlatilishi: `@UseGuards(JwtGuard, SubscriberGuard)`.
 */
@Injectable()
export class SubscriberGuard implements CanActivate {
  constructor(private readonly subs: SubscriptionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    // JwtGuard bo'lmasa userId bo'sh: jim o'tkazish o'rniga rad etamiz
    if (!req.userId) throw new UnauthorizedException('NO_TOKEN');
    if (!(await this.subs.isActive(req.userId))) throw new HttpException({ code: 'SUBSCRIPTION_REQUIRED' }, 402);
    return true;
  }
}
