import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PlatformAdmin } from '../application/platform-admin';
import type { AuthedRequest } from '../../identity/presentation/jwt.guard';

/**
 * Faqat platforma egasi uchun guard: qaytarib bo'lmaydigan yoki platformaning o'zini
 * o'zgartiradigan amallar shu bilan yopiladi.
 *
 * PlatformAdminGuard dan farqi: operator o'tmaydi. Ikkalasi bir xil bo'lganda e'lon
 * tasdiqlash uchun yollangan odam komissiya foizini o'zgartira, hisoblarni o'chira va
 * o'ziga ega huquqini bera olardi.
 *
 * Ishlatilishi: `@UseGuards(JwtGuard, PlatformOwnerGuard)`.
 */
@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  constructor(private readonly admin: PlatformAdmin) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    // JwtGuard bo'lmasa userId bo'sh bo'ladi: ruxsat bermaymiz
    await this.admin.assertPlatformOwner(req.userId ?? '');
    return true;
  }
}
