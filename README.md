# YukSaroy

Mustaqil logistika marketpleysi (temir yo'l yuk terminallari, shahobcha yo'llar, tariflar, onlayn band qilish). Monorepo:
`apps/api` (NestJS 11 + Fastify + Prisma 6, clean architecture), `apps/web` (Next.js 16, Tailwind v4, Motion, GSAP, MapLibre GL), `apps/bot` (Telegraf, OTP kanali), `packages/domain` (enum'lar, qoidalar).

## Ishga tushirish (dev)

```bash
cp .env.example .env        # BOT_TOKEN, BOT_USERNAME, sirlarni to'ldiring
pnpm install
pnpm db:up                  # Postgres 17 (:5434) + Redis (:6380) — 5432/6379 lokal xizmatlar band
pnpm --filter @yuksaroy/api prisma:generate
pnpm --filter @yuksaroy/api prisma:deploy     # migratsiyalar (init + catalog)
pnpm --filter @yuksaroy/api db:seed           # 298 stansiya, 270 ETSNG, 1 382 shahobcha, 6 pilot terminal, PlatformConfig
pnpm dev                    # api :4000 (docs: /docs), web :3000, bot polling
```

`.env` monorepo ildizida; api/bot uni `process.loadEnvFile` bilan o'qiydi, Prisma skriptlari `node --env-file` bilan.

### Seed manbalari (bir marta, natija repo'da: `apps/api/prisma/seed/data/*.json`)

```bash
pnpm --filter @yuksaroy/api db:build-data      # RailMap stations-2026.ts + Шахобча йўллар.xlsx + yuklar.xlsx (+ koordinatalar RailMap PostGIS :5433 dan)
pnpm --filter @yuksaroy/api db:build-railmap   # xarita: public/data/railmap.geojson (115 KB gz) + railmap-real.json + img/railmap-poster.svg
```

## Holat (S3 backend tugadi, 2026-09-07)

- **S1** identity (telefon + Telegram OTP, JWT/refresh rotation), organizations (STIR, a'zolik, rollar).
- **S2** catalog: `Station`, `CargoType` (ETSNG), `Siding` (reestr, egasi claim'gacha yashirin), `Terminal` + `TerminalService` + `Tariff` (append-only, EXCLUDE gist), `PlatformConfig`; pricing: `POST /v1/quote` (sof `calcQuote`, vitest).
- **S3** booking + orders: `TimeSlot` (terminal × kun × oyna, DB CHECK `booked+held ≤ capacity`, hold `FOR UPDATE`), `SlotBooking` (HOLD 10 daq → CONFIRMED / RELEASED), `Order` + `OrderItem` (tarif muzlatiladi) + `OrderStatusHistory` (append-only), `IdempotencyKey`. Holat-mashinasi `packages/domain` da (`assertOrderTransition`): PENDING → CONFIRMED → IN_PROGRESS → DONE, tasdiq SLA 30 daq. Muddatlar in-process sweeper bilan (30 s; ko'p instansiyada BullMQ kerak).

Asosiy endpointlar: `GET /v1/terminals/:id/slots`, `PUT /v1/terminals/:id/capacity`, `POST /v1/slots/:id/hold`, `POST /v1/holds/:id/extend`, `POST /v1/orders` (Idempotency-Key), `GET /v1/orders?scope=client|terminal`, `POST /v1/orders/:no/{confirm,reject,events,complete,cancel}`.
- Web: landing `app/page.tsx` (to'q tema, Lenis silliq scroll, scroll'da yashirinadigan nav): video hero + tez hisob → jonli katalog (eng arzon 3 tarif) va real raqamlar → terminallar xaritada (MapLibre GL: sun'iy yo'ldosh + relyef fon, real yo'llar, terminal markerlari narx bilan; scroll bilan kamera Toshkentdan butun tarmoqqa chiqadi) → 3 qadam → rollar → CTA. Qoida: ekranda faqat qaror uchun kerak bo'lgan ma'lumot (telemetriya va bezak raqamlari yo'q). Katalog sahifalari yorug': `/terminallar` (+ filtr, `/[slug]` pasport), `/shahobchalar` (+ SVG sxema), `/hisob`, `/kirish`, `/kabinet`.

### Landing media (`apps/web/public`)

Video: Pexels (Alex Kad, bepul litsenziya) → `ffmpeg-static` bilan kesilgan: `video/hero-720.mp4` (10 s, 1 MB), `video/hero-mobile.mp4` (9:16, 0,5 MB), `video/yard-720.mp4`; posterlar va seksiya kadrlari `img/*.webp`. Manba kliplar repo'da yo'q (scratchpad). Qayta kesish: `node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg.exe -ss 34 -t 10 -i sunset-1080.mp4 -an -vf "scale=1280:-2,fps=24" -c:v libx264 -crf 26 -movflags +faststart hero-720.mp4`.

Kirish oqimi: web `/kirish` → telefon → API `POST /v1/auth/otp/request` → telefon botga bog'langan bo'lsa kod Telegramga ketadi, aks holda `t.me/<bot>?start=login_<token>` → bot kontakt oladi → API `internal/telegram/link` → kod chatga → web `POST /v1/auth/otp/verify` → httpOnly cookie (access 15 daq + refresh 30 kun, rotation).

Keyingi: **S3 frontend** — 3 ekranli buyurtma vizardi (yuk → terminal+slot grid → xulosa), terminal kabineti talabnomalar navbati (SLA taymer), buyurtma timeline. Hujjatlar: `docs/tahlil/` (arxitektura tahlili v2), `docs/brand/`.
