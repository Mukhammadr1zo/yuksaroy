import { Injectable } from '@nestjs/common';
import type { OtpSender } from '../domain/ports';
import { env } from '../../../common/env';

// Kod xabari uch tilda: <code> ustiga bosilganda Telegram nusxa oladi
const TEXT: Record<'uz' | 'ru' | 'en', (code: string) => string> = {
  uz: (c) => `YukSaroy kirish kodi: <code>${c}</code>

Kod 5 daqiqa amal qiladi. Uni hech kimga bermang.`,
  ru: (c) => `Код входа YukSaroy: <code>${c}</code>

Код действует 5 минут. Никому его не передавайте.`,
  en: (c) => `YukSaroy sign-in code: <code>${c}</code>

The code is valid for 5 minutes. Do not share it.`,
};

/** Telegram Bot API ga to'g'ridan-to'g'ri (Telegraf kerak emas). Bot jarayoni bilan bir xil token. */
@Injectable()
export class TelegramOtpSender implements OtpSender {
  async sendCode(chatId: bigint, code: string, locale?: string | null): Promise<void> {
    // Til foydalanuvchi profilidan keladi (request-otp uni uzatadi), bo'lmasa o'zbekcha.
    // Ilgari bu yerda o'zbekcha matn qattiq yozilgan edi: TEXT jadvali yozilgan-u ishlatilmasdi,
    // ya'ni ruscha va inglizcha foydalanuvchi ham o'zbekcha kod xabarini olardi.
    const lang = locale === 'ru' || locale === 'en' ? locale : 'uz';
    const text = `🔐 ${TEXT[lang](code)}`;
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId.toString(), text, parse_mode: 'HTML' }),
    });
    if (!res.ok) throw new Error(`TELEGRAM_SEND_FAILED ${res.status} ${await res.text()}`);
  }
}
