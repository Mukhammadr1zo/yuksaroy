import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PlatformAdmin } from '../application/platform-admin';
import type { AuthedRequest } from '../../identity/presentation/jwt.guard';

/**
 * Platforma admini uchun guard. JwtGuard dan KEYIN turadi (u req.userId ni qo'yadi).
 *
 * Ilgari har bir handler birinchi qatorida `await this.admin.assertPlatformAdmin(userId)`
 * chaqirardi. Yangi endpoint yozayotganda shu qator unutilsa, endpoint har qanday kirgan
 * foydalanuvchiga ochiq bo'lib qolardi va buni hech narsa ushlamas edi. Guard esa
 * dekoratorda ko'rinib turadi va kod ko'rigida yo'qligi darrov bilinadi.
 *
 * Ishlatilishi: `@UseGuards(JwtGuard, PlatformAdminGuard)`.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly admin: PlatformAdmin) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    // JwtGuard bo'lmasa userId bo'sh bo'ladi: ruxsat bermaymiz, aks holda guard jim o'tkazib yuborardi
    await this.admin.assertPlatformAdmin(req.userId ?? '');
    return true;
  }
}
