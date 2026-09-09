import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import type { UserPatch, UserRecord, UserRepository } from '../domain/ports';
import { PhoneTakenError } from '../domain/errors';

const withTg = { include: { telegram: true } } as const;
const toRecord = (u: any): UserRecord => ({
  id: u.id, phone: u.phone, email: u.email, avatarUrl: u.avatarUrl, fullName: u.fullName, locale: u.locale, personalRoles: u.personalRoles,
  isActive: u.isActive, telegramChatId: u.telegram?.chatId ?? null,
  googleSub: u.googleSub, passwordHash: u.passwordHash, failedLogins: u.failedLogins, lockedUntil: u.lockedUntil, createdAt: u.createdAt,
});

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhone(phone: string) {
    const u = await this.prisma.user.findUnique({ where: { phone }, ...withTg });
    return u ? toRecord(u) : null;
  }
  async findById(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, ...withTg });
    return u ? toRecord(u) : null;
  }
  async findByGoogleSub(googleSub: string) {
    const u = await this.prisma.user.findUnique({ where: { googleSub }, ...withTg });
    return u ? toRecord(u) : null;
  }
  async findByEmail(email: string) {
    const u = await this.prisma.user.findUnique({ where: { email }, ...withTg });
    return u ? toRecord(u) : null;
  }
  async createByPhone(phone: string) {
    return toRecord(await this.prisma.user.create({ data: { phone }, ...withTg }));
  }
  async createByGoogle(d: { googleSub: string; email: string; fullName: string | null; avatarUrl: string | null }) {
    return toRecord(await this.prisma.user.create({ data: d, ...withTg }));
  }
  async createByTelegram({ chatId, username, ...d }: { chatId: bigint; username: string | null; fullName: string | null; locale: string; avatarUrl: string | null }) {
    return toRecord(await this.prisma.user.create({ data: { ...d, telegram: { create: { chatId, username } } }, ...withTg }));
  }
  async update(userId: string, d: UserPatch) {
    return toRecord(await this.prisma.user.update({ where: { id: userId }, data: d, ...withTg }));
  }
  async claimPhone(userId: string, phone: string) {
    return this.prisma.$transaction(async (tx) => {
      const other = await tx.user.findUnique({
        where: { phone },
        select: { id: true, passwordHash: true, email: true, googleSub: true, telegram: true, _count: { select: { memberships: true, listings: true } } },
      });
      if (other && other.id !== userId) {
        const inquiries = await tx.inquiry.count({ where: { fromUserId: other.id } });
        const shell = !other.passwordHash && !other.email && !other.googleSub && other._count.memberships === 0 && other._count.listings === 0 && inquiries === 0;
        if (!shell) throw new PhoneTakenError();
        // Bot yaratgan bo'sh user: o'chadi (cascade: telegram, sessiyalar), Telegram bog'lanishi shu userga ko'chadi.
        await tx.user.delete({ where: { id: other.id } });
        if (other.telegram) {
          await tx.telegramLink.upsert({ where: { userId }, create: { userId, chatId: other.telegram.chatId, username: other.telegram.username }, update: { chatId: other.telegram.chatId, username: other.telegram.username } });
        }
      }
      return toRecord(await tx.user.update({ where: { id: userId }, data: { phone }, ...withTg }));
    });
  }
  async linkTelegram(userId: string, chatId: bigint, username: string | null) {
    // Bir chat faqat bitta userga: eski bog'lanish bo'lsa ko'chiriladi.
    await this.prisma.$transaction([
      this.prisma.telegramLink.deleteMany({ where: { chatId, NOT: { userId } } }),
      this.prisma.telegramLink.upsert({ where: { userId }, create: { userId, chatId, username }, update: { chatId, username } }),
    ]);
  }
  async findByTelegramChat(chatId: bigint) {
    const l = await this.prisma.telegramLink.findUnique({ where: { chatId }, include: { user: withTg } });
    return l ? toRecord(l.user) : null;
  }
}
