# YukSaroy — Frontend arxitekturasi (Staff Frontend Architect lens)

Manba holati: kontekst fayli (konsepsiya, SLA, demo IA), VagonFlow `package.json` (next 16.2.9, react 19.2.4, tailwindcss 4.3, radix-ui 1.6, shadcn `components.json` new-york/lucide, recharts 3.9, zod 4.4, vitest 4.1), `src/lib/i18n/translit.ts`, `src/lib/railmap/client.ts` (railmap.d-railway.uz API), `middleware.ts` (Edge, signature-only). 2026 faktlari WebSearch bilan tekshirildi (manbalar oxirida).

---

## 1. Stack qarori

**Qaror: Next.js 16.3 (App Router) + React 19.2 + TypeScript 5.9, `cacheComponents: true`, `reactCompiler: true`, `proxy.ts`.**

Nima uchun VagonFlow bilan bir xil stack muhim:
- **Kod ko'chirish nolga yaqin.** `translit.ts`, `date-fmt.ts`, `phone.ts`, `auth/session.ts` (jose JWT), `railmap/client.ts`, `push/fcm.ts` — bular YukSaroy'ga to'g'ridan-to'g'ri `packages/` ga ko'chadi. Boshqa framework'da har birini qayta yozish 2–3 hafta.
- **Integratsiya bir tilda.** YukSaroy buyurtmasi → VagonFlow `Request` (vagon talabnomasi) zanjiri. Ikkala tomonda ham zod sxemalar, Prisma enumlar (`Direction`, `LifecycleStage`, `Siding`) — `packages/domain-types` ikkala repo'ga ulanadi.
- **Bitta deploy shabloni.** docker-compose + nginx + `d-railway.uz` subdomen amaliyoti tayyor; DevOps xarajati oshmaydi.
- **2026 holati (tekshirildi):** Next.js 16 da PPR stabil va `cacheComponents` orqali default, `use cache` + `cacheTag/updateTag` — bu katalog sahifalari uchun aynan kerak. 16.3: build disk-cache default, dev RAM 90% gacha kam, "Instant Navigations", TypeScript 7 qo'llab-quvvatlash. React Compiler 1.0 (2025-10) ishlab chiqarishga tayyor — `useMemo/useCallback` qo'lda yozilmaydi. `middleware.ts` → `proxy.ts` (Node runtime; Edge varianti deprecated).

Alternativalar va rad etish sababi:

| Variant | Kuchli tomoni | Nega yo'q |
|---|---|---|
| React Router 7 (Remix) framework mode | Sodda loader/action modeli, Vite | PPR/`use cache` yo'q; VagonFlow kodi ko'chmaydi; jamoa tajribasi yo'q |
| Vite SPA (+ TanStack Router) | Eng yengil dev loop | Katalog/terminal pasporti SEO (Google/Yandex indeks) talab qiladi — SPA'da pre-render qo'shimcha infra; RSC yo'q |
| Nuxt 4 | Yaxshi DX | Vue — jamoa React'da; kod ulashish 0% |
| Astro (faqat landing) | Statik, eng tez LCP | Alohida repo/dizayn tizimi — 9-bo'limda "landing shu app ichida" qarori bilan bekor bo'ladi |

---

## 2. Monorepo: pnpm 11 + Turborepo 2.x

Nega monorepo: `web` + `mobile` (Expo) + `bot` bir xil zod sxemalar, i18n va tokenlarni ishlatadi. pnpm `catalog:` versiya driftini yo'qotadi. Turborepo 2.x `tasks` (1.x `pipeline` emas) + remote cache.

Qaror: **admin alohida app EMAS** — `(adm)` route group `apps/web` ichida (bir xil auth, bir xil DB, bir xil dizayn). Alohida app faqat deploy ritmi ajralganda (F3+). **landing ham `apps/web` ichida** — 9-bo'limda asoslanadi.

