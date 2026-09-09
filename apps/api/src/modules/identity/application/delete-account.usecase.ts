import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { anonymizedUser } from '../domain/account';
import { hashSecret } from '../domain/otp';
import { env } from '../../../common/env';

export interface DeleteReport { phoneHash: string | null; transferred: { orgId: string; toUserId: string }[]; orphaned: string[] }

/**
 * Soft delete: shaxsiy maydonlar tozalanadi, yozuv qoladi (buyurtma va hujjatlar tegilmaydi, qonuniy saqlash).
 * Egalik: boshqa a'zosi bor tashkilotda eng eski a'zoga o'tadi; yolg'iz tashkilot qoladi, e'lonlari ARCHIVED, terminallari HIDDEN.
 */
@Injectable()
export class DeleteAccountUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<DeleteReport> {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
      const report: DeleteReport = { phoneHash: u.phone ? hashSecret(u.phone, env.JWT_SECRET) : null, transferred: [], orphaned: [] };

      const owned = await tx.membership.findMany({ where: { userId, isOwner: true }, select: { orgId: true } });
      for (const { orgId } of owned) {
        const heir = await tx.membership.findFirst({ where: { orgId, NOT: { userId } }, orderBy: { createdAt: 'asc' }, select: { id: true, userId: true } });
        if (heir) {
          await tx.membership.update({ where: { id: heir.id }, data: { isOwner: true } });
          report.transferred.push({ orgId, toUserId: heir.userId });
        } else {
          await tx.listing.updateMany({ where: { orgId, NOT: { status: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } });
          await tx.terminal.updateMany({ where: { orgId, NOT: { status: 'HIDDEN' } }, data: { status: 'HIDDEN' } });
          report.orphaned.push(orgId);
        }
      }
      await tx.membership.deleteMany({ where: { userId } });
      await tx.listing.updateMany({ where: { ownerUserId: userId, NOT: { status: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } });
      await tx.telegramLink.deleteMany({ where: { userId } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: anonymizedUser() });
      return report;
    });
  }
}
