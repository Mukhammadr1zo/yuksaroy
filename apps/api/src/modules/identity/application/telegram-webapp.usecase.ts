import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, type UserRepository } from '../domain/ports';
import { validateInitData } from '../domain/telegram-webapp';
import { env } from '../../../common/env';
import { TokenService } from './token.service';

export class TgInitDataError extends Error {
  constructor(public readonly code: 'TG_INITDATA_INVALID' | 'TG_INITDATA_EXPIRED') { super(code); }
}

const LOCALES = ['uz', 'ru', 'en'];

/**
 * Mini App initData -> foydalanuvchi: TelegramLink.chatId bo'yicha topiladi, bo'lmasa telefonsiz yaratiladi (needsPhone).
 * Telefon keyin bot kontakt orqali bog'lanadi (LinkTelegramUseCase).
 */
@Injectable()
export class TelegramWebAppUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository, private readonly tokens: TokenService) {}

  async execute(initData: string, ctx: { userAgent?: string; ip?: string }) {
    const v = validateInitData(initData, env.BOT_TOKEN);
    if (!v.ok) throw new TgInitDataError(v.code);
    const tg = v.user;
    const chatId = BigInt(tg.id);
    const user = (await this.users.findByTelegramChat(chatId)) ?? (await this.users.createByTelegram({
      chatId, username: tg.username ?? null,
      fullName: [tg.first_name, tg.last_name].filter(Boolean).join(' ') || null,
      locale: tg.language_code && LOCALES.includes(tg.language_code) ? tg.language_code : 'uz',
      avatarUrl: tg.photo_url ?? null,
    }));
    const pair = await this.tokens.issuePair(user.id, ctx);
    return { user, ...pair, startParam: v.startParam };
  }
}
