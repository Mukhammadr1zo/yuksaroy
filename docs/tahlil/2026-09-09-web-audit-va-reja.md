# Web auditi va yo'l xaritasi (2026-09-09)

Interaktiv sahifa: https://claude.ai/code/artifact/5eda0dfb-839a-4690-9046-71aa40c86de8

## Audit

7 mustaqil yo'nalish (ochiq sahifalar, kabinet, uch til, SEO va keshlash, tezlik, qulaylik, xavfsizlik); har topilma alohida skeptik tekshiruvchi tomonidan tasdiqlangan yoki rad etilgan. Natija: 81 tasdiqlangan kamchilik (11 yuqori, 34 o'rta, 36 past). Hammasi oltita paketda tuzatildi.

Yakuniy holat: apps/web, apps/api, apps/bot, packages/domain uchun `tsc --noEmit` 0 xato; API 132 test yashil; 13 sahifa 1440 va 390 kenglikda konsol xatosisiz; i18n 2392 kalit uz = ru = en; `next build`, `nest build`, bot build o'tadi.

## Shu sessiyada qo'shilganlar

- Telegram bildirishnomalari: `apps/api/src/common/telegram.ts` (sendTelegram, notifyTelegram, uz/ru/en shablonlar, bitta chatga soatiga 5 xabar). Chaqiruv nuqtalari: e'longa so'rov, buyurtma yaratildi, tasdiqlandi, rad etildi, muddati o'tdi, da'vo qarori.
- Halol reyting: `REVIEW.minToShow = 3`, `ratingDisplay`; o'z terminaliga buyurtma 409 `SELF_ORDER`; bog'liq tomon sharhi `Review.excluded = true` va reytingga kirmaydi (migratsiya `20260909120000_review_excluded` qo'llangan).
- Yordamchi bosh sahifadagi qidiruvga ulandi: `app/[locale]/(public)/search/route.ts` parseQuery natijasiga qarab terminals, equipment, carriers yoki sidings ga 307 redirect qiladi.
- Bo'sh viloyat sahifalari `robots noindex` va sitemapdan tashqarida.
- Git repozitoriy va `v0.1.0` tegi (birinchi commit, `.env` kiritilmagan).

## Egasi qarori kutilayotgan takliflar

1. Kirishsiz telefon va anonim so'rov (hozirgi 1A qaroriga zid: kontakt login bilan).
2. Bron tugmasi faqat egasi tasdiqlagan terminalda (demo oqimini o'zgartiradi).
3. Buyurtmagacha tashkilot va STIR talabini olib tashlash.
4. Premium narxini bazaga chiqarish va oylar chegirmasi.
5. Rekvizit va oferta sahifasi (birinchi to'lov sharti).

Batafsil: artefaktdagi "Hozir", "Keyingi", "Kvartal", "O'zgartirish kerak" va "Qilmaymiz" bo'limlari.