```
yuksaroy/
├── pnpm-workspace.yaml            # packages: apps/*, packages/*; catalog: next, react, zod...
├── turbo.json                     # tasks: build, dev, lint, typecheck, test, e2e
├── package.json                   # scripts: turbo run ...; engines node>=24
├── .github/workflows/ci.yml       # lint+typecheck+test+build+lhci (10-bo'lim)
├── docker-compose.yml             # db, app(web), bot, backup — VagonFlow'dan
├── apps/
│   ├── web/                       # Next.js 16.3 — landing + marketplace + kabinetlar
│   │   ├── next.config.ts         # cacheComponents, reactCompiler, serwist, headers
│   │   ├── proxy.ts               # sessiya imzosi tekshiruvi + lang cookie (VagonFlow middleware porti)
│   │   ├── instrumentation.ts     # OTel/Sentry
│   │   ├── public/
│   │   │   ├── hero/terminal-loop.{av1.mp4,h264.mp4,webm}  # 6–8 s, ≤1.5 MB
│   │   │   ├── hero/poster.webp   # LCP elementi
│   │   │   ├── models/wagon.glb   # draco, ≤60 KB
│   │   │   ├── fonts/             # Manrope, Unbounded, JetBrains Mono (latin+cyrillic subset)
│   │   │   └── manifest.webmanifest
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx             # html lang, fonts, ThemeProvider, NextIntlClientProvider
│   │   │   │   ├── globals.css            # @import "@yuksaroy/ui/tokens.css"
│   │   │   │   ├── sw.ts                  # Serwist service worker manbasi
│   │   │   │   ├── (marketing)/           # ochiq sahifalar, PPR statik qobiq
│   │   │   │   │   ├── layout.tsx         # MarketingHeader/Footer
│   │   │   │   │   ├── page.tsx           # landing: <Hero/> + katalog preview
│   │   │   │   │   ├── terminallar/page.tsx
│   │   │   │   │   ├── terminallar/[slug]/page.tsx   # terminal pasporti, "use cache" + cacheTag
│   │   │   │   │   ├── xarita/page.tsx    # MapLibre, dynamic import
│   │   │   │   │   ├── aktivlar/page.tsx  # vagon/teplovoz/shahobcha bozori
│   │   │   │   │   ├── aktivlar/[id]/page.tsx
│   │   │   │   │   ├── elonlar/page.tsx
│   │   │   │   │   ├── mutaxassislar/page.tsx
│   │   │   │   │   ├── portlar/page.tsx
│   │   │   │   │   ├── malumotnoma/[kind]/page.tsx   # tarozilar | yol-servislari | terminallar
│   │   │   │   │   ├── vakansiyalar/page.tsx
│   │   │   │   │   └── tekshir/[code]/page.tsx       # QR orqali hujjat haqiqiyligi
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── kirish/page.tsx    # telefon + SMS (VagonFlow /kirish porti)
│   │   │   │   │   ├── royxat/page.tsx    # STIR → reestrdan avto-to'ldirish
│   │   │   │   │   └── rol-tanlash/page.tsx
│   │   │   │   ├── (ship)/kabinet/        # yuk egasi / logist / ekspeditor
│   │   │   │   │   ├── layout.tsx         # requireRole(['SHIPPER','LOGIST','FORWARDER']) + CabinetShell
│   │   │   │   │   ├── page.tsx           # dashboard
│   │   │   │   │   ├── buyurtma/yangi/page.tsx       # OrderWizard (5 qadam)
│   │   │   │   │   ├── buyurtmalar/page.tsx
│   │   │   │   │   ├── buyurtmalar/[no]/page.tsx     # status timeline + SSE
│   │   │   │   │   ├── kuzatuv/page.tsx   # vagon/fura lokatsiyasi
│   │   │   │   │   ├── ty-kod/page.tsx    # TY kod arizasi + balans
│   │   │   │   │   ├── tolovlar/page.tsx  # to'lov, rassrochka jadvali
│   │   │   │   │   ├── hujjatlar/page.tsx # stol uslug buyurtmalari
│   │   │   │   │   ├── xatlar/page.tsx    # stansiya boshlig'iga xatlar ro'yxati
│   │   │   │   │   ├── xatlar/yangi/page.tsx         # LetterBuilder (oxirgi talab)
│   │   │   │   │   ├── xatlar/[id]/page.tsx          # PDF preview + holat
│   │   │   │   │   ├── elonlarim/page.tsx
│   │   │   │   │   └── aktivlarim/page.tsx
│   │   │   │   ├── (term)/terminal/       # terminal operatori
│   │   │   │   │   ├── layout.tsx         # requireRole(['TERMINAL'])
│   │   │   │   │   ├── talabnomalar/page.tsx         # 30 daqiqalik SLA taymer
│   │   │   │   │   ├── slotlar/page.tsx   # SlotGrid boshqaruvi
│   │   │   │   │   ├── tariflar/page.tsx
│   │   │   │   │   ├── pasport/page.tsx   # terminal anketasi
│   │   │   │   │   ├── vakansiyalar/page.tsx
│   │   │   │   │   └── tushum/page.tsx
│   │   │   │   ├── (station)/stansiya/    # stansiya boshlig'i (yangi rol, oxirgi talab)
│   │   │   │   │   ├── layout.tsx         # requireRole(['STATION_CHIEF'])
│   │   │   │   │   ├── xatlar/page.tsx    # kelgan murojaatnomalar
│   │   │   │   │   └── ruxsatlar/page.tsx # ruxsat raqami → DSP topshirig'i
│   │   │   │   ├── (pro)/mutaxassis/      # ekspeditor/deklarant lentasi
│   │   │   │   ├── (owner)/egam/          # vagon/teplovoz/shahobcha egasi: rozilik, ijara
│   │   │   │   ├── (adm)/boshqaruv/
│   │   │   │   │   ├── layout.tsx         # requireRole(['ADMIN','MODERATOR'])
│   │   │   │   │   ├── analitika/page.tsx
│   │   │   │   │   ├── reyting/page.tsx
│   │   │   │   │   ├── mijozlar/page.tsx  # 18 428 reestr, TanStack Table + virtual
│   │   │   │   │   ├── terminallar/page.tsx
│   │   │   │   │   ├── moderatsiya/page.tsx          # e'lon/aktiv tasdiqlash
│   │   │   │   │   └── nizolar/page.tsx
│   │   │   │   └── api/                   # Route Handlers — REST, zod, mobil+bot ham ishlatadi
│   │   │   │       ├── auth/{check-phone,otp,login,logout}/route.ts
│   │   │   │       ├── terminals/route.ts, terminals/[slug]/route.ts
│   │   │   │       ├── slots/route.ts     # GET bandlik, POST hold (90 s TTL)
│   │   │   │       ├── orders/route.ts, orders/[no]/route.ts
│   │   │   │       ├── letters/route.ts, letters/[id]/{pdf,docx}/route.ts
│   │   │   │       ├── events/route.ts    # SSE (5-bo'lim)
│   │   │   │       ├── push/subscribe/route.ts
│   │   │   │       └── webhooks/vagonflow/route.ts
│   │   │   ├── features/                  # domen bo'yicha (sahifa emas)
│   │   │   │   ├── order/{OrderWizard.tsx,PriceBreakdown.tsx,useSlotHold.ts,schema.ts}
│   │   │   │   ├── slots/{SlotGrid.tsx,useSlotStream.ts}
│   │   │   │   ├── catalog/{TerminalCard.tsx,TerminalFilters.tsx,CatalogMap.tsx}
│   │   │   │   ├── letters/{LetterBuilder.tsx,LetterPreview.tsx,WagonNumbersInput.tsx}
│   │   │   │   ├── assets/{AssetCard.tsx,SidingMap.tsx}
│   │   │   │   ├── hero/{Hero.tsx,HeroVideo.tsx,HeroScene.tsx(dynamic)}
│   │   │   │   └── tracking/{WagonTrack.tsx,EtaBadge.tsx}
│   │   │   ├── lib/{auth,query-client.ts,sse.ts,idempotency.ts,format.ts}
│   │   │   └── i18n/{request.ts,navigation.ts}      # next-intl config
│   │   ├── e2e/{order.spec.ts,slot-conflict.spec.ts,letter.spec.ts,a11y.spec.ts}
│   │   └── vitest.config.ts
│   ├── mobile/                    # Expo SDK 56 / RN 0.85 — haydovchi + logist (F2)
│   │   ├── app/(driver)/, app/(logist)/  # expo-router
│   │   └── package.json           # @yuksaroy/api-client, @yuksaroy/i18n, @yuksaroy/domain-types
│   └── bot/                       # Telegraf — VagonFlow bot patterni, @yuksaroy/api-client
├── packages/
│   ├── ui/                        # shadcn asosidagi komponentlar + tokenlar
│   │   ├── src/tokens.css         # @theme — 4-bo'lim
│   │   ├── src/components/{button,badge,card,dialog,sheet,table,tabs,...}.tsx
│   │   ├── src/patterns/{StatusPill,SlaTimer,MoneyText,EmptyState,DataTable}.tsx
│   │   └── components.json        # shadcn registry alias → @yuksaroy/ui
│   ├── config/{eslint,tsconfig,prettier}/
│   ├── api-client/                # fetch wrapper + zod javob sxemalari; web/mobile/bot uchun bitta
│   │   └── src/{client.ts,orders.ts,slots.ts,letters.ts,terminals.ts}
│   ├── domain-types/              # enumlar + zod: OrderStatus, SlotState, Role, AssetCategory, LetterStatus
│   ├── i18n/                      # messages/{uz,oz,ru,en}.json + translit.ts (VagonFlow porti) + format.ts
│   └── railmap/                   # ESR JSON → GeoJSON, resolveStation, distance (VagonFlow porti)
└── docs/adr/                      # 0001-stack.md, 0002-sse.md, 0003-shadcn.md ...
```

