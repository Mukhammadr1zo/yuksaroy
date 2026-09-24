import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Monorepo ildizidagi .env (dotenv'siz, Node 21.7+). Bor muhit o'zgaruvchilari ustun turadi.
for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env'), resolve(__dirname, '../../../../.env')]) {
  if (existsSync(p)) { process.loadEnvFile(p); break; }
}

/** .env dagi bo'sh qiymat = yo'q (ixtiyoriy kalitlar uchun). */
const opt = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === '' ? undefined : v), t.optional());

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  INTERNAL_SECRET: z.string().min(16),
  BOT_TOKEN: z.string().min(10),
  BOT_USERNAME: z.string().min(3),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Proksi ortida (nginx/CDN): 'true', hop soni yoki CIDR ro'yxati. Bo'sh = o'chiq (req.ip mijoz sarlavhasidan olinmaydi)
  TRUST_PROXY: opt(z.string()),
  // Prodda /docs ni ochish uchun maxfiy token (x-docs-token sarlavhasi); bo'sh bo'lsa prodda docs umuman yo'q
  DOCS_TOKEN: opt(z.string().min(16)),
  // Ixtiyoriy: Google kirish, platforma adminlari (vergulli telefonlar), yuklangan fayllar uchun ochiq manzil
  GOOGLE_CLIENT_ID: opt(z.string().min(10)),
  PLATFORM_ADMIN_PHONES: opt(z.string()),
  API_PUBLIC_URL: opt(z.string().url()),
  // Ixtiyoriy: IP dan joyni aniqlaydigan MaxMind GeoLite2 City bazasi (konteyner ichidagi yo'l).
  // Bo'sh bo'lsa tashriflar yoziladi, lekin joyi "ZZ" bo'ladi va xarita bo'sh ko'rinadi.
  GEOIP_DB: opt(z.string()),
  // Ixtiyoriy: yangi yuklar chiqadigan Telegram kanali (masalan -1001234567890 yoki @yuksaroy_yuklar).
  // Bo'sh bo'lsa post yuborilmaydi. Bot o'sha kanalda administrator bo'lishi kerak.
  TELEGRAM_CARGO_CHANNEL: opt(z.string()),
  // Eskirgan: rekvizitlar endi admin sozlamalarida (payDetails). Bu faqat zaxira:
  // sozlama bo'sh bo'lsa shu qiymat, u ham bo'sh bo'lsa murojaat formasi ko'rsatiladi
  PREMIUM_PAY_DETAILS: opt(z.string()),
  // Ixtiyoriy: Yordamchi LLM (kalit bo'lmasa faqat lug'at parseri); model va kunlik limitlar (domain YORDAMCHI standart)
  ANTHROPIC_API_KEY: opt(z.string().min(10)),
  YORDAMCHI_MODEL: opt(z.string()),
  YORDAMCHI_GUEST_DAILY: opt(z.coerce.number().int().min(0)),
  YORDAMCHI_USER_DAILY: opt(z.coerce.number().int().min(0)),
  // Ixtiyoriy: vagon qidiruvi uchun d-railway.uz xizmat hisobi; bo'lmasa bo'lim "ulanmagan" deb ko'rsatiladi
  D_RAILWAY_URL: opt(z.string().url()),
  D_RAILWAY_EMAIL: opt(z.string()),
  D_RAILWAY_PASSWORD: opt(z.string()),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
