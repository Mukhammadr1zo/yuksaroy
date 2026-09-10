import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { ChatService } from './chat.service';

class MessageDto {
  @IsString() @Length(1, 2000) text!: string;
}

/** So'rov yozishmasi: mijoz va e'lon egasi. */
@ApiTags('inquiries')
@Controller('inquiries')
@UseGuards(JwtGuard)
@ApiCookieAuth('ys_access')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(':id/thread')
  thread(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.chat.get(userId, id);
  }

  @Post(':id/messages')
  send(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.chat.send(userId, id, dto.text);
  }
}
