import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { InternalGuard } from '../identity/presentation/internal.guard';
import { ActivityService } from './activity.service';

class BotActivityDto {
  @IsString() @Matches(/^-?\d{1,20}$/) chatId!: string;
  @IsIn(['bot.start', 'bot.help', 'bot.app', 'bot.search']) action!: 'bot.start' | 'bot.help' | 'bot.app' | 'bot.search';
  @IsOptional() @IsString() @MaxLength(64) username?: string;
  @IsOptional() @IsString() @MaxLength(64) firstName?: string;
  @IsOptional() @IsString() @MaxLength(200) text?: string;
  // 'login' yoki qisqa boshlash belgisi. Kirish tokeni bu yerga HECH QACHON kelmaydi (bot yubormaydi)
  @IsOptional() @IsString() @MaxLength(32) start?: string;
}

/** Bot -> API: botda bo'lgan, saytga tegmaydigan amallar (faqat superadminlarga xabar uchun). */
@ApiTags('activity')
@Controller('activity/internal')
@UseGuards(InternalGuard)
export class BotActivityController {
  constructor(private readonly prisma: PrismaService, private readonly activity: ActivityService) {}

  @Post('bot')
  @HttpCode(200)
  async bot(@Body() dto: BotActivityDto) {
    const link = await this.prisma.telegramLink.findUnique({ where: { chatId: BigInt(dto.chatId) }, select: { userId: true } }).catch(() => null);
    const label = dto.username ? `@${dto.username}` : dto.firstName;
    this.activity.record({
      action: dto.action,
      actorId: link?.userId ?? null,
      meta: { text: dto.text, start: dto.start },
      channel: 'bot',
      guest: link ? undefined : { key: `t:${dto.chatId}`, label },
    });
    return { ok: true };
  }
}
