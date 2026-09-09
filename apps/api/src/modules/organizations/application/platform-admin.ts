import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { env } from '../../../common/env';
import { parseAdminPhones } from '../domain/rules';

/** Platforma admini: PLATFORM_ADMIN/PLATFORM_OPERATOR roli yoki telefoni PLATFORM_ADMIN_PHONES ichida. */
@Injectable()
export class PlatformAdmin {
  private readonly phones = parseAdminPhones(env.PLATFORM_ADMIN_PHONES);

  constructor(private readonly prisma: PrismaService) {}

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, memberships: { where: { roles: { hasSome: ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'] } }, select: { id: true }, take: 1 } },
    });
    return !!u && (u.memberships.length > 0 || (u.phone !== null && this.phones.has(u.phone)));
  }

  async assertPlatformAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) throw new ForbiddenException({ code: 'NOT_PLATFORM_ADMIN' });
  }
}
