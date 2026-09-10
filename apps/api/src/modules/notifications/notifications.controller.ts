import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { NotificationsService } from './notifications.service';

class ReadDto {
  @IsOptional() @IsArray() @IsString({ each: true }) ids?: string[];
}

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtGuard)
@ApiCookieAuth('ys_access')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query('limit') limit?: string) {
    const n = Math.min(50, Math.max(1, Number(limit) || 30));
    return this.notifications.list(userId, n);
  }

  /** ids bo'lmasa hammasi o'qilgan bo'ladi (qo'ng'iroq ochilganda). */
  @Post('read')
  read(@CurrentUserId() userId: string, @Body() dto: ReadDto) {
    return this.notifications.markRead(userId, dto?.ids);
  }
}
