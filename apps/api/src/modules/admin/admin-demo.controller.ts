import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformOwnerGuard } from '../organizations/presentation/platform-owner.guard';
import { demoStatus, removeDemo, seedDemo } from './demo/demo-seed';

/**
 * Namuna ma'lumotlar: prodda katalog bo'sh ko'rinmasin deb yuklanadi, har qatori "Namuna"
 * yorlig'i bilan chiziladi. Faqat platforma egasi: bu butun saytga ko'rinadigan qatorlar,
 * operator bosib qo'ymasin. Idempotent, shuning uchun alohida chegara yo'q.
 */
@ApiTags('admin')
@Controller('admin/demo')
@UseGuards(JwtGuard, PlatformOwnerGuard)
@ApiCookieAuth('ys_access')
export class AdminDemoController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get('status')
  status() {
    return demoStatus(this.prisma);
  }

  @Post('seed')
  async seed(@CurrentUserId() userId: string) {
    const counts = await seedDemo(this.prisma);
    await this.audit.log({ actorId: userId, action: 'admin.demo.seed', entity: 'demo', meta: counts });
    return counts;
  }

  @Post('remove')
  async remove(@CurrentUserId() userId: string) {
    const counts = await removeDemo(this.prisma);
    await this.audit.log({ actorId: userId, action: 'admin.demo.remove', entity: 'demo', meta: counts });
    return counts;
  }
}
