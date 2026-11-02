import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { anonymizedUser } from '../domain/account';
import { hashSecret } from '../domain/otp';
import { env } from '../../../common/env';

/** Tranzaksiya mijozining kerakli qismi: spec soxta bilan to'ldiradi. */
type Tx = Pick<PrismaService, 'serviceProfile' | 'marketRequest' | 'urgentRequest'>;

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
      await this.cleanup(tx, userId);
      await tx.telegramLink.deleteMany({ where: { userId } });
      // Kuzatuv shartlari ham shaxsiy ma'lumot ("bu odam Toshkent -> Samarqand tent
      // kutyapti"): hisob anonimlashtirilganda ular ham ketishi kerak. Qator o'chmaydi,
      // shuning uchun bazadagi Cascade bu yerda ishlamaydi.
      await tx.watch.deleteMany({ where: { userId } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: anonymizedUser() });
      return report;
    });
  }

  /**
   * Hisob o'chganda odamning bozordagi izi ham ketadi (egasi qarori, 2026-11-02): xizmat profillari yashiriladi
   * (admin bloklaganlari BLOCKED qoladi), ochiq yuk va shoshilinch so'rovlar yopiladi, raqami hamma yerdan olinadi.
   * Aks holda anonim hisobning profili katalogda va telefoni obunachiga ochiladigan so'rovda turaverardi.
   * AWARDED so'rov yopilmaydi: ijrochi tanlangan, uni bir tomonlama uzish ijrochiga zarar; faqat raqam olinadi.
   */
  private async cleanup(tx: Tx, userId: string) {
    await tx.serviceProfile.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'HIDDEN' } });
    await tx.serviceProfile.updateMany({ where: { userId, contactPhone: { not: null } }, data: { contactPhone: null } });
    await tx.marketRequest.updateMany({ where: { createdById: userId, status: 'OPEN' }, data: { status: 'CLOSED' } });
    await tx.marketRequest.updateMany({ where: { createdById: userId, contactPhone: { not: null } }, data: { contactPhone: null } });
    // UrgentRequest.contactPhone majburiy ustun: null emas, bo'sh qator
    await tx.urgentRequest.updateMany({ where: { createdById: userId, status: 'OPEN' }, data: { status: 'CLOSED' } });
    await tx.urgentRequest.updateMany({ where: { createdById: userId, NOT: { contactPhone: '' } }, data: { contactPhone: '' } });
  }
}
