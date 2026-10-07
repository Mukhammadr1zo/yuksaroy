import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUserId, JwtGuard } from '../identity/presentation/jwt.guard';
import { AuditService } from '../../common/audit.service';
import { ChatService } from './chat.service';
import { NO_REPLY_ACTION } from './inquiry-status';

class MessageDto {
  // Fayl biriktirilsa matn bo'sh bo'lishi mumkin; shakl tekshiruvi common/attachments.ts da
  @IsOptional() @IsString() @MaxLength(2000) text?: string;
  @IsOptional() @IsArray() attachments?: unknown[];
}

class StartDto {
  @IsString() @Length(5, 1000) message!: string;
  @IsOptional() @IsString() orgId?: string;
  // Birinchi xabarga ham fayl ilashadi: narx so'rayotgan odam ko'pincha
  // yuk ro'yxatini yoki hujjat suratini aynan o'sha zahoti yuboradi
  @IsOptional() @IsArray() attachments?: unknown[];
}

class NoReplyDto {
  // Tred javobidagi lastMessageAt aynan qaytariladi: shu orada yangi xabar kelgan bo'lsa amal
  // bajarilmaydi. null faqat vaqti yo'q eski yozishmada; yuborilmasa null deb olinadi, ya'ni 409
  @IsOptional() @IsDateString() lastMessageAt?: string | null;
}

/** Yozishmalar: ro'yxat, tred, xabar yuborish va "Javob shart emas". */
@ApiTags('inquiries')
@Controller('inquiries')
@UseGuards(JwtGuard)
@ApiCookieAuth('ys_access')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly audit: AuditService,
  ) {}

  /** `scope=owner`: menga kelganlar; `scope=mine`: men boshlaganlarim. */
  @Get()
  list(@CurrentUserId() userId: string, @Query('scope') scope?: string) {
    return this.chat.list(userId, scope === 'mine' ? 'mine' : 'owner');
  }

  /** Obyekt sahifasida chat oynasi ochilganda avvalgi yozishma shu yerdan topiladi. */
  @Get('find')
  find(@CurrentUserId() userId: string, @Query('terminal') terminal?: string, @Query('listing') listing?: string) {
    return this.chat.findForSubject(userId, terminal, listing);
  }

  /** Chap menyudagi belgi: o'qilmagan xabarlar soni. */
  @Get('unread')
  unread(@CurrentUserId() userId: string) {
    return this.chat.unreadTotal(userId);
  }

  @Get(':id/thread')
  thread(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.chat.get(userId, id);
  }

  @Post(':id/messages')
  send(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.chat.send(userId, id, dto.text ?? '', dto.attachments);
  }

  /** "Javob shart emas": faqat qabul qiluvchi tomon, xabar yozilmaydi (egasi qarori, 2026-10-07). */
  @Post(':id/no-reply') @HttpCode(200)
  async noReply(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: NoReplyDto) {
    const r = await this.chat.noReply(userId, id, dto.lastMessageAt ? new Date(dto.lastMessageAt) : null);
    // Platforma navbatining yoshi shu qatorga qaraydi (inquiry-status.ts NO_REPLY_ACTION)
    await this.audit.log({ actorId: userId, action: NO_REPLY_ACTION, entity: 'Inquiry', entityId: id });
    return r;
  }
}

/** Terminal egasiga yozish: katalog sahifasidagi tugma shu yerga keladi. */
@ApiTags('inquiries')
@Controller()
@UseGuards(JwtGuard)
@ApiCookieAuth('ys_access')
export class TerminalInquiryController {
  constructor(
    private readonly chat: ChatService,
    private readonly audit: AuditService,
  ) {}

  @Post('terminals/:slug/inquiries')
  async start(@CurrentUserId() userId: string, @Param('slug') slug: string, @Body() dto: StartDto) {
    const i = await this.chat.startTerminal(userId, slug, dto.message, dto.orgId ?? null, dto.attachments);
    await this.audit.log({ actorId: userId, action: 'inquiry.create', entity: 'Inquiry', entityId: i.id, meta: { terminal: slug, orgId: dto.orgId ?? null } });
    return i;
  }
}
