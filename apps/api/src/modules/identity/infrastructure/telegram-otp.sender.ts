import { Injectable } from '@nestjs/common';
import type { OtpSender } from '../domain/ports';
import { env } from '../../../common/env';

/** Telegram Bot API ga to'g'ridan-to'g'ri (Telegraf kerak emas). Bot jarayoni bilan bir xil token. */
@Injectable()
export class TelegramOtpSender implements OtpSender {
  async sendCode(chatId: bigint, code: string): Promise<void> {
    const text = `🔐 YukSaroy kirish kodi: <b>${code}</b>\n\nKod 5 daqiqa amal qiladi. Uni hech kimga bermang.`;
    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId.toString(), text, parse_mode: 'HTML' }),
    });
    if (!res.ok) throw new Error(`TELEGRAM_SEND_FAILED ${res.status} ${await res.text()}`);
  }
}
