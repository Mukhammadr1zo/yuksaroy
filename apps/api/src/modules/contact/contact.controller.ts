import { Body, Controller, Get, HttpCode, HttpException, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { env } from '../../common/env';
import { IpBucket } from '../../common/ip-bucket';
import { PrismaService } from '../../common/prisma.service';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { PlatformAdmin } from '../organizations/application/platform-admin';
import { parseAdminPhones } from '../organizations/domain/rules';
import { clampInt } from '../catalog/presentation/catalog.controller';

class ContactDto {
  @IsString() @Length(2, 100) name!: string;
  /** Telefon yoki email. */
  @IsString() @Length(3, 120) contact!: string;
  /** Web tanlovi: demo | question | tech | partner (matn sifatida saqlanadi). */
  @IsString() @Length(1, 40) topic!: string;
  @IsString() @Length(10, 2000) message!: string;
  /** Honeypot: odam to'ldirmaydi; to'ldirilsa jimgina qabul qilinadi, saqlanmaydi. */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

const bucket = new IpBucket(5, 60_000); // bitta IP: daqiqasiga 5 ta murojaat
const ADMIN_ROLES = ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'] as const;
const adminPhones = [...parseAdminPhones(env.PLATFORM_ADMIN_PHONES)];

/** Murojaat formasi (ochiq, IP limit) va admin ro'yxati. Adminlarga Telegram orqali xabar; xato e'tiborsiz. */
@ApiTags('contact')
@Controller()
export class ContactController {
  constructor(private readonly prisma: PrismaService, private readonly admin: PlatformAdmin, private readonly audit: AuditService) {}

  @Post('contact') @HttpCode(200)
  async create(@Ip() ip: string, @Body() dto: ContactDto) {
    if (!bucket.take(ip ?? '?')) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    if (dto.website) return { ok: true }; // bot: saqlanmaydi
    const m = await this.prisma.contactMessage.create({ data: { name: dto.name.trim(), contact: dto.contact.trim(), topic: dto.topic.trim(), message: dto.message.trim() } });
    await this.audit.log({ action: 'contact.create', entity: 'ContactMessage', entityId: m.id, meta: { topic: m.topic }, ip });
    void this.notify(m).catch(() => {}); // javobni kutmaydi
    return { ok: true, id: m.id };
  }

  @Get('admin/contact') @UseGuards(JwtGuard) @ApiCookieAuth('ys_access')
  async list(@CurrentUserId() userId: string, @Query('page') page?: string) {
    await this.admin.assertPlatformAdmin(userId);
    const p = clampInt(page, 1, 1, 10_000), limit = 30;
    const [items, total] = await Promise.all([
      this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, skip: (p - 1) * limit, take: limit }),
      this.prisma.contactMessage.count(),
    ]);
    return { items, total, page: p, limit };
  }

  /** Platforma adminlari (rol yoki PLATFORM_ADMIN_PHONES) ning bog'langan Telegram chatlariga sendMessage. */
  private async notify(m: { id: string; name: string; contact: string; topic: string; message: string }) {
    const links = await this.prisma.telegramLink.findMany({
      where: { user: { OR: [{ memberships: { some: { roles: { hasSome: [...ADMIN_ROLES] } } } }, ...(adminPhones.length ? [{ phone: { in: adminPhones } }] : [])] } },
      select: { chatId: true },
    });
    const text = `Yangi murojaat (${m.topic})\n${m.name}, ${m.contact}\n\n${m.message}\n\nID: ${m.id}`;
    await Promise.all(
      links.map((l) =>
        fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: l.chatId.toString(), text }),
        }).catch(() => {}),
      ),
    );
  }
}
