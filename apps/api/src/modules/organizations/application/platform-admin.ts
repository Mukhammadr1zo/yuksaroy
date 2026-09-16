import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { env } from '../../../common/env';
import { parseAdminPhones } from '../domain/rules';

/**
 * Platformaning ikki darajasi.
 *
 * Operator (PLATFORM_OPERATOR) kundalik ish uchun: navbatlarni ko'radi, e'lonni
 * tasdiqlaydi yoki rad etadi, sharh o'chiradi, hisobni bloklaydi, murojaatga javob beradi.
 *
 * Ega (PLATFORM_ADMIN yoki PLATFORM_ADMIN_PHONES) bundan tashqari platformaning o'zini
 * o'zgartira oladi: komissiya foizi va muddatlar, hisobni butunlay o'chirish, tashkilot
 * yoki terminalni o'chirish, va eng muhimi platforma rolini berish.
 *
 * Nega ajratildi: ilgari ikkalasi bir xil edi. E'lon tasdiqlash uchun yollangan odam
 * komissiya foizini o'zgartira, hisoblarni o'chira va o'ziga ega huquqini bera olardi.
 * Zarar qaytarib bo'lmaydigan turdan, ishonch esa ish tavsifiga mos kelmasdi.
 */
@Injectable()
export class PlatformAdmin {
  private readonly phones = parseAdminPhones(env.PLATFORM_ADMIN_PHONES);

  constructor(private readonly prisma: PrismaService) {}

  /** Panelga kirish huquqi: operator ham, ega ham. */
  async isPlatformAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR']);
  }

  /** Platformani o'zgartirish huquqi: faqat ega. */
  async isPlatformOwner(userId: string): Promise<boolean> {
    return this.hasRole(userId, ['PLATFORM_ADMIN']);
  }

  async assertPlatformAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) throw new ForbiddenException({ code: 'NOT_PLATFORM_ADMIN' });
  }

  async assertPlatformOwner(userId: string): Promise<void> {
    if (!(await this.isPlatformOwner(userId))) throw new ForbiddenException({ code: 'NOT_PLATFORM_OWNER' });
  }

  /**
   * Telefon ro'yxati har doim ega darajasi beradi: bu birinchi adminni yaratish yo'li
   * va u faqat serverdagi .env ni o'zgartira oladigan odamda bo'ladi.
   */
  private async hasRole(userId: string, roles: Role[]): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, memberships: { where: { roles: { hasSome: roles } }, select: { id: true }, take: 1 } },
    });
    return !!u && (u.memberships.length > 0 || (u.phone !== null && this.phones.has(u.phone)));
  }
}