---

## 3. Route xaritasi va auth guard

Rol → shell → URL prefiksi (locale prefiksi YO'Q, cookie orqali — VagonFlow bilan bir xil):

| Rol (JWT `roles[]`) | Shell | Prefiks | Asosiy sahifalar |
|---|---|---|---|
| mehmon | MarketingShell (header + footer, shaffof → qattiq scroll'da) | `/` | `/terminallar`, `/terminallar/[slug]`, `/xarita`, `/aktivlar`, `/elonlar`, `/mutaxassislar`, `/portlar`, `/malumotnoma/*`, `/vakansiyalar`, `/tekshir/[code]` |
| SHIPPER / LOGIST / FORWARDER | CabinetShell (sidebar 12 band — demo `NAVS.ship`) | `/kabinet` | `/buyurtma/yangi`, `/buyurtmalar/[no]`, `/kuzatuv`, `/ty-kod`, `/tolovlar`, `/hujjatlar`, `/xatlar/yangi`, `/elonlarim`, `/aktivlarim` |
| TERMINAL | CabinetShell (`NAVS.term`) | `/terminal` | `/talabnomalar`, `/slotlar`, `/tariflar`, `/pasport`, `/vakansiyalar`, `/tushum` |
| STATION_CHIEF | CabinetShell (2 band) | `/stansiya` | `/xatlar`, `/ruxsatlar` |
| ASSET_OWNER | CabinetShell | `/egam` | `/aktivlar`, `/roziliklar` (shahobcha egasi "qarshi emasman") |
| FORWARDER/DECLARANT (pro) | CabinetShell | `/mutaxassis` | `/lenta`, `/buyurtmalarim` |
| DRIVER | mobil (Expo); web fallback | `/haydovchi` | `/reyslar` |
| ADMIN / MODERATOR | AdminShell (`NAVS.adm` + moderatsiya) | `/boshqaruv` | `/analitika`, `/reyting`, `/mijozlar`, `/terminallar`, `/moderatsiya`, `/nizolar` |

Guard 2 qatlam (VagonFlow'dagi isbotlangan sxema):
1. `proxy.ts` — faqat sessiya imzosi bor/yo'qligi (`verifySession` jose). `matcher: ['/kabinet/:path*','/terminal/:path*','/stansiya/:path*','/egam/:path*','/mutaxassis/:path*','/boshqaruv/:path*','/api/((?!auth|terminals|events/public).*)']`. Sessiyasiz → `/kirish?next=`. Node runtime — DB o'qish mumkin, lekin qilmaymiz (tezlik).
2. Har route-group `layout.tsx` da `await requireRole([...])` — JWT claim'dan; noto'g'ri rol → `/rol-tanlash`. API'da `requireRoleApi()` — 403 JSON.

Ko'p rolli akkaunt: `activeRole` cookie; `RoleSwitcher` header'da. Nega URL'da rol prefiksi (`/kabinet`, `/terminal`): deep-link push'dan to'g'ridan-to'g'ri ochiladi, tahlil (analytics) oson, layout'lar bir-biriga aralashmaydi. Alternativa — bitta `/app` + rolga qarab render: sidebar mantiqi murakkablashadi, cache ajratib bo'lmaydi.

---

## 4. Dizayn tizimi

**Tailwind v4 `@theme`** (`packages/ui/src/tokens.css`) — demo palitrasi asos, OKLCH'ga o'tkazilmaydi (mavjud HEX'lar sinalgan; OKLCH faqat yangi gradient tokenlar uchun):

```css
@theme {
  --color-navy: #0D1C2F;  --color-navy-ink: #EAF1F8;
  --color-teal: #0E9384;  --color-teal-ink: #0B7568;  --color-teal-soft: #DFF1EE;
  --color-amber: #C77E1E; --color-amber-soft: #F7EDDA; --color-amber-text: #8F5A12; /* AA matn uchun */
  --color-ink: #132539;   --color-muted: #5B6E82;  --color-faint: #6B7F93;
  --color-surface: #FFFFFF; --color-good: #2E7D32; --color-warn: #B26A00; --color-bad: #B3372F;
  --font-display: "Unbounded", system-ui;  --font-sans: "Manrope", system-ui;  --font-mono: "JetBrains Mono", monospace;
  --radius-card: 14px; --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgb(13 28 47 / .06), 0 8px 24px rgb(13 28 47 / .08);
  --ease-out-expo: cubic-bezier(.16,1,.3,1);
}
.dark { --color-navy:#122A44; --color-teal:#2FC2B0; --color-amber:#E0A24A; --color-ink:#E6EDF5; --color-surface:#111E2E; ... }
```
Muhim: `#C77E1E` oq fonda kontrast ≈3.3:1 — matnga yaramaydi (AA 4.5:1); shu uchun `amber-text` alohida. `Unbounded` faqat H1/H2 va raqamlar (KPI) uchun — 2 og'irlik (600/800), qolgani Manrope.

**Komponent kutubxonasi solishtiruvi:**

| | shadcn/ui (Radix) | HeroUI v3 | Radix Primitives yalang'och |
|---|---|---|---|
| Egalik | kod sizniki, registry orqali yangilanadi | npm paket, ko'rinish o'rnatilgan | kod sizniki, stil 0 |
| Holat 2026 | Tailwind v4 default, OKLCH, VagonFlow'da allaqachon (`components.json` new-york) | **beta**, "breaking changes kutiladi", v2→v3 migratsiya yo'q | stabil |
| a11y | Radix (yaxshi) | React Aria (eng kuchli) | Radix |
| Brend moslash | to'liq | tema o'zgaruvchilari orqali, "HeroUI ko'rinishi" qoladi | to'liq, lekin hammasi qo'lda |
| Xavf | past | beta API sinishi, kichik ekotizim | vaqt sarfi |

**Tavsiya: shadcn/ui** — `packages/ui` ga `components.json` bilan; VagonFlow'dagi 15 ta `ui/*` fayl to'g'ridan-to'g'ri ko'chadi. HeroUI v3 stabil bo'lganda ham o'tish sababi yo'q: "lol qoldiradigan" UI kutubxonadan emas, tokenlar + motion + hero'dan keladi. Radix yalang'och — shadcn minus 2 hafta.

Qolgan tanlovlar:
- **Ikonlar:** lucide-react (VagonFlow bilan bir xil). Domen ikonlari (vagon, teplovoz, kran, shahobcha) — 12 ta custom SVG `packages/ui/src/icons/` — lucide'da yo'q.
- **Jadval:** TanStack Table v8 (headless) + `@tanstack/react-virtual` — `/boshqaruv/mijozlar` 18 428 qator. `DataTable` pattern: `columns`, `data`, `sorting`, `columnFilters`, `rowSelection`, `onRowClick`, `virtual?: boolean`.
- **Forma:** react-hook-form 7 + zod 4 (`@hookform/resolvers` v5). Sxema `packages/domain-types` da — server Route Handler o'sha sxema bilan tekshiradi (bitta manba).
- **Sana/slot:** kutubxona YO'Q. `<input type="date" min max>` (mobilda native picker, a11y bepul) + `SlotGrid` (kun × 6 slot matritsa, `SLOTS` demo'dan). Davr (dan–gacha) — ikkita `date` input. Alternativa react-day-picker — faqat "bir nechta kun bir vaqtda ko'rish" talabi paydo bo'lsa (`/terminal/slotlar` haftalik ko'rinish uchun F2'da, ehtimol).
- **Xarita:** MapLibre GL JS 6.x + `@vis.gl/react-maplibre`. Tile: Protomaps PMTiles o'z serverda (`/tiles/uz.pmtiles`, ~300 MB O'zbekiston; API key yo'q, stansiyalarda cache-first). Qatlamlar: `stations` (ESR JSON → GeoJSON Point, `ecpCode`), `sidings` (LineString, `railmapId` bilan VagonFlow `Siding` ga bog'lanadi), `terminals` (Point, bandlik rangi teal→amber→bad). Demo'dagi SVG `spurMap` — `SidingMap` komponentiga aylanadi (schematic rejim, xarita yuklanmasa fallback).
- **Diagrammalar:** recharts 3 (VagonFlow'da bor, 12 ta chart kifoya). ECharts faqat `/boshqaruv/analitika` da bandlik heatmap (365 kun × 24 terminal) uchun, `next/dynamic` bilan, `echarts/core` à la carte (~120 KB gz). Ikkalasi bir sahifada bo'lmaydi.

---

## 5. Ma'lumot qatlami

**Qaror: gibrid — RSC + `use cache` ochiq sahifalar uchun; TanStack Query v5 + REST Route Handlers kabinetlar uchun; Server Actions faqat cookie/afzalliklar uchun.**

Nima uchun REST (Route Handlers), Server Actions yoki tRPC emas: mobil (Expo) va Telegram bot bir xil endpoint'larni ishlatadi; Server Actions faqat web uchun; tRPC — VagonFlow'da yo'q, bot/mobil uchun qo'shimcha adapter. `packages/api-client` zod sxemalar bilan tiplashtiradi — tRPC'ning 80% foydasi, 0 yangi runtime.

Kesh strategiyasi:
- `/terminallar`, `/terminallar/[slug]`, `/aktivlar`: `"use cache"` + `cacheTag('terminal:'+slug)`, `cacheLife('hours')`; terminal pasportini yangilasa → `updateTag`. PPR: qobiq statik, "bandlik %" va "bugungi bo'sh slotlar" — `<Suspense>` ichida dinamik.
- Kabinet: `getQueryClient()` — serverda har so'rovga yangi, brauzerda singleton; `HydrationBoundary` + prefetch (v5.40+ pending query dehydrate). `staleTime: 60_000` default (aks holda mount'da darhol refetch). Kalitlar: `['orders', {role, status}]`, `['slots', terminalId, date]`, `['letter', id]`.
- Optimistik yangilanish: slot tanlash — `useSlotHold`: mutation `POST /api/slots/hold` (90 s TTL server tomonda), `onMutate` slot'ni `held` qiladi, 409 → rollback + toast "Slot band qilindi — boshqasini tanlang". Terminal `decide()` (tasdiqlash/rad) — optimistik status pill, xato → qaytarish.
- Idempotency: har `POST /api/orders` `Idempotency-Key: uuid` (offline navbat uchun ham, 7-bo'lim).

**Real-time: SSE** (`GET /api/events?topics=slots:3:2026-09-04,order:YS-1041`). Nega WebSocket emas: oqim bir tomonlama (server → mijoz), nginx orqali sozlamasiz o'tadi, brauzer avtomatik reconnect (`Last-Event-ID`), alohida socket-server jarayoni yo'q (1 GB VPS). Server: Postgres `LISTEN/NOTIFY` → Route Handler `ReadableStream`. WebSocket faqat chat/nizo modulida (F3) kerak bo'lsa. Fallback: SSE 3 marta uzilsa → TanStack `refetchInterval: 15_000`.

---

## 6. i18n

**next-intl 4, i18n routing'siz** (`src/i18n/request.ts` `lang` cookie'dan o'qiydi; VagonFlow `LANG_COOKIE` bilan bir xil nom). Locale kodlari VagonFlow bilan bir xil: `uz` (Lotin, manba), `oz` (Kirill), `ru`, `en`. Til almashtirish — Server Action `setLocale()` → cookie + `revalidatePath('/')`. Nega prefiks yo'q: 4 locale × har URL = SEO uchun ijobiy, lekin VagonFlow/mobil/bot deep-link'lar bilan mos kelmaydi; katalogda `hreflang` o'rniga `?lang=` query bilan indeks — kifoya (Yandex/Google cookie'ni indekslamaydi, shuning uchun terminal pasporti sahifasida `generateMetadata` `alternates` orqali `?lang=oz|ru|en` ko'rsatiladi).

Transliteratsiya strategiyasi:
- **UI xabarlari:** faqat `uz.json` qo'lda yoziladi; `oz.json` build-oldi skript `pnpm i18n:oz` = VagonFlow `translit.ts` (Kirill→Lotin) **teskari yo'nalishda emas** — Lotin→Kirill avtomat noaniq (e/ye, s/ц, o'/ў). Shuning uchun manba `oz` (Kirill) qilib, `uz` generatsiya qilinadi: `translit(oz, exceptions)`; `exceptions` lug'ati (`packages/i18n/exceptions.json`: "СВХ→SVX", "ГУ-29→GU-29", "ЎТЙ→O'TY"). Diff PR'da ko'rib chiqiladi, commit qilinadi — runtime translit yo'q.
- **Foydalanuvchi kontenti** (terminal nomi, e'lon matni): kiritilgan alifboda saqlanadi (`textScript: 'cyrl'|'latn'` ustuni), ko'rsatishda locale `uz` bo'lsa va matn Kirill bo'lsa → `translit()` on-the-fly (pure, tez); Kirill'ga teskari — ko'rsatilmaydi, asl holida qoladi. Stansiya nomlari — VagonFlow `Station.nameUz/Oz/Ru/En` dan tayyor.
- **Format:** `formatSum(2140000)` → `2 140 000 so'm` (U+202F ingichka bo'shliq, `oz` da "сўм", `ru` "сум", `en` "UZS"); `Intl.NumberFormat('uz')` chiqishi barqaror emas — o'z funksiya. Sana `dd.MM.yyyy HH:mm`, timezone qat'iy `Asia/Tashkent` (server `TZ` env + client `Intl` bilan tekshirish) — slot 08:00 hech qachon 03:00 bo'lib ko'rinmasin. Telefon `+998 90 123 45 67` — VagonFlow `phone.ts`.

---

## 7. PWA / offline / push

Stansiyalarda 2G–3G va uzilishlar — talab: kabinet ochilishi, buyurtma tuzish va statusni ko'rish internetsiz ham ishlasin.

- **Serwist** (`@serwist/next`; next-pwa 2023 da arxivlangan). `sw.ts`: precache app-shell; runtime: `/api/terminals*` stale-while-revalidate 1 soat; `/tiles/*` cache-first 30 kun (limit 200 MB); `/api/orders*` network-first, 3 s timeout → cache. Dev'da o'chiq (Turbopack).
- **Ma'lumot:** `@tanstack/query-persist-client` + IndexedDB (`idb-keyval`) — so'nggi buyurtmalar, slotlar, terminal pasportlari offline ko'rinadi ("oxirgi yangilanish 14:32" belgisi).
- **Offline mutatsiya:** TanStack `onlineManager` + `mutationCache` pauza; buyurtma yaratilsa `clientOrderId` bilan navbatga tushadi, ulanish qaytganda `Idempotency-Key` bilan yuboriladi. Slot hold offline'da **taqiqlanadi** (band bo'lgan bo'lishi mumkin) — UI: "Slot tanlash uchun internet kerak". Background Sync API — faqat Chromium, tayanmaymiz.
- **Push:** web — VAPID Web Push (`web-push` server), obuna `POST /api/push/subscribe`; mobil — Expo Notifications (FCM/APNs); jadval VagonFlow `DeviceToken` bilan bir xil shakl (`platform: 'web'|'android'|'ios'`). Hodisalar: `order.confirmed`, `slot.reminder(-2h)`, `wagon.approaching(24h)`, `letter.approved`, `sla.breach` (terminal uchun 20-daqiqada ogohlantirish).
- iOS: Web Push faqat "Ekranga qo'shilgan" PWA'da — `InstallPrompt` komponenti Safari uchun yo'riqnoma ko'rsatadi.

---

## 8. Hujjat ko'rish / generatsiya

| Hujjat | Generator | Sabab |
|---|---|---|
| Stansiya boshlig'iga xat, dalolatnoma, hisob-faktura, rozilik (`qarshi emasman`) | `@react-pdf/renderer` (server, Route Handler) — React komponent → PDF, Manrope Cyrillic shrift embed | Layout kodda, i18n bilan bir xil, brauzersiz |
| Stansiya xati `.docx` (foydalanuvchi talab qildi) | `docx` npm — `LetterDocx.ts` shablon: blank, vagonlar jadvali, rozilik bloki, ERI joyi, QR | Stansiya idorasi Word'da tahrirlaydi |
| GU-29, SMGS, GU-12 (qat'iy blanklar) | `pdf-lib` — oldindan chizilgan PDF formaga maydon to'ldirish | Piksel-aniq rasmiy shakl, qo'lda chizish yo'q |
| Excel eksport | `xlsx` (VagonFlow `export-excel.ts`) | Tayyor |

Ko'rish: `<iframe src="/api/letters/[id]/pdf#toolbar=0">` — brauzer native viewer (pdf.js 1.5 MB yuklanmaydi); mobil Safari `object` fallback + "Yuklab olish". `LetterPreview` — PDF'gacha jonli HTML ko'rinish (demo `letter()` funksiyasi) — foydalanuvchi to'ldirganda darhol o'zgaradi; PDF faqat "Yuborish" bosilganda. QR → `/tekshir/[code]` sahifasi (hujjat holati, imzo vaqti). Puppeteer/Chromium HTML→PDF — 1 GB VPS'da rad (RAM).

---

## 9. 3D/video hero

**Qaror: landing `apps/web` ichida, `(marketing)` route group.** Sabab: bitta domen `yuksaroy.uz`, tokenlar/i18n/header bir xil, katalog kartalari landing'da ham (SSR), alohida deploy ortiqcha. Alohida app faqat marketing jamoasi CMS/Astro talab qilsa.

Hero qatlamlari (pastdan yuqoriga):
1. `poster.webp` (1600×900, ~80 KB, `priority`, `fetchPriority="high"`) — **LCP elementi shu**, video emas.
2. `<video autoplay muted loop playsInline preload="metadata" poster>` — `av1.mp4` → `h264.mp4` → `webm`; 6–8 s, 1280p, ≤1.5 MB; `IntersectionObserver` — ko'rinmasa pauza; `prefers-reduced-motion` yoki `navigator.connection.saveData` → video umuman yuklanmaydi.
3. `HeroScene` — React Three Fiber 9 + drei (`next/dynamic({ ssr: false })`): past-poligonli vagon + kran GLB (draco, ≤60 KB), scroll'ga bog'liq kamera (`useScroll`), teal rim-light. Yuklash sharti: `requestIdleCallback` + `hardwareConcurrency >= 4` + `!saveData` + viewport ≥ 768 px; aks holda faqat CSS parallax (2-qatlam). Byudjet: three core ~150 KB + r3f ~30 KB + drei subset ~40 KB ≈ **≤250 KB gz**, alohida chunk, LCP'ga ta'sir qilmaydi.
4. Matn + CTA (`Unbounded` H1, `StatCounter` ×4: terminallar, mijozlar 18 428, slotlar, stansiyalar) — RSC, statik.

Alternativalar: Spline embed — iframe + 1 MB+, brend nazorati yo'q; Rive — logo animatsiyasi uchun ha (`.riv` ~20 KB, `@rive-app/react-canvas`), sahna uchun yo'q; Lottie — 2D, "3D effekt" talabini bermaydi.

---

## 10. Performance byudjeti, testlar, a11y, CI

Byudjet (`lighthouserc.json` + `budgets.json`, CI'da bloklaydi):

| Metrika | Landing (4G, Moto G4 profil) | Kabinet |
|---|---|---|
| LCP | ≤ 2.0 s | ≤ 2.5 s |
| INP | ≤ 200 ms | ≤ 200 ms |
| CLS | ≤ 0.05 | ≤ 0.05 |
| JS boshlang'ich (gz) | ≤ 120 KB (3D chunk alohida, lazy) | ≤ 180 KB |
| Xarita chunk | ≤ 220 KB (MapLibre) lazy | — |
| Shriftlar | 3 oila × 2 og'irlik, `font-display: swap`, subset latin+cyrillic ≤ 140 KB | |

Testlar:
- **vitest 4** (VagonFlow'da bor): `calcSum()` narx formulasi, `translit()`, zod sxemalar, `slot-hold` TTL mantiqi, `formatSum`. Komponent — React Testing Library faqat `SlotGrid`, `PriceBreakdown`, `LetterBuilder` (mantiq bor joylar).
- **Playwright**: `order.spec` (katalog → 5 qadam → tasdiq), `slot-conflict.spec` (2 kontekst bir slot → biri 409), `letter.spec` (xat → PDF 200 + docx), `a11y.spec` (`@axe-core/playwright`, 8 sahifa, 0 serious), 4 locale smoke. CI'da `next build` → `next start` → Playwright.
- **Storybook — hozircha YO'Q** (ponytail): dev-only `/dev/ui` route `packages/ui` galereyasi. Dizayner qo'shilsa Storybook 9.
- **a11y:** `eslint-plugin-jsx-a11y`, `focus-visible` tokeni, kontrast AA (4-bo'lim amber), barcha StatusPill'da matn (rang yolg'iz emas), SlotGrid klaviatura (`role=grid`, arrow), `aria-live` SLA taymer.
- **CI (`turbo run`)**: `lint` → `typecheck` (`tsc --noEmit`, VagonFlow'dagi `ignoreBuildErrors` VPS sababli; CI tekshiradi) → `test` → `build` (`@next/bundle-analyzer` JSON → byudjet skripti) → `e2e` → `lhci autorun` (landing, `/terminallar`, `/kabinet` mock). Remote cache Turborepo.

---

## 11. Muhim komponentlar (34)

`packages/ui` (umumiy):
1. `Button` — `variant: primary|secondary|ghost|danger`, `size`, `loading`, `icon`.
2. `StatusPill` — `status: OrderStatus|SlotState|LetterStatus` → rang+ikon+matn (demo `ST`).
3. `SlaTimer` — `deadlineAt`, `warnAtMin=20`; holat: ok/warn/breached, `aria-live=polite`.
4. `MoneyText` — `amount`, `currency='UZS'`, `locale`; `compact` (1,8 mln).
5. `DataTable` — TanStack; `columns, data, virtual, sorting, rowSelection, emptyState, onRowClick`.
6. `EmptyState` — `icon, title, hint, action`.
7. `Sheet`/`Dialog`/`ConfirmDialog` — shadcn; `ConfirmDialog` VagonFlow'dan.
8. `PhoneInput` — VagonFlow porti, `+998` mask.
9. `StirInput` — 9 raqam, `onResolved(company)` reestrdan.
10. `FileDrop` — `accept, maxMb, onFiles`, holat: idle/uploading/error.
11. `Stepper` — `steps[], current, onStep`; mobil: gorizontal scroll.
12. `ThemeToggle`, `LangSwitcher` (VagonFlow porti), `RoleSwitcher`.

`apps/web/features`:
13. `Hero` — `variant: full|compact`; qatlamlar 9-bo'lim.
14. `HeroVideo` — `sources[], poster, paused`; reduced-motion holati.
15. `HeroScene` (dynamic) — `progress` (scroll 0–1), `quality: low|high`.
16. `StatCounter` — `value, label, animateOnView`.
17. `TerminalCard` — `terminal`, `variant: grid|row|map-popup`; bandlik `load` progress, `open` indikator, `rate`.
18. `TerminalFilters` — `region, services[], open24, sort` — URL query bilan sinxron (`nuqs` o'rniga o'z `useSearchParams` wrapper).
19. `CatalogMap` — `terminals[], selectedId, onSelect, bounds`; holat: loading/no-webgl fallback (ro'yxat).
20. `SidingMap` — `sidings[], selectedId` — schematic SVG (demo porti) + MapLibre rejimi.
21. `OrderWizard` — `steps: dir → cargo/weight → terminal → extras → slot → summary`; `draft` localStorage; `onSubmit`.
22. `CargoSelect` — ETSNG klassifikator qidiruv (`Autocomplete` VagonFlow porti), `code, name`.
23. `PriceBreakdown` — `tariff, weight, extras[], feePct=3` → ochiq formula qatorlari; `installment: 0|3|6|12` (+4/8/14%).
24. `SlotGrid` — `date, slots[6], state: free|held|taken|mine`, `onHold`; klaviatura, `heldUntil` countdown; SSE bilan jonli.
25. `OrderTimeline` — `events[]` (8 qadam SLA), `current`, demurraj taymeri.
26. `WagonTrack` — `wagonNo, position, eta`; holat: unknown/approaching/arrived.
27. `LetterBuilder` — `siding, company(STIR), cargo, wagonNumbers[], period{from,to}`; `WagonNumbersInput` (8 raqam, kontrol raqam tekshiruvi, paste'dan ko'plab), jonli `LetterPreview`; holat: draft → sent → owner_consented → station_approved(permitNo) → dsp_assigned.
28. `LetterPreview` — `letter` → blank HTML; `mode: html|pdf`.
29. `ConsentBlock` — shahobcha egasi "qarshi emasman": `status, signedAt, signer`, ERI/SMS tasdiq tugmasi.
30. `RequestDecision` (terminal) — `request`, `onAccept`, `onReject(reason)`; 30-daqiqa `SlaTimer`.
31. `TariffEditor` — `rows[{cargoClass, pricePerTon}]`, inline edit, `dirty` holat.
32. `AssetCard` — `asset: wagon|loco|siding`, `mode: rent|sale|service`, "Stansiyaga xat" CTA (siding uchun).
33. `AdCard` — `vip` ramka (amber), `phone` reveal (login talab).
34. `InstallPrompt` / `OfflineBanner` — `online`, `queuedMutations` soni.

---

Skipped (ataylab): Storybook, tRPC, WebSocket, react-day-picker, alohida admin/landing app, OKLCH migratsiyasi, Puppeteer PDF — har biri yuqorida "qachon qo'shiladi" bilan belgilangan.

**Manbalar:** [Next.js 16](https://nextjs.org/blog/next-16) · [Next.js 16.3](https://nextjs.org/blog/next-16-3) · [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) · [React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1) · [React versions](https://react.dev/versions) · [proxy.ts (Auth0)](https://auth0.com/blog/whats-new-nextjs-16/) · [TanStack Query advanced SSR](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr) · [Next.js + TanStack Query](https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query) · [next-intl without routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing) · [R3F v9 migration](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide) · [MapLibre GL JS](https://maplibre.org/projects/gl-js/) · [react-maplibre](https://visgl.github.io/react-maplibre/) · [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) · [Serwist + Next 16 (LogRocket)](https://blog.logrocket.com/nextjs-16-pwa-offline-support/) · [shadcn Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) · [HeroUI vs shadcn](https://designrevision.com/compare/heroui-vs-shadcn) · [Turborepo 2.x + pnpm catalogs](https://chenguangliang.com/en/posts/blog193_monorepo-practice-from-zero-to-production/) · [Expo SDK 56 / RN 0.85](https://dev.to/davekurian/react-native-ecosystem-advances-with-expo-sdk-56-and-react-192-updates-in-2026-3df5) · [React chart libs 2026 (LogRocket)](https://blog.logrocket.com/best-react-chart-libraries-2026/)
