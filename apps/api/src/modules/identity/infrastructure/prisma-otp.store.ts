import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import type { OtpChallenge, OtpStore } from '../domain/ports';

@Injectable()
export class PrismaOtpStore implements OtpStore {
  constructor(private readonly prisma: PrismaService) {}

  create(c: { phone: string; codeHash: string; expiresAt: Date; linkToken: string | null }): Promise<OtpChallenge> {
    return this.prisma.otpCode.create({ data: c });
  }
  latestActive(phone: string) {
    return this.prisma.otpCode.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  }
  findByLinkToken(linkToken: string) {
    return this.prisma.otpCode.findUnique({ where: { linkToken } });
  }
  async bumpAttempts(id: string) {
    const r = await this.prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
    return r.attempts;
  }
  async consume(id: string) {
    await this.prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }
}
