import { Body, Controller, Get, Header, HttpCode, HttpException, Ip, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { DailyBucket, IpBucket } from '../../common/ip-bucket';
import { PlatformConfigService } from '../../common/platform-config.service';
import { TokenService } from '../identity/application/token.service';
import { optionalUserId } from '../identity/presentation/jwt.guard';
import { FAQ, HELP_LANGS, type Faq, type HelpLang } from './faq';
import { HelpLlm } from './help.llm';
import { match } from './matcher';

class AskDto {
  @IsString() @Length(1, 500) q!: string;
  @IsIn(HELP_LANGS) locale!: HelpLang;
}

const GUEST_DAILY = 10; // mehmon IP: kuniga shuncha LLM savol; lug'at javobi cheksiz
const minute = new IpBucket(30, 60_000);
const daily = new DailyBucket();
const langOf = (v: unknown): HelpLang => (HELP_LANGS as readonly string[]).includes(String(v)) ? (v as HelpLang) : 'uz';
const related = (rows: { faq: Faq }[]) => rows.map(({ faq }) => ({ id: faq.id, q: faq.q, href: faq.href }));

/** Yordam chati: avval lug'at (bepul, cheksiz), ishonch past bo'lsa LLM (kalit va kunlik chelak ichida), aks holda faqat o'xshash savollar. */
@ApiTags('help')
@Controller('help')
export class HelpController {
  constructor(private readonly tokens: TokenService, private readonly cfg: PlatformConfigService, private readonly llm: HelpLlm) {}

  /** To'liq ro'yxat: vidjetdagi boshlang'ich savollar va /help sahifasi uchun. */
  @Get('faq') @Header('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  faq(@Query('locale') locale?: string) {
    return FAQ[langOf(locale)].map(({ id, q, a, href }) => ({ id, q, a, href }));
  }

  @Post('ask') @HttpCode(200)
  async ask(@Body() dto: AskDto, @Req() req: FastifyRequest, @Ip() ip: string) {
    if (!minute.take(ip ?? '?')) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
    const m = match(dto.q, dto.locale);
    const rel = related(m.top);
    if (m.confident) return { answer: m.top[0].faq.a, source: 'faq' as const, related: rel };

    if (this.llm.enabled) {
      // Kalit: kirgan foydalanuvchi id, aks holda mehmon IP (yordamchi qidiruv bilan bir xil qoida)
      const userId = optionalUserId(req, this.tokens);
      const limit = userId ? (await this.cfg.get()).helpAskDaily : GUEST_DAILY;
      const t = daily.take(userId ? `u:${userId}` : `g:${ip}`, limit);
      // Chelak tugasa eng yaqin lug'at javobi (ishonchsiz bo'lsa ham) va "bugunga tugadi" belgisi
      if (!t.ok) return { answer: m.top[0]?.faq.a ?? null, source: 'faq' as const, related: rel, limited: true };
      const answer = await this.llm.ask(dto.q, dto.locale);
      if (answer) return { answer, source: 'llm' as const, related: rel };
    }
    return { answer: null, source: 'none' as const, related: rel };
  }
}
