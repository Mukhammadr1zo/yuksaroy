import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import type { SessionStore } from '../domain/ports';

@Injectable()
export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaService) {}

  create(s: { userId: string; refreshHash: string; expiresAt: Date; userAgent?: string; ip?: string }) {
    return this.prisma.session.create({ data: s, select: { id: true } });
  }
  findById(id: string) {
    return this.prisma.session.findUnique({ where: { id }, select: { revokedAt: true } });
  }
  findByRefreshHash(refreshHash: string) {
    return this.prisma.session.findUnique({ where: { refreshHash }, select: { id: true, userId: true, expiresAt: true, revokedAt: true, replacedById: true } });
  }
  findLive(id: string) {
    return this.prisma.session.findUnique({ where: { id }, select: { id: true, userId: true, expiresAt: true, revokedAt: true } });
  }
  async rotate(oldId: string, next: { refreshHash: string; expiresAt: Date }) {
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.session.findUniqueOrThrow({ where: { id: oldId } });
      const created = await tx.session.create({ data: { userId: old.userId, refreshHash: next.refreshHash, expiresAt: next.expiresAt, userAgent: old.userAgent, ip: old.ip }, select: { id: true } });
      await tx.session.update({ where: { id: oldId }, data: { revokedAt: new Date(), replacedById: created.id } });
      return created;
    });
  }
  async revoke(id: string) {
    await this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }
  async revokeAllForUser(userId: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
