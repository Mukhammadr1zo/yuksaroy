import { HttpException } from '@nestjs/common';
import { IpBucket } from '../../common/ip-bucket';

/**
 * Bir odam soatiga nechta yozishma (egasi qarori: ruxsat etilgan sukut qiymati, 2026-11-02).
 * Nega: sayt ichidagi xabar egasining Telegramiga ham boradi, bitta hisobdan oqim ko'p odamni
 * bezovta qiladi va chat chelagini (telegram.ts) yeb qo'yadi. Haqiqiy odam bunga yetmaydi.
 */
export const NEW_CHATS_PER_HOUR = 30;
export const MESSAGES_PER_HOUR = 120;

// Chelak foydalanuvchi id si bo'yicha (IpBucket kalitga befarq)
const newChatBucket = new IpBucket(NEW_CHATS_PER_HOUR, 3_600_000);
const messageBucket = new IpBucket(MESSAGES_PER_HOUR, 3_600_000);

/**
 * Kod CHAT_LIMIT: umumiy RATE_LIMITED emas, chunki unga fayl yuklash matni biriktirilgan (kabinet.chat.err).
 * ponytail: yangi yozishma sanog'i boshlash chaqiruvlarini sanaydi, eskisiga qo'shilgan xabar ham kiradi;
 * 30 ta chegara uchun bu farq ahamiyatsiz, aniqrog'i kerak bo'lsa xizmat ichida sanaladi.
 */
const over = () => new HttpException({ code: 'CHAT_LIMIT' }, 429);
export const takeNewChat = (userId: string) => { if (!newChatBucket.take(userId)) throw over(); };
export const takeMessage = (userId: string) => { if (!messageBucket.take(userId)) throw over(); };
