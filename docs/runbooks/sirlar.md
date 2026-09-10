# Sirlar: qayerda turadi, almashtirilsa nima buziladi

Barcha sirlar serverdagi `/opt/yuksaroy/.env` da (chmod 600, root egasi). Git ga hech qachon kirmaydi: `.gitignore` da `.env` bor, repoda faqat `.env.example` va `deploy/.env.prod.example`.

| Sir | Qayerda ishlatiladi | Almashtirilsa nima bo'ladi |
|---|---|---|
| `JWT_SECRET` | access va refresh token imzosi, **OTP kodlari xeshi** | Hamma sessiya tugaydi va yuborilgan kirish kodlari bekor bo'ladi. Foydalanuvchi qayta kod so'raydi. |
| `INTERNAL_SECRET` | bot va API orasidagi ichki chaqiruv (`/auth/internal/telegram/link`) | Bot telefonni bog'lay olmaydi: bot va API da bir vaqtda yangilash kerak. |
| `POSTGRES_PASSWORD` | baza | `DATABASE_URL` ham yangilanmasa API ko'tarilmaydi. Konteynerni qayta yaratish kerak. |
| `BOT_TOKEN` | Telegram bot | Eski token o'lik. Dev va prod uchun **alohida bot**: bitta token ikki joyda ishlasa Telegram 409 beradi va OTP to'xtaydi. |
| `DOCS_TOKEN` | `/docs` (Swagger) | Bo'sh bo'lsa prodda hujjatlar umuman ochilmaydi (shunday bo'lgani ma'qul). |
| `GOOGLE_CLIENT_ID` | Google bilan kirish | Tugma ko'rinmaydi yoki `origin is not allowed` beradi: Google Cloud da domen ro'yxatga qo'shilishi kerak. |
| `ANTHROPIC_API_KEY` | Yordamchi qidiruvining LLM zaxirasi | Bo'sh bo'lsa lug'at asosidagi qidiruv ishlayveradi (foydalanuvchi farqni sezmaydi). |

## Yangi sir yaratish

```bash
openssl rand -base64 48
```

## Almashtirish tartibi

1. `.env` da yangilang.
2. `docker compose -f deploy/compose.prod.yml --env-file .env up -d` (faqat tegishli xizmat qayta ko'tariladi).
3. `curl -sS https://yuksaroy.uz/v1/health` va Telegramda `/start` bilan tekshiring.

## Nima qilmaslik kerak

- `.env` ni git ga qo'shish yoki chatga tashlash.
- Bitta `BOT_TOKEN` ni dev va prodda birga ishlatish.
- `JWT_SECRET` ni sababsiz almashtirish (barcha foydalanuvchi chiqib ketadi).
