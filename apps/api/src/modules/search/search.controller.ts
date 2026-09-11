import { Body, Controller, HttpCode, Inject, Ip, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { parseQuery, type SearchLang } from '@yuksaroy/domain';
import { IpBucket } from '../../common/ip-bucket';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../catalog/domain/ports';
import { geoNear } from '../catalog/presentation/catalog.controller';
import { summarize } from '../catalog/presentation/mappers';
import { TokenService } from '../identity/application/token.service';
import { optionalUserId } from '../identity/presentation/jwt.guard';
import { Yordamchi, mergeFilters, needsLlm } from './yordamchi';

const LANGS = ['uz', 'ru', 'en'] as const;

export class ParseDto {
  @IsString() @Length(1, 300) q!: string;
  @IsOptional() @IsIn(LANGS) lang?: SearchLang;
  /** `lng,lat`: foydalanuvchi nuqtasi ("yonimda" so'zi uchun). */
  @IsOptional() @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/) near?: string;
}

const llmMinute = new IpBucket(20, 60_000); // bitta IP: daqiqasiga 20 ta LLM chaqiruvi (kunlik chelakdan tashqari)

/** Yordamchi: lug'at parseri, ishonch past bo'lsa LLM (kalit bo'lsa, kunlik limit ichida). Ochiq, mehmonlar uchun ham. */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repo: CatalogRepository,
    private readonly tokens: TokenService,
    private readonly yordamchi: Yordamchi,
  ) {}

  @Post('parse') @HttpCode(200)
  async parse(@Body() dto: ParseDto, @Req() req: FastifyRequest, @Ip() ip: string) {
    const dict = parseQuery(dto.q, { lang: dto.lang, near: geoNear(dto.near) });
    let filters = dict;
    let source: 'dictionary' | 'llm' = 'dictionary';
    let quota: { used: number; limit: number } | null = null;

    if (this.yordamchi.enabled && needsLlm(dict)) {
      // Kalit: kirgan foydalanuvchi id, aks holda mehmon IP. Mijoz sarlavhasi (X-Client-Id)
      // kalitga QO'SHILMAYDI: aks holda har xil sarlavha bilan cheksiz yangi chelak ochib,
      // Anthropic kvotasini aylanib o'tish mumkin edi.
      const userId = optionalUserId(req, this.tokens);
      const key = userId ? `u:${userId}` : `g:${ip}`;
      const t = this.yordamchi.take(key, userId ? 'user' : 'guest');
      quota = { used: t.used, limit: t.limit };
      if (t.ok && llmMinute.take(ip ?? '?')) {
        const llm = await this.yordamchi.ask(dto.q, dict.lang);
        if (llm) { filters = mergeFilters(dict, llm); source = 'llm'; }
      }
    }

    const now = new Date();
    const near = filters.near ?? undefined;
    // Hech narsa tanilmasa matn nom/manzil bo'yicha qidiruvga tushadi, aks holda q ro'yxatni bo'shatib qo'yadi
    const q = filters.chips.length ? undefined : dto.q.trim();
    const all = await this.repo.listTerminals({ region: filters.regions, service: filters.services, kind: filters.kind ?? undefined, near, q, owned: true }, now);
    const free = await this.repo.freeTodayByTerminal(all.map((t) => t.id), now);

    // /terminals va GET /v1/terminals uchun URL parametrlari
    const query: Record<string, string> = {};
    if (filters.regions.length) query.region = filters.regions.join(',');
    if (filters.services.length) query.service = filters.services.join(',');
    if (filters.kind) query.kind = filters.kind;
    if (near) { query.near = `${near.lng},${near.lat}`; query.radius = String(near.radiusKm); }
    if (q) query.q = q;

    return { filters, chips: filters.chips, query, decision: { terminals: all.length, ...summarize(all, free, near, filters.services) }, source, quota };
  }
}
