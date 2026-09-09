# YukSaroy — Yakuniy birlashtirilgan arxitektura va mahsulot hisoboti

Versiya 1.0 · 2026-09-03 · Bosh Arxitektor + Bosh PM · Manba: 11 linza hisoboti + 4 skeptik tekshiruvi (yagni, reality, uxperf, complete) + Cowork sessiyasi konteksti + VagonFlow `schema.prisma`.

Hujjat maqsadi: bitta stack, bitta modul ro'yxati, bitta MVP chegarasi, bitta holat-mashinalari to'plami. Linzalar orasidagi 30+ ziddiyat shu yerda yechilgan; qaysi topilma qabul qilingani 18-bo'limda.

---

## 0. Xulosa

1. **YukSaroy — O'zbekiston temir yo'l yuk saroylari, shahobcha yo'llari va terminal xizmatlari uchun marketpleys**; e-nakl («Yagona darcha») ni takrorlamaydi, uning atrofidagi «qo'ng'iroq va qog'oz» bozorini raqamlashtiradi.
2. **Stack — VagonFlow bilan bir xil major versiyalar** (Next.js 16: VF hozir 16.2, YukSaroy 16.3 dan boshlaydi; VF ham ADR-0002 bilan birga 16.3 ga ko'tariladi): Next.js 16 (App Router, Route Handlers) + React 19 + Prisma 5.22 + Postgres 17 + Tailwind v4 + shadcn + Telegraf + node-cron, docker-compose, nginx, UzCloud. NestJS, Redis/BullMQ, MinIO (prod), LibreOffice, OTel/Tempo/Loki, Metabase, PostHog, RLS, CASL — F1 da yo'q.
3. **F1 MVP (Toshkent tuguni, 5–8 obyekt, 4 oy)**: katalog + pasport, 3 ekranli buyurtma vizardi, terminal × kun × oyna slot dvigateli (10 daqiqalik hold), terminal kabineti (30 daq SLA), buyurtma holat mashinasi, akt/hisob-faktura PDF, shahobcha katalogi va **stansiya boshlig'iga xat oqimi (gibrid: PDF + QR + qog'oz/muhr, F2 da ERI)**, Telegram bot, i18n uz/oz/ru (Must), landing (video + bitta R3F sahna).
4. **Pul oqimi F1 da platformadan o'tmaydi**: hisob-faktura + bank o'tkazmasi; komissiya 0 %, `commissionPayer=TERMINAL`. Eskrou = bank eskrou hisobi (F2), rassrochka = bank/MFO hamkor, YukSaroy agent (F3). Platforma ichida ledger/eskrou/rassrochka qurilmaydi (ZRU-578, ZRU-765, PP-294).
5. **Stansiya tomoni VagonFlow ichida yashaydi**: DS/DSP allaqachon u yerda; YukSaroy xatni VF ga uzatadi, DS ruxsat raqamini VF da kiritadi, DSP topshirig'i = VF `WagonMemo(operation=SUPPLY)`; YukSaroy da alohida stansiya kabineti va `RAILWAY_STATION` roli F1 da yo'q.
6. **Terminologiya tuzatildi**: yuk xati — GU-27; GU-29 — yo'l vedomosti (stansiya to'ldiradi, katalogda yo'q); GU-12 — pullik «stol uslug» emas, VagonFlow `Request`.
7. **Bitta holat-mashinalari to'plami** `packages/domain` da: `OrderStatus` (9, `DISPUTED` F2), `LetterStatus` (10), `BookingStatus` (4); ARRIVED/WEIGHED/LOADED — statuslar emas, `OrderStatusHistory`/`TrackingEvent` kodlari.
8. **Dizayn tizimi — bitta manba** `packages/ui/tokens.css`: demo palitrasi (navy/teal/amber) UI tokenlari, brend linzasidan iliq qum fon va karvonsaroy motivlari olinadi; 3 logo SVG shu tokenlarga qayta bo'yaldi (9-bo'lim).
9. **Ma'lumot huquqi F0 sharti**: 18 428 reestr, «Шахобча йўллар.xlsx», VagonFlow telefonlari — O'TY/DAS UTY yozma roziligisiz ishlatilmaydi; SMS to'lqinlari yo'q; landing raqamlari faqat o'z ma'lumotimiz.
10. **Jamoa va byudjet bitta jadval**: F0–F1 (6 oy) ≈ 5 FTE, ≈ 0,7 mlrd so'm; F0–F2 (12 oy) ≈ 1,8 mlrd so'm; mobil (Expo SDK 55) — F2 dan.

### «Bir sahifa»

| Savol | Javob |
|---|---|
| Nima quramiz | Temir yo'l terminal/shahobcha/aktiv marketpleysi: katalog → narx → slot → buyurtma → hujjat; stansiya xati oqimi; VagonFlow bilan bitta zanjir |
| Kim uchun | Yuk jo'natuvchi/logist/ekspeditor (talab); terminal, shahobcha egasi, xususiy LC/SVX, teplovoz/vagon egasi (taklif); O'TY — axborot hamkori |
| Stack | Next.js 16 + React 19 + TS 5.9, Prisma 5.22 → 7 (ADR), Postgres 17, Tailwind v4 + shadcn, Telegraf, node-cron, `@react-pdf/renderer` + `docx`, UzCloud VPS + S3, docker-compose + nginx, GitHub Actions |
| Monorepo | `apps/web`, `apps/worker`, `apps/bot`, (F2) `apps/mobile`; `packages/db`, `packages/domain`, `packages/ui`, `packages/i18n`, `packages/config` |
| MVP (F1) chegarasi | 2-bo'lim jadvalidagi «M/F1» qatorlari: 41 model, 85 endpoint, 7 sidebar bandi, 3 ekranli vizard, gibrid xat oqimi |
| Muddat | F0 — 6 hafta (huquq, memorandum, brend, skeleton); F1 — 12 hafta (M2 prod, hafta 18); F2 — hafta 19–34 (to'lov, ERI, mobil, VF stansiya inboxi); F3 — oy 9–14; F4 — 15+ |
| Jamoa | Tech lead (1) + fullstack senior (1) + fullstack middle (1) + dizayner (0,5) + DevOps (0,5) + QA (0,5, 3-oydan) + domen-ekspert (foydalanuvchi) = ~5 FTE; F2: +mobil (1), +backend to'lov/ERI (1), QA 1, domen-ekspert 0,5 = ≈ 7,5 FTE |
| Byudjet | F0–F1 ≈ 0,69 mlrd so'm; F2 ≈ 1,13 mlrd; F0–F2 jami ≈ 1,82 mlrd so'm (~$140 k); investor so'rovi ≈ 2,1 mlrd (marketing + yuridik + bank integratsiya bilan) |
| North-star | CBO — oylik bajarilgan onlayn buyurtmalar (F1 oxiri 300, F2 1 500, F3 3 000) |
| Eng katta xavf | Taklif tomoni (O'TY yuk saroylari korporativ qaror), stansiya elektron xatni qabul qilmasligi (H4 F0 da yopiladi), yuksaroy.uz egaligi |

---

## 1. Manba va kontekst

### 1.1 Cowork sessiyasidan olindi

| Manba | Nima berdi | Hisobotda qayerda |
|---|---|---|
| Konsepsiya (29.08.2026) | 6 modul, 8 daromad oqimi, F0–F4 yo'l xaritasi, ekotizim (aktivlar bozori, portlar, ma'lumotnomalar), «mukammallik yo'li» (eskrou, AI, tender, akademiya) | 2-bo'lim inventari; monetizatsiya 14-bo'limda qayta hisoblandi |
| Ish standarti v1.0 | 8 jarayon «kim → nima → qancha vaqtda», SLA jadvali (30 daq tasdiq, 2–4 soat slot, 3 ish kuni TY kod) | 3-bo'lim oqimlari; SLA jadvali 12.1 da tuzatilgan holda qayta berildi (TY kod SLA olib tashlandi, demurraj sababi qo'shildi, har norma `PlatformConfig` kalitiga bog'landi) |
| Interaktiv demo | IA (`NAVS.ship/term/adm`), 7 mobil rol, `ST` statuslar, `CARGO/EXTRA/SLOTS/DOCTYPES/ADS/ASSETS`, `spurMap` SVG, xat konstruktori `letter()` | 5-bo'lim route xaritasi, 7-bo'lim seed, 8-bo'lim ekranlar |
| Oxirgi talab (02–03.09) | Shahobcha yo'l topildi → kelishildi → stansiya boshlig'iga xat (vagonlar, egasi, davr, «qarshi emasman») → avtomatik yuklab olinadi va stansiyaga topshiriladi | 3.3 oqim (stateDiagram + sequenceDiagram) — hujjatning markaziy qismi |
| VagonFlow `schema.prisma` | `Siding` (40+ maydon), `Station.ecpCode`, `Client.inn`, `Request` (3 bosqichli tasdiq), **`WagonMemo` + `NaryadStatus`** (DSP javobi), `DispatchTask` (jo'natish, Request ga 1:1), `UserStation`, `AuditLog`, `DeviceToken`, `ClientBotSession` | 4-bo'lim integratsiya kontrakti |
| Desktop fayllari | `Шахобча йўллар.xlsx` (1 393 qator), `ЕСР с новыми станциями.xlsx` (22 419, DOR=73 → ~300), ETSNG (407), «Yagona darcha» 18 428 mijoz (18 338 STIR, telefon 0), railmap JSON (214 stansiya) | 7.5 import pipeline; huquqiy shartlar 12-bo'lim |

### 1.2 Nima yetishmadi (F0 da to'ldiriladi)

| Bo'shliq | Nega muhim | Kim / qachon |
|---|---|---|
| Pilot terminallarning huquqiy statusi (O'TY yuk saroyi / O'ztemiryo'lkonteyner / xususiy LC) | «Terminal shartnomasi» kim bilan tuzilishini belgilaydi | Foydalanuvchi, F0 hafta 1 |
| DS Sergeli/Chuqursoy bilan intervyu: elektron/QR xatni qabul qiladimi | H4 — xat oqimining huquqiy shakli | Foydalanuvchi, F0 hafta 2 |
| O'TY/DAS UTY yozma roziligi (reestr, shahobcha reestri, bot orqali xabar) | 18 428 bazadan foydalanish qonuniyligi | CEO, F0 |
| yuksaroy.uz egaligi (03.09.2026 SUVAN NET orqali ro'yxatdan o'tgan) | Barcha hostname/deep-link rejasi | Bugun |
| E-IMZO shartnomasi (e-imzo-server VPN kaliti, SiteID) | F2 ERI muddati | CTO, F0 boshlanadi, 4–6 hafta |
| Terminal pasport anketasi (5 ta) va tarif jadvali | Katalog seed | Domen-ekspert, F0 |
| Bank hamkori (eskrou hisobi, faktoring/rassrochka) | F2/F3 moliya | CEO, F1 davomida |
| IMA tovar belgisi tekshiruvi «YukSaroy/ЮкСарой» | Brend himoyasi | F0 |

---

## 2. Mahsulot

### 2.1 Personalar va JTBD

| # | Persona | JTBD | F1 da bormi |
|---|---|---|---|
| P1 | Yuk jo'natuvchi / logist (Dilshod, «Xorazm Agro Eksport», Urganch) | Vagon berilganda terminal/slotni 5 daqiqada topib, narxni oldindan bilib band qilish | Ha — asosiy |
| P2 | Terminal operatori (Sherzod, Sergeli smena boshlig'i) | Ertangi oynalarni oldindan to'ldirish, kran/brigadani rejalashtirish | Ha — asosiy |
| P3 | Ekspeditor («Sogdiana Trans») | Butun zanjirni bitta kabinetdan boshqarish | Ha — mijoz sifatida (`orgKind=FORWARDER`), mutaxassis bozori F2 |
| P4 | Shahobcha yo'l egasi («Biokimyo» AJ) | Bo'sh sig'imni berish, «qarshi emasman»ni bir tugmada berish | Ha — `ASSET_OWNER`, rozilik SMS-OTP |
| P5 | Stansiya boshlig'i (DS) / DSP | Raqamlangan, tekshiriladigan so'rov; naryad avtomatik | Ha — VagonFlow ichida (4-bo'lim) |
| P6 | Platforma operatori/admin | KYC, SLA buzilishi, «stol uslug» navbati | Ha — `PLATFORM` |
| P7 | Xususiy LC / SVX egasi (Angren LC) | Bo'sh maydonni sotish | Ha — `TERMINAL` (kind=LC/SVX) |
| P8 | Deklarant | SVX ga kelayotgan vagonni oldindan ko'rish | F2 |
| P9 | Avtotashuvchi / haydovchi | Aniq soatda yuk olish, GPS | F2 (mobil) |
| P10 | Vagon egasi / teplovoz xizmati | Ijara/manevr e'loni, kalendar | F2 |
| P11 | O'TY boshqaruv | Haftalik yuklama/bandlik dashboardi | F3 |

Nima uchun 11 (demoda 7): P5 va P6 oxirgi talab va «institutsional qarshilik» xatarini yopadi. Alternativa — 4 rol — RBAC darajasida shunday qilinadi (`OrgKind × OrgRole`, 6-bo'lim).

### 2.2 To'liq funksiya inventari

Belgilar: M/S/C/W = MoSCoW; faza F0–F4; S/M/L/XL murakkablik. **Qalin** — F1 MVP.

| ID | Funksiya | Rol | MoSCoW | Faza | Mur. |
|---|---|---|---|---|---|
| **K1** | Telefon + SMS-OTP kirish (VagonFlow `auth/session.ts` porti) | barcha | M | F1 | S |
| **K2** | Organization + Membership (`OrgKind × OrgRole`), ko'p-rolli akkaunt | barcha | M | F1 | M |
| **K3** | STIR bo'yicha reestrdan profil topish; **ulash faqat operator KYC dan keyin** (F2: E-IMZO sertifikat TIN == STIR) | mijoz | M | F1 | M |
| **K4** | Elektron oferta aksepti (SMS-OTP), 3 oferta matni | barcha | M | F1 | S |
| **K5** | Bildirishnoma: Telegram bot + Web Push (VAPID) + SMS fallback; FCM F2 | barcha | M | F1 | M |
| **K6** | AuditLog (kim/qachon/nima), append-only | admin | M | F1 | S |
| **K7** | i18n uz/oz/ru (VagonFlow `i18n.ts` porti; manba oz) | barcha | **M** | F1 | S |
| **K8** | Admin panel: KYC navbati, SLA monitor, PlatformConfig, moderatsiya | admin | M | F1 | M |
| K9 | PWA manifest (o'rnatiladigan); service worker/offline navbat | barcha | S / C | F1 / F2 | S / M |
| K10 | Native mobil (Expo SDK 55) | barcha | S | F2 | XL |
| K11 | Telegram Mini App (`/tma` route apps/web ichida) | mijoz, egasi | S | F2 | S |
| K12 | KYC: E-IMZO challenge-auth / OneID | barcha | M | F2 | M |
| K13 | Legal-0: e-tijorat uvedomleniesi, PD reestri (3 baza), ofertalar | platforma | M | F0 | S |
| **M1.1** | Terminal pasporti (yo'llar, kran, ombor, SVX, ish vaqti, foto) | terminal, admin | M | F1 | M |
| **M1.2** | Katalog: stansiya/hudud/xizmat filtri, reyting/narx saralash, `use cache` | mijoz | M | F1 | M |
| **M1.3** | Stansiya ro'yxati + `SidingMap` SVG sxemasi (demo `spurMap` porti), koordinata railmap API dan | mijoz | M | F1 | S |
| M1.4 | MapLibre + OSM raster xarita (20+ terminal bo'lganda) | mijoz | S | F2 | M |
| M1.5 | «Kelish stansiyasidan terminal tanlash» (vagon № → stansiya) | mijoz | S | F2 | M |
| M1.6 | Real vaqt bandlik indikatori (`loadPct`) | mijoz | S | F2 | S |
| M1.7 | SVX katalogi (`SvxWarehouse`: litsenziya №, muddati) | mijoz | S | F2 | M |
| M1.8 | Ma'lumotnomalar: tarozilar, yo'l servislari | haydovchi | C | F3 | S |
| M1.9 | Xalqaro portlar | ekspeditor | C | F4 | L |
| M1.10 | Premium joylashuv (top-3) | terminal | S | F2 | S |
| **M2.1** | Buyurtma vizardi 3 ekran (yuk+yo'nalish+vazn → terminal+slot+qo'shimchalar → xulosa) | mijoz | M | F1 | L |
| **M2.2** | Slot dvigateli: `TimeSlot(terminalId, localDate, window)` capacity/booked/held, `FOR UPDATE`, hold 10 daq (`PlatformConfig`) | mijoz, terminal | M | F1 | L |
| **M2.3** | Terminal kabineti: qabul/rad (sabab), 30 daq SLA taymer | terminal | M | F1 | M |
| **M2.4** | Auto-expire: 30 daq → EXPIRED, slot bo'shaydi, reyting −0,05, 2 alternativa | tizim | M | F1 | S |
| **M2.5** | Qo'shimcha xizmatlar (tarozi, saqlash, SVX, oxirgi milya — ro'yxat) | mijoz | M | F1 | S |
| M2.6 | Terminal resurs rejasi (kran/yo'l/darvoza → slot, `resourceId` nullable) | terminal | S | F2 | L |
| M2.7 | Avto gate-slot (2 soatlik oyna faqat darvoza uchun) | haydovchi | S | F2 | L |
| M2.8 | Slot fiksatsiya to'lovi + no-show jarimasi | mijoz | S | F2 | M |
| M2.9 | Takroriy buyurtma / shablon | mijoz | C | F2 | S |
| M2.10 | Yuk tenderi | yirik mijoz | C | F3 | L |
| **M3.1** | Narx: `calcQuote()` serverda — tarif × vazn + xizmatlar; komissiya `PlatformConfig` (F1 0 %, payer TERMINAL) | mijoz | M | F1 | M |
| **M3.2** | Terminal tarif matritsasi (append-only versiya, `validFrom`) | terminal | M | F1 | M |
| **M3.3** | Landing hero'da login'siz «tez hisob» (stansiya + yuk + vazn → 3 terminal) | mehmon | M | F1 | S |
| M3.4 | Median/kvartil «bozor narxi» (SQL), keyin ML | mijoz | C | F3 | L |
| **M4.1** | Buyurtma holat mashinasi + push (8 status, sub-hodisalar timeline) | barcha | M | F1 | M |
| **M4.2** | VagonFlow v1: `Request` yaratish + webhook (status, providedWagons, WagonMemo) | mijoz | M | F1 | L |
| M4.3 | Demurraj taymeri (`placedAt` GU-45 dan, `delayReason` majburiy) | terminal, mijoz | S | F2 | M |
| M4.4 | Vagon dislokatsiyasi ASOUP | mijoz | W | O'TY API ochilguncha | XL |
| M4.5 | Fura GPS + haydovchi ilovasi | haydovchi | S | F2 | L |
| M4.6 | 24 soat oldin «tushirish slotini band qiling» (VF `AWAITING_ARRIVAL` yoki mijoz vagon №) | mijoz | S | F2 | M |
| **M5.1** | Akt + hisob-faktura PDF (`@react-pdf/renderer`), Invoice + bank o'tkazma; «to'landi» operator | tizim | M | F1 | M |
| M5.2 | Onlayn to'lov: bitta provayder (Payme yoki Click) — hujjat/e'lon/slot to'lovi | mijoz | M | F2 | M |
| M5.3 | Didox ESF/akt (EDO) | tizim | M | F2 | M |
| M5.4 | Bank eskrou hisobi + `Order.escrowState` + release signali | mijoz | S | F2 | M |
| M5.5 | ERI (E-IMZO deeplink/brauzer) hujjatlarga | barcha | M | F2 | M |
| **M5.6** | «Stol uslug»: GU-27 yuk xati, SMGS, qayta jo'natish, VU/GU-45 akt to'plami — 4 soat SLA, PDF | mijoz, admin | S | F1 | M |
| **M5.7** | TY kod: cheklist + shablonlar + e-nakl deep-link + holat kuzatuvi (SLA va'da yo'q) | mijoz | S | F1 | S |
| M5.8 | To'lov agenti (ELS) — bank agentlik shartnomasi bilan | mijoz | C | F3 | L |
| M5.9 | Rassrochka/faktoring — bank/MFO hamkor, YukSaroy agent | mijoz | C | F3 | L |
| M5.10 | 1C/xlsx eksport | mijoz | C | F3 | S |
| M5.11 | Yuk sug'urtasi (agentlik) | mijoz | C | F3 | M |
| **M6.1** | Reyting 1–5 + SLA jarimasi | mijoz | M | F1 | S |
| M6.2 | Terminal analitikasi (recharts 3 ekran) | terminal | S | F2 | M |
| M6.3 | Boshqaruv dashboardi | O'TY, admin | S | F2 | M |
| M6.4 | Mijoz oylik hisoboti | mijoz | C | F3 | M |
| M6.5 | Anti-frod (qoidalar, moderator navbati) | admin | S | F2 | M |
| **E1.1** | Shahobcha katalogi (VF `Siding` ko'zgusi; egasi «claim» qilmaguncha nomi yashirin) | mijoz | M | F1 | M |
| **E1.2** | **Stansiya xati konstruktori** (yuk egasi blankasi, vagonlar, davr, shartnoma №, PDF + DOCX + QR) | mijoz | M | F1 | L |
| **E1.3** | Shahobcha egasining roziligi (Telegram/SMS-OTP, F2 ERI) | egasi | M | F1 | M |
| **E1.4** | Xatni stansiyaga topshirish: gibrid (chop etilgan + muhr) + VF integratsiya (`/api/integrations/yuksaroy/letters`) | mijoz, DS | M | F1 | M |
| E1.5 | Ruxsat → VF `WagonMemo(SUPPLY)` avto-naryad + DSP javobi webhook | tizim | M | F2 | M |
| E1.6 | `SidingServiceContract` entity (F1 da xatda `contractNo` + fayl) | egasi, mijoz | S | F2 | M |
| E2.1 | Aktivlar bozori e'lonlari (vagon/teplovoz/shahobcha; `permitNo`, `PRIVATE_SIDING_ONLY`) | egalar | S | F2 | M |
| E2.2 | `AssetDeal` bitim (so'rov → kelishuv → akt) | egalar | S | F2 | L |
| E2.3 | `ManeuverRequest` + teplovoz kalendari (VF `LocoShift` bilan) | teplovoz | S | F2 | M |
| E2.4 | E'lonlar (kran, fura) + VIP; terminal `elonlar` route | xizmatchilar | S | F2 | S |
| E3.1 | Mutaxassislar bozori (ekspeditor/deklarant, 2 soat SLA) | mijoz | S | F2 | L |
| E3.2 | Vakansiyalar | terminal | C | F2 | S |
| E3.3 | Arbitraj/nizo (3 ish kuni) | barcha | S | F2 | M |
| E3.4 | Buyurtma ichidagi chat (F1: Telegram deep-link) | barcha | C | F3 | M |
| **E4.1** | Avtotashuvchilar bazasi (ro'yxat) | mijoz | S | F1 | S |
| E4.2 | Avto-yuk birjasi | haydovchi | C | F3 | L |
| **E5.1** | Telegram bot: holat, tasdiq/rad, rozilik (VagonFlow bot naqshi) | mijoz, terminal, egasi | M | F1 | M |
| E5.2 | Referal/sodiqlik | mijoz | C | F3 | M |
| E5.3 | Akademiya | mutaxassis | W | F4 | L |
| **A1** | Event jadvali (`Event`, 10 nom) — KPI hisobi | admin | M | F1 | S |
| **A2** | AI: ETSNG tanlash `pg_trgm`, SMS shablon `{name}` — LLM'siz | tizim | M | F1 | S |
| A3 | AI: OCR nakladnoy/tarozi cheki, e'lon matni yaxshilash (Haiku/Sonnet) | mijoz | C | F2 | M |

Jami 81 qator; F1 = 33 ta qalin qator (K9 PWA manifest qismi ham F1, lekin qator F1/F2 ga bo'lingani uchun qalin emas).

### 2.3 MVP F1 chegarasi — nima kirmaydi va nima uchun

| Kirmaydi | Sabab | F1 alternativasi |
|---|---|---|
| Onlayn to'lov, eskrou, split, ledger | Pilotda komissiya 0 % — pul oqimi yo'q; platforma hisobida tranzit pul huquqan xavfli | Invoice PDF + bank o'tkazma, «to'landi» belgisi operator |
| ERI (E-IMZO) | Shartnoma 4–6 hafta, SiteID ro'yxati; F0 da boshlanadi | SMS-OTP rozilik + gibrid qog'oz xat |
| Stansiya kabineti YukSaroy ichida | DS/DSP O'TY xodimi, VagonFlow da allaqachon; ikki tizimga kirmaydi | VF `/station/letters` inbox (VF tomonida 4 route + 1 ekran + 3 webhook — 4.3) |
| Native mobil, offline navbat | Haydovchi roli F1 da yo'q; PWA offline «yo'qolgan buyurtma» logi ko'rinmaguncha | Responsive web + Telegram bot |
| Aktivlar bitimi, teplovoz kalendari, mutaxassislar | KYC/eskrousiz — nizo xavfi | Shahobcha katalogi read-only + «Stansiyaga xat» |
| MapLibre + PMTiles | 5–8 terminal uchun 300 MB tile hosting ortiqcha | `SidingMap` SVG + stansiya ro'yxati |
| Redis, BullMQ, NestJS, OTel/Tempo/Loki, Metabase, PostHog, RLS, CASL | 300 buyurtma/oy pilot; VagonFlow naqshi yetadi | node-cron + OutboxEvent + `Event` jadvali + Grafana/Prometheus |
| LLM bilan xat matni | Rasmiy xat — standart shablon; O'TY reestr maydonlari AQSh serveriga ketmasin | `docx`/react-pdf shablon, 6 o'zgaruvchan maydon |
| O'TY API (ASOUP), TY kod avto | API yo'q, EBRD dasturi 2027+ | Mijoz/VF kiritadi; cheklist + deep-link |

### 2.4 KPI daraxti

North-star: **CBO** (Completed Booked Orders/oy) — onlayn band qilingan, akt bilan yopilgan buyurtmalar. GMV emas: komissiya 0 %, tarif manipulyatsiyaga ochiq.

| Daraja | KPI | F1 maqsad |
|---|---|---|
| Taklif | Jonli obyektlar (terminal/LC/SVX) | 5–8, pasport to'liqligi ≥ 90 % |
| Taklif | E'lon qilingan slot / ish soati | ≥ 80 % |
| Talab | Ro'yxatdan o'tgan tashkilotlar (opt-in) | 150 |
| Konversiya | DRAFT → PENDING | ≥ 60 % |
| Konversiya | PENDING → CONFIRMED ≤ 30 daq | ≥ 85 % maqsad; H2 minimal chegara ≥ 80 % (undan past bo'lsa 60 daq + auto-accept) — 14.5 va S8 da shu ikki raqam |
| Konversiya | CONFIRMED → DONE | ≥ 92 % |
| Sifat | O'rtacha reyting / SLA buzilishi | ≥ 4,5 / ≤ 5 per 100 |
| Xat oqimi | Xat → ruxsat median | ≤ 1 ish kuni (gibrid) |
| Xat oqimi | Ruxsat → PLACED ulushi | ≥ 85 % (F2, webhook bilan o'lchanadi) |
| Landing | Hero «tez hisob» → ro'yxat | ≥ 15 % |
| UX | Vizard median vaqti (5 sinovchi) | ≤ 3 daq |

---

## 3. Asosiy oqimlar (7 ta)

Yozuv: ekran (route) · aktor · hodisa · holat. Barcha statuslar `packages/domain/enums.ts` dan.

### 3.1 Oqim 1 — Yuklash buyurtmasi + slot + hisob-kitob

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/kabinet/buyurtma/yangi` (1-ekran: yo'nalish, operatsiya, ETSNG, vazn, vagon soni) | Mijoz | `order.draft` (localStorage `useOrderDraft`) | Order: DRAFT |
| 2 | 2-ekran: terminal kartasi ichida slot grid + qo'shimchalar | Mijoz | `POST /api/slots/hold` → `SlotBooking(HOLD, holdExpiresAt=+10 daq)` | Booking: HOLD |
| 3 | 3-ekran: xulosa (ochiq formula, komissiya qatori faqat `payer=CLIENT` bo'lsa) | Mijoz | `POST /api/orders` (Idempotency-Key) → `calcQuote()` serverda | Order: PENDING, `slaConfirmUntil=+30 daq` |
| 4 | Telegram/push | Tizim (worker, outbox) | `order.pending` → terminalga xabar | — |
| 5 | `/terminal/talabnomalar/[no]` | Terminal | `POST /api/orders/[no]/confirm` yoki `/reject{reason}` | CONFIRMED / REJECTED; Booking CONFIRMED / RELEASED |
| 5a | (fon, node-cron 1 daq) | Tizim | `slaConfirmUntil < now` → EXPIRED, reyting −0,05, mijozga 2 alternativa | EXPIRED |
| 6 | (fon) | Tizim | LOAD/EMPTY_DISPATCH bo'lsa VagonFlow `POST /api/integrations/yuksaroy/requests` → `Order.vfRequestId` | CONFIRMED (history: VF_REQUEST_CREATED) |
| 7 | `/terminal/talabnomalar/[no]` | Terminal | `POST /api/orders/[no]/events {code: ARRIVED \| WEIGHED \| LOADED, netKg, placedAt}` | IN_PROGRESS (sub-hodisalar `OrderStatusHistory`) |
| 8 | `/kabinet/buyurtmalar/[no]` | Tizim | Akt PDF + Invoice PDF, `order.done` | DONE |
| 9 | `/kabinet/buyurtmalar/[no]/baho` | Mijoz | `POST /api/orders/[no]/review` | DONE (Review yozildi) |
| 10 | `/boshqaruv/tolovlar` | Operator | Bank o'tkazmasi keldi → `Invoice.status=PAID` (F2: provayder webhook) | Invoice PAID |

```mermaid
sequenceDiagram
  autonumber
  participant M as Mijoz (web/bot)
  participant W as apps/web (Route Handlers)
  participant DB as Postgres 17
  participant WK as apps/worker (node-cron + outbox)
  participant T as Terminal
  participant VF as VagonFlow API
  M->>W: POST /api/slots/hold {slotId}
  W->>DB: BEGIN, SELECT TimeSlot FOR UPDATE
  W->>DB: held++ (CHECK booked+held ≤ capacity), SlotBooking HOLD, COMMIT
  W-->>M: 201 {holdExpiresAt}
  M->>W: POST /api/orders (Idempotency-Key)
  W->>DB: calcQuote(tariff v, weight, extras) → Order PENDING + OrderItem(tariffId muzlatilgan) + OutboxEvent(order.pending)
  WK->>DB: poll OutboxEvent (1 s)
  WK->>T: Telegram + Web Push «Yangi talabnoma YS-1041, 30 daq»
  T->>W: POST /api/orders/YS-1041/confirm
  W->>DB: Order CONFIRMED, SlotBooking CONFIRMED (held--, booked++), Outbox(order.confirmed)
  WK->>VF: POST /api/integrations/yuksaroy/requests (Bearer shared-secret)
  VF-->>WK: {vfRequestId}
  VF->>W: POST /api/webhooks/vagonflow {request.status_changed, providedWagons} (HMAC, X-Event-Id)
  T->>W: POST /api/orders/YS-1041/events {ARRIVED, placedAt}
  T->>W: POST /api/orders/YS-1041/events {LOADED, netKg}
  W->>DB: Order DONE, Document(AKT), Invoice(bank o'tkazma)
  WK->>M: push «Akt va hisob-faktura tayyor»
  Note over M,DB: F2 — Invoice → Payment(provider) yoki bank eskrou, Didox ESF
```

### 3.2 Oqim 2 — Tushirish (vagon kelishi → topshirish)

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | Telegram/push | Tizim | VF `Request.lifecycle=AWAITING_ARRIVAL` webhook **yoki** mijoz kiritgan vagon № → «Tushirish slotini band qiling» (F2: 24 soat oldin) | — |
| 2 | `/kabinet/buyurtma/yangi?op=UNLOAD&wagon=…` | Mijoz | Vagon № oldindan, stansiya aniqlanadi, terminallar shu stansiyadan | DRAFT → PENDING |
| 3 | `/terminal/talabnomalar/[no]` | Terminal | Tasdiq (F2: resurs biriktirish) | CONFIRMED |
| 4 | `/terminal/talabnomalar/[no]` | Terminal | `ARRIVED{placedAt}` — GU-45 vaqti qo'lda kiritiladi | IN_PROGRESS |
| 5 | ↑ | Terminal | `UNLOADED`, `WEIGHED{netKg}`, `RELEASED{removedAt, delayReason}` | IN_PROGRESS |
| 6 | `/kabinet/buyurtmalar/[no]` | Tizim | Akt + Invoice; F2: demurraj hisob `removedAt − placedAt − unloadNorm`, `delayReason` bo'yicha kim hisobidan | DONE |

Nega `placedAt` F1 dayoq: F2 demurraj taymeri GU-45 vaqtisiz ishlamaydi; ustun arzon, tarix to'planadi.

### 3.3 Oqim 3 — Stansiya boshlig'iga xat / shahobcha egasi roziligi / ruxsat / DSP topshirig'i

Foydalanuvchining eng aniq talabi. Huquqiy zanjir (12-bo'lim): yuk egasi (kontragent) → DS nomiga xat; shahobcha egasi vizasi «qarshi emasman» + kontragent shartnomasi №; DS rezolyutsiya; DSP GU-45 + manevr; DU-58 jurnal.

**Yagona qarorlar:**
- Entity: `StationLetter`, `LetterWagon`, `SidingConsent`, `StationPermit` (data linzasi asos). `DspTask` yo'q — DSP topshirig'i = VagonFlow `WagonMemo(operation=SUPPLY, status=NEW)`, `StationPermit.vfWagonMemoIds Int[]`.
- Xat **yuk egasining blankasida** (nom, STIR, manzil, TY kod sarlavhada); YukSaroy faqat footer'da: «Tayyorlangan: YukSaroy · QR tekshiruv». Xat raqami `StationLetter.no = "SL-{YYYY}-{seq}"` — platforma ichki raqami.
- `StationPermit.permitNo` — **DS kiritadigan matn** (stansiya kiruvchi hujjat raqami/rezolyutsiya sanasi), avto-generatsiya yo'q.
- F1 huquqiy shakl — **gibrid**: PDF + QR (`/tekshir/[code]`) yuklab olinadi, mijoz chop etib, muhr/imzo bilan stansiyaga topshiradi; elektron nusxa VF stansiya inboxiga ketadi; DS VF da `permitNo` kiritadi (yoki F1 boshida platforma operatori qog'oz rezolyutsiyani ko'rib kiritadi). F2: ikkala imzo ERI (E-IMZO), qog'oz yo'q.
- `SidingConsent.method`: F1 `SMS_OTP` (Telegram tugma + SMS kod), F2 `EIMZO`. `StationLetter.signatureLevel: OTP | ERI | PAPER`.
- Shartnoma: F1 da `StationLetter.contractNo` + `contractFileId` (kontragent shartnomasi skani); F2 `SidingServiceContract` entity.
- Xat matni — determinik shablon (docx + react-pdf), LLM yo'q.

```mermaid
stateDiagram-v2
  [*] --> DRAFT: mijoz konstruktor
  DRAFT --> AWAITING_OWNER: request-consent
  AWAITING_OWNER --> OWNER_CONSENTED: egasi OTP (F2 ERI)
  AWAITING_OWNER --> OWNER_DECLINED: rad / 48 soat
  OWNER_DECLINED --> DRAFT: tahrir
  OWNER_CONSENTED --> SUBMITTED: PDF+QR, PAPER|ERI, VF inbox
  SUBMITTED --> PERMITTED: DS permitNo
  SUBMITTED --> RETURNED: DS sabab bilan qaytardi
  RETURNED --> DRAFT: tuzatish
  PERMITTED --> IN_EFFECT: periodFrom yoki birinchi WagonMemo PLACED
  IN_EFFECT --> EXPIRED: periodTo + 1 kun
  PERMITTED --> EXPIRED: periodTo o'tdi
  PERMITTED --> REVOKED: DS bekor (F2)
  IN_EFFECT --> REVOKED: DS bekor (F2)
  EXPIRED --> [*]
  REVOKED --> [*]
```

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/aktivlar` → shahobcha kartasi (`Siding`: stansiya, uzunlik, sig'im − band, egasi «claim» qilgan bo'lsa nomi) | Mijoz | Karta topildi; «Stansiyaga xat» CTA | — |
| 2 | Egasi bilan kelishuv — F1 da platformadan tashqarida (telefon/Telegram deep-link); shartnoma № va skan xatga kiritiladi | Mijoz ↔ Egasi | — | — |
| 3 | `/kabinet/xatlar/yangi` — 4 qadam: shahobcha → yuk/davr/shartnoma → vagonlar (qo'lda / paste / VF `Request.providedWagons` dan checkbox) → ko'rib chiqish (jonli A4 preview) | Mijoz | `POST /api/letters`, `PATCH` | DRAFT |
| 4 | «Egasiga yuborish» | Mijoz | `POST /api/letters/[id]/request-consent` → egasiga Telegram tugma + SMS | AWAITING_OWNER |
| 5 | `/egam/roziliklar/[id]` yoki bot tugmasi | Shahobcha egasi | `POST /api/letters/[id]/consent {decision, conditions?, otp}` → `SidingConsent` + `Signature(method=SMS_OTP)` | OWNER_CONSENTED / OWNER_DECLINED |
| 6 | `/kabinet/xatlar/[id]` | Tizim | PDF + DOCX (`docx` npm) + QR; `Document(kind=STATION_LETTER, sha256, qrToken)`; «Stansiyaga yuborish» faollashadi | OWNER_CONSENTED |
| 7 | «Stansiyaga yuborish» | Mijoz | `POST /api/letters/[id]/submit {signatureLevel}` → Outbox → VF `POST /api/integrations/yuksaroy/letters`; mijoz «Chop etish» — muhr bilan stansiyaga | SUBMITTED |
| 8 | **VagonFlow** `/station/letters/[id]` (yangi ekran, DS, `UserStation` qamrovi) | DS | «Ruxsat» → `permitNo`, `validFrom/To`, shartlar; yoki «Qaytarish{sabab}» → webhook `letter.decided` | PERMITTED / RETURNED |
| 8a | `/boshqaruv/xatlar/[id]` (F1 fallback, VF ekrani tayyor bo'lmasa) | Platforma operatori | Qog'oz rezolyutsiyani ko'rib `permitNo` kiritadi, skanini biriktiradi | PERMITTED |
| 9 | (fon) | Tizim | PERMITTED → Outbox → VF `POST /api/integrations/yuksaroy/wagon-memos` — har vagonga `WagonMemo(SUPPLY, NEW, note=permitNo)`; vagon raqami keyin ma'lum bo'lsa VF tomonida priyomosdatchik yaratadi | PERMITTED (`vfWagonMemoIds`) |
| 10 | VagonFlow DSP ekrani | DSP | `NaryadStatus=PLACED / NOT_PLACED {responseNote, at}` → webhook `wagon_memo.responded` | IN_EFFECT; `LetterWagon.placedAt = memo.at` (GU-45 vaqti) |
| 11 | Telegram/push | Tizim | «Vagon 62345678 shahobchaga qo'yildi 14:20» | — |
| 12 | (fon, `periodTo + 1`) | Tizim | EXPIRED; davr tashqarisida kelgan vagon → ogohlantirish | EXPIRED |

```mermaid
sequenceDiagram
  autonumber
  participant M as Mijoz
  participant YS as YukSaroy web+worker
  participant E as Shahobcha egasi
  participant VF as VagonFlow
  participant DS as DS (VF ekrani)
  participant DSP as DSP (VF ekrani)
  M->>YS: POST /api/letters {sidingId, cargo, wagons[], period, contractNo}
  YS-->>M: LetterPreview (A4, yuk egasi blankasi)
  M->>YS: POST /letters/{id}/request-consent
  YS->>E: Telegram: «Biokimyo shahobchasi: 12 vagon, 10–20.09 — Qarshi emasman?» [Ha][Yo'q]
  E->>YS: POST /letters/{id}/consent {AGREE, otp}
  YS->>YS: Document PDF+DOCX+QR, sha256, Signature(SMS_OTP)
  M->>YS: POST /letters/{id}/submit {signatureLevel: PAPER}
  YS->>VF: POST /api/integrations/yuksaroy/letters (Bearer secret)
  Note over M,DS: F1 gibrid — mijoz chop etib muhr bilan topshiradi, QR bilan tekshiriladi
  DS->>VF: /station/letters/{id} → Ruxsat, permitNo, validFrom/To
  VF->>YS: webhook letter.decided {PERMITTED, permitNo}
  YS->>VF: POST /api/integrations/yuksaroy/wagon-memos [{wagonNo, SUPPLY, note permitNo}]
  DSP->>VF: WagonMemo → PLACED, at
  VF->>YS: webhook wagon_memo.responded {id, status, at}
  YS->>M: push «Vagon shahobchaga qo'yildi 14:20»
```

Nima uchun VF ichida: DS/DSP allaqachon VF da (`STATION_WORKER`, `DNCH`, `UserStation`); ikkinchi tizim = ikkinchi login = qabul qilinmaydi (PM ning o'zi rad etgan). VF tarafida o'zgarish (4.3 bilan bir xil, F1 + F2 jami): 4 route (`requests`, `letters`, `wagon-memos`, `stations`/`sidings`) + 1 ekran (`/station/letters`) + 3 webhook (`request.status_changed`, `letter.decided`, `wagon_memo.responded`) + `Request.externalRef` ustuni + minimal `Letter` jadvali. Alternativa (YS da `(station)` route group) — faqat O'TY VF ekranini rad etsa; shunda ham `RAILWAY_STATION` OrgKind F2 da qo'shiladi, 8a fallback esa F1 dan bor.

### 3.4 Oqim 4 — TY kod olish

| # | Ekran | Aktor | Hodisa | Holat |
|---|---|---|---|---|
| 1 | `/kabinet/ty-kod` | Mijoz | Cheklist (ustav, direktor buyrug'i, bank rekvizit), shablonlar yuklab olinadi, `TyCodeApplication` DRAFT | DRAFT |
| 2 | ↑ | Mijoz | e-nakl.railway.uz deep-link («Ro'yxatdan o'tish»), holatni o'zi belgilaydi | IN_PROGRESS |
| 3 | `/boshqaruv/ty-kod` | Operator | Maslahat (telefon), F1 da mijoz nomidan kirish **yo'q** (oferta taqiqi) | IN_PROGRESS |
| 4 | `/kabinet/ty-kod` | Mijoz | Kod + ELS keldi → `Organization.tyCode` | DONE |

SLA jadvalida «3 ish kuni» olib tashlandi («O'TY tartibida»). Monetizatsiya: cheklist/maslahat bepul (voronka), «stol uslug» SMGS/GU-27/qayta jo'natish tayyorlash uchun.

### 3.5 Oqim 5 — «Stol uslug»

`/kabinet/hujjatlar/yangi` → `DocType` (GU27_NAKLADNOY, SMGS, RESHIP, VU_ACT_SET) → narx → `Document(status=ORDERED, slaDueAt=+4 ish soati)` → `/boshqaruv/hujjatlar/[id]` mutaxassis (docx shablon; `pdf-lib` blank to'ldirish F2) → READY → mijoz kabinetiga + buyurtmaga biriktiriladi → 1 marta bepul REVISION. ERI F2. H8: 30 kunda ≥ 40 buyurtma bo'lmasa faqat SMGS/qayta jo'natish qoladi.

### 3.6 Oqim 6 — Aktivlar bozori (F2)

`/aktivlar/yangi` (KYC o'tgan egasi) → `AssetListing` MODERATION → admin 24 soat → ACTIVE → mijoz «So'rov» → `AssetDeal` REQUESTED → NEGOTIATION → AGREED (e'lon haqi; bank eskrou F3) → IN_PROGRESS (vagon raqamlari topshirildi) → COMPLETED (qabul akti, baho). Lokomotiv e'loni: `permitNo`, `permitUntil`, `scope=PRIVATE_SIDING_ONLY` majburiy, verifikatsiyasiz ko'rinmaydi.

### 3.7 Oqim 7 — Ekspeditor buyurtma (F2)

Buyurtma 2-ekranida «mutaxassis kerak» → `SpecialistOrder OPEN` → `/mutaxassis/lenta` (2 soat SLA, birinchi qabul qilgan oladi) → ASSIGNED → IN_PROGRESS → COMPLETED (baho); to'lov bank o'tkazma, eskrou F3. Nizo → arbitraj 3 ish kuni.

---

## 4. Umumiy arxitektura

### 4.1 Qaror: Next.js monolit + worker, VagonFlow bilan bir stack (ADR-0001)

**Qaror.** Bitta Next.js 16 ilovasi (`apps/web`): landing, kabinetlar, admin va REST Route Handlers (`/api/*`, mobil va bot ham shu API ni ishlatadi). Uzoq/qayta uriniladigan ishlar — `apps/worker` (oddiy Node process: node-cron + `OutboxEvent` poll + `Job` jadvali). Bitta Postgres 17 `yuksaroy` bazasi. VagonFlow bilan DB ulanmaydi — faqat REST + webhook.

**Nega.** VagonFlow kodi (auth/session, i18n, translit, railmap client, FCM, Telegraf bot, AuditLog, DeviceToken, compose + ssh deploy) 0 ga yaqin o'zgarish bilan ko'chadi; bitta til, bitta deploy; 300 buyurtma/oy pilotga ikkinchi runtime (NestJS), ikkinchi navbat (Redis) kerak emas.

**Alternativa.** NestJS + Fastify + BullMQ (backend linzasi) — modul chegaralari yaxshi, lekin 2 runtime, 2 auth, 2 validatsiya; F3 da `payments`/`tracking` alohida servisga chiqarish kerak bo'lsa — o'shanda. Backend linzasidagi modul chegaralari `apps/web/src/features/*` papkalari va `packages/domain` sifatida saqlanadi.

**Xavf.** Route Handler request-scoped — 30 s dan uzun ishlar (PDF 20 sahifa, xlsx 18 428 qator) worker ga ketadi (`Job` jadvali). Yuk kuniga 10 ming job dan oshsa — pg-boss (Postgres-asosli), keyin Redis.

```mermaid
flowchart TB
  subgraph Users[Foydalanuvchilar]
    U1[Mijoz / logist - brauzer, PWA]
    U2[Terminal / LC / SVX]
    U3[Shahobcha egasi - Telegram bot]
    U4[Platforma operatori]
    U5[DS / DSP - VagonFlow ichida]
  end
  subgraph YS[YukSaroy - UzCloud, docker-compose]
    NG[nginx - TLS, limit_req, static]
    WEB[apps/web - Next.js 16 - landing + kabinetlar + /api Route Handlers - requireRole + prisma.forTenant]
    WK[apps/worker - node-cron: hold.expire, sla.expire, letter.expire; outbox relay; webhook deliver; pdf/docx render]
    BOT[apps/bot - Telegraf @yuksaroy_bot: holat, tasdiq, rozilik OTP]
    DB[(Postgres 17 - 41 model F1, OutboxEvent, AuditLog, Event)]
    S3[(UzCloud S3 - PDF, DOCX, foto; dev: MinIO)]
    MON[Uptime Kuma + Grafana/Prometheus - exporters, pino JSON]
  end
  subgraph EXT[Tashqi tizimlar]
    VF[VagonFlow - Station, Siding, Request, WagonMemo - /api/integrations/yuksaroy/*]
    RM[railmap.d-railway.uz - ESR to lat/lng]
    SMS[Eskiz SMS - OTP 95 so'm]
    TG[Telegram Bot API]
    EIMZO[E-IMZO server - F2]
    PAY[Payme/Click, Didox ESF - F2]
  end
  U1 --> NG
  U2 --> NG
  U4 --> NG
  NG --> WEB
  U3 --> TG --> BOT --> WEB
  U5 --> VF
  WEB --> DB
  WEB --> S3
  WK --> DB
  WK --> S3
  WK -->|Bearer shared secret| VF
  VF -->|webhook HMAC, X-Event-Id| WEB
  WEB --> RM
  WK --> SMS
  WK --> TG
  WEB -.F2.-> EIMZO
  WEB -.F2.-> PAY
  WEB --> MON
  WK --> MON
  DB --> MON
```

### 4.2 VagonFlow bilan munosabat

| Nima | Qayta ishlatiladi (ko'chiriladi) | Alohida (YukSaroy o'ziniki) |
|---|---|---|
| Kod | `auth/session.ts` (jose HS256 cookie, `sv` versiya), `middleware→proxy.ts`, `i18n.ts` + `translit.ts`, `phone.ts`, `date-fmt.ts`, `railmap/client.ts`, `push/fcm.ts` (F2), Telegraf bot skeleti, `AuditLog`/`DeviceToken`/`Notification` modellari, `export-excel.ts`, `ConfirmDialog`/`PhoneInput`/`LangSwitcher`, docker-compose + nginx + ssh-action deploy | Domen modellari (Terminal, Order, TimeSlot, StationLetter…), dizayn tokenlari, landing |
| Ma'lumot | `Station` (ESR, nomlar 4 tilda), `Siding` (master — VF), `Client.inn` → `vfClientId`, `Request` holati | Organization/User (o'z PII), tariflar, buyurtmalar, hujjatlar |
| Jarayon | Vagon talabnomasi (GU-12) — faqat VF; DSP naryadi — faqat VF `WagonMemo`; stansiya inboxi — VF | Slot, narx, buyurtma, xat konstruktori, rozilik, akt/faktura |
| Rollar | VF `STATION_WORKER/DNCH/CONSIGNEE` o'z tizimida qoladi | YS `OrgKind × OrgRole`; VF `CONSIGNEE` vaqt o'tib YS `SHIPPER` ga ko'chadi (ixtiyoriy) |
| Deploy/repo | Alohida monorepo, alohida VPS, alohida yuridik shaxs | — |

Nega alohida DB: O'TY ichki tizimi (`STATION_WORKER`) marketpleys PII/pul jadvallarini ko'rmasligi kerak; migratsiya sikllari bog'lanmaydi; audit perimetri aniq.

### 4.3 Integratsiya xaritasi (kontrakt)

| Kim chaqiradi → kimni | Endpoint | Auth | Payload | Faza |
|---|---|---|---|---|
| YS → VF | `POST /api/integrations/yuksaroy/requests` | `Authorization: Bearer <shared secret>` (env, 90 kun rotatsiya) | `{externalRef: orderNo, stationEcp, clientInn, businessDate, requiredWagons, wagonType, ownership, cargoType, direction, destinationStationEcp}` → `{vfRequestId}` | F1 |
| YS → VF | `POST /api/integrations/yuksaroy/letters` | ↑ | `{letterNo, stationEcp, sidingVfId, orgStir, orgName, cargoEtsng, wagonNos[], periodFrom, periodTo, contractNo, pdfUrl, qrUrl, signatureLevel}` → `{vfLetterId}` | F1 (VF ekrani S6 gacha) |
| YS → VF | `POST /api/integrations/yuksaroy/wagon-memos` | ↑ | `[{stationEcp, sidingVfId, clientInn, wagonNo?, operation: SUPPLY, businessDate, note: permitNo}]` → `[{wagonMemoId}]` | F2 |
| YS → VF (GET, `vf.sidingSync` kunlik) | `GET /api/integrations/yuksaroy/stations`, `/sidings?stationEcp=` | ↑ | Siding: `id, railmapId, registryRef, name, ownerName, lengthM, capacityWagons, occupiedWagons, contractState, usageType, locoType, loadNorm, unloadNorm` — kunlik sinxron (`VfSyncLog`) | F1 |
| VF → YS | `POST /api/webhooks/vagonflow` | HMAC-SHA256 `X-VF-Signature`, `X-Event-Id` (DB unique → dedupe) | `request.status_changed {vfRequestId, status, lifecycleStage, providedWagons[]}`, `letter.decided {vfLetterId, decision, permitNo, validFrom, validTo, reason}`, `wagon_memo.responded {id, status PLACED \| NOT_PLACED, at, responseNote}` | F1 / F2 |
| YS → railmap | `GET railmap.d-railway.uz/api/stations?esr=` | mavjud klient | lat/lng, geometriya | F1 |
| YS → Eskiz | `POST notify.eskiz.uz/api/message/sms/send` | token 30 kun | OTP, rozilik kodi | F1 |
| YS ↔ Telegram | Bot API (Telegraf) | bot token | Inline tugmalar: tasdiq/rad, «Qarshi emasman» | F1 |
| YS → E-IMZO | `e-imzo-server /backend/pkcs7/verify/attached`, `/frontend/timestamp/pkcs7`; mobil deeplink (SiteID, DocumentID, hash, CRC32) | VPN kalit (shartnoma) | PKCS7 attached | F2 |
| YS ↔ Payme/Click | Merchant API | merchant kalitlari | slot/hujjat/e'lon to'lovi | F2 |
| YS → Didox | ESF/akt API | shartnoma | Invoice → ESF | F2 |

VF tarafidagi o'zgarish jami: 4 route, 1 ekran (`/station/letters`), 3 webhook, `Request.externalRef` va `Letter` jadvali (VF da minimal: `id, ysLetterNo, stationId, sidingId, pdfUrl, status, permitNo`).

---

## 5. Frontend

### 5.1 Stack

**Qaror.** Next.js 16.3 (App Router, `cacheComponents`, `reactCompiler`, `proxy.ts`) + React 19.2 + TypeScript 5.9; Tailwind v4 `@theme` + shadcn/ui (VagonFlow `components.json` new-york, lucide); TanStack Query v5 (kabinet) + RSC `use cache` (ochiq sahifalar); react-hook-form + zod 4 (sxema `packages/domain`); recharts 3; `@react-pdf/renderer` + `docx`; R3F 9 + drei (faqat landing, lazy). Node 24 LTS hamma joyda (CI ham).

**Nega.** VagonFlow bilan bir xil major — `translit.ts`, `auth/session.ts`, `railmap/client.ts`, 15 ta `ui/*` komponent, `ConfirmDialog`, `PhoneInput` to'g'ridan-to'g'ri ko'chadi; PPR/`use cache` katalog uchun aynan kerak. **Versiya farqi (ADR-0002).** VagonFlow hozir Next.js 16.2 da; YukSaroy 16.3 dan boshlaydi (yangi loyiha — eski minor bilan boshlash ma'nosiz), VagonFlow 16.3 ga S1–S2 oralig'ida birga ko'tariladi (`next` codemod + `pnpm turbo test`), shunda port qilinadigan fayllar bir xil API da qoladi; minor farq bir sprintdan uzoq turmaydi. **Alternativa.** Remix/Vite SPA/Astro — kod ko'chmaydi, SEO/PPR yo'q. HeroUI v3 — beta, migratsiya yo'q; «lol qoldirish» kutubxonadan emas, tokenlar + hero'dan keladi. **Xavf.** Next 16.3 API o'zgarishlari — context7 bilan har PR da tekshiriladi (15-bo'lim).

### 5.2 Monorepo daraxti (bitta, yakuniy)

```
yuksaroy/
├── pnpm-workspace.yaml          # apps/*, packages/*; catalog: next, react, prisma, zod
├── turbo.json                   # tasks: lint, typecheck, test, build, e2e
├── package.json                 # engines node>=24
├── .github/workflows/ci.yml     # 13-bo'lim
├── infra/
│   ├── compose.dev.yml          # db, minio, mailpit
│   ├── compose.prod.yml         # db, web, worker, bot, nginx, backup  (5+1 konteyner)
│   ├── nginx/app.conf
│   └── deploy.sh                # VagonFlow ssh-action + GHCR pull
├── apps/
│   ├── web/                     # Next.js 16
│   │   ├── next.config.ts
│   │   ├── proxy.ts             # verifySession (jose HS256) + lang cookie — VagonFlow porti
│   │   ├── public/
│   │   │   ├── hero/hero-720.h264.mp4  hero-720.av1.mp4  hero-m.h264.mp4  poster-d.avif  poster-d.webp  poster-m.avif  poster-m.webp
│   │   │   ├── fonts/           # Unbounded-700, Manrope-var, JetBrainsMono-500 (Uzbek-Cyrl subset)
│   │   │   ├── data/railmap.min.json     # 3D sahna uchun (≤80 KB gz)
│   │   │   └── manifest.webmanifest
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx  globals.css
│   │       │   ├── (marketing)/ page.tsx  terminallar/  terminallar/[slug]/  aktivlar/  aktivlar/[id]/  tekshir/[code]/  oferta/
│   │       │   ├── (auth)/ kirish/  royxat/  rol-tanlash/
│   │       │   ├── (kabinet)/kabinet/  page.tsx  buyurtma/yangi/  buyurtmalar/  buyurtmalar/[no]/  xatlar/  xatlar/yangi/  xatlar/[id]/  hujjatlar/  ty-kod/  sozlamalar/
│   │       │   ├── (terminal)/terminal/  page.tsx  talabnomalar/  talabnomalar/[no]/  slotlar/  tariflar/  pasport/  tushum/
│   │       │   ├── (egam)/egam/  roziliklar/  roziliklar/[id]/  shahobchalarim/
│   │       │   ├── (boshqaruv)/boshqaruv/  analitika/  terminallar/  tashkilotlar/  kyc/  hujjatlar/  xatlar/  tolovlar/  sozlamalar/
│   │       │   ├── tma/                     # Telegram Mini App (F2): initData HMAC → sessiya
│   │       │   └── api/                     # 6-bo'lim ro'yxati
│   │       ├── features/                    # domen bo'yicha (backend linzasi modullari shu yerda)
│   │       │   ├── identity/  catalog/  booking/  orders/  pricing/  documents/  letters/  assets/  notifications/  admin/  hero/
│   │       │   └── (har birida) api.ts (route handler mantiq) · service.ts · ui/*.tsx · schema.ts
│   │       ├── lib/ auth/  prisma.ts (forTenant ext)  idempotency.ts  outbox.ts  events.ts  format.ts  railmap/
│   │       └── i18n/ (packages/i18n dan re-export)
│   ├── worker/                  # Node process: cron/*.ts (hold-expire, sla-expire, letter-expire, retention), outbox-relay.ts, jobs/ (render-pdf, render-docx, import-xlsx)
│   ├── bot/                     # Telegraf, VagonFlow bot skeleti; scenes: status, decide, consent
│   ├── e2e/                     # Playwright: order, slot-conflict, letter, a11y, locales
│   └── mobile/                  # F2, Expo SDK 55
├── packages/
│   ├── db/                      # prisma/schema.prisma, migrations/, seed/, crypto.ts (AES-GCM phone)
│   ├── domain/                  # enums.ts, order-fsm.ts, letter-fsm.ts, calcQuote.ts, wagonCheckDigit.ts, zod/*.ts, api-client.ts (1 fayl) — 100 % test
│   ├── ui/                      # tokens.css (@theme), components/ (shadcn), patterns/ (StatusPill, SlaTimer, MoneyText, DataTable, EmptyState), icons/ (12 domen ikonasi)
│   ├── i18n/                    # oz.json (manba), uz.json (translit + exceptions.json), ru.json, t.ts, translit.ts
│   └── config/                  # eslint, tsconfig, prettier
└── docs/ adr/  runbooks/  security/  glossary.md  facts.md
```

Nega admin/landing alohida app emas: bir auth, bir DB, bir tokenlar; alohida deploy ritmi faqat F3+. `apps/tma` yo'q — `/tma` route (Vite ilovasi = ikkinchi build).

### 5.3 Route xaritasi va guard

| `orgKind` (JWT) | Prefiks | F1 sidebar (7 band, `featureFlags` bilan) |
|---|---|---|
| mehmon | `/` | Bosh, Terminallar, Aktivlar (shahobchalar), Tekshir |
| SHIPPER / LOGISTICS / FORWARDER | `/kabinet` | Bosh sahifa · **Yangi buyurtma** (CTA) · Buyurtmalar · Terminallar · Hujjatlar (stol uslug + xatlar) · TY kod · Sozlamalar |
| TERMINAL | `/terminal` | Bugun · Talabnomalar (SLA) · Slotlar · Tariflar · Pasport · Tushum · (F2) E'lonlar |
| ASSET_OWNER | `/egam` | Roziliklar · Shahobchalarim · (F2) E'lonlarim |
| PLATFORM | `/boshqaruv` | Analitika · Terminallar · Tashkilotlar/KYC · Hujjatlar · Xatlar (8a fallback) · To'lovlar · Sozlamalar |

Guard 2 qatlam (VagonFlow naqshi): `proxy.ts` — sessiya imzosi bor/yo'q; har route-group `layout.tsx` — `await requireRole(orgKind[], orgRole?)`; API — `requireRoleApi()` 403 JSON + `prisma.forTenant(session)` (where `orgId`/`terminalId` avtomatik). Ko'p-rolli akkaunt: `activeMembershipId` cookie, `RoleSwitcher`. Sidebar 12→7: Hick qonuni, «tez kunda» sahifa yo'q. ⌘K qidiruv F1 da faqat buyurtma № va terminal.

### 5.4 Dizayn tizimi — tokenlar (bitta manba `packages/ui/tokens.css`)

```css
@theme {
  --color-navy: #0D1C2F;   --color-navy-700: #122A44;
  --color-teal: #0E9384;   --color-teal-ink: #0B7568;  --color-teal-soft: #DFF1EE;  /* primary action = teal-ink (oq matn 5.6:1) */
  --color-amber: #C77E1E;  --color-amber-ink: #8F5A12; --color-amber-soft: #F7EDDA; --color-amber-hi: #E0A24A;
  --color-page: #F6F1E7;   --color-surface: #FFFFFF;   --color-sand: #E9DCC3;  --color-sand-soft: #F6F0E3;  /* brend: iliq qum */
  --color-ink: #141821;    --color-muted: #5B6473;     --color-rail: #8DA0B3;
  --color-good: #2E7D32;   --color-warn: #B26A00;      --color-bad: #B3372F;
  --font-display: "Unbounded", system-ui;  --font-sans: "Manrope", system-ui;  --font-mono: "JetBrains Mono", monospace;
  --radius-1: 6px; --radius-2: 12px; --radius-3: 20px; --radius-arch: 999px 999px 12px 12px;
  --shadow-2: 0 8px 24px -12px rgb(16 35 59 / .25);
  --dur-1: 80ms; --dur-2: 160ms; --dur-3: 240ms; --dur-4: 400ms; --dur-5: 700ms;
  --ease-standard: cubic-bezier(.2,0,0,1); --ease-emph: cubic-bezier(.05,.7,.1,1); --ease-exit: cubic-bezier(.3,0,1,1);
}
.dark { --color-page:#0A141F; --color-surface:#111E2E; --color-teal:#2FC2B0; --color-teal-ink:#5BD6C6; --color-amber:#E0A24A; --color-amber-ink:#F0BC6A; --color-ink:#E6EDF5; --color-muted:#9AA3B2; --color-sand:#3A3222; }
```

Qaror (palitra ziddiyati): **demo tokenlari g'olib, brend linzasidan iliq fon (`--color-page #F6F1E7`) va motivlar olinadi; 3 logo SVG shu tokenlarga qayta bo'yaldi** (9-bo'lim). Nega: UI kontrast lint allaqachon shu HEX larda; logo qayta bo'yash 3 fayl. Style Dictionary/tokens.json yo'q; mobil `theme.ts` — shu CSS ni o'qiydigan 30 qatorli skript (F2).

Kontrast qoidalari: `teal #0E9384` oq fonda 3.8:1 → faqat ≥24 px, ikonka, chiziq; matn/tugma — `teal-ink`; `amber` matn uchun emas — `amber-ink`. Stylelint `a11y/color-contrast`.

Tipografika: Unbounded **700** (bitta fayl; H1/H2/hero raqamlar, sahifada ≤2 display), Manrope variable (bitta fayl), JetBrains Mono 500 (vagon №, STIR, ESR, summa; `tabular-nums`). Subset — Google `cyrillic` diapazoni Қ/Ғ/Ҳ ni o'z ichiga olmaydi: `pyftsubset --unicodes='U+0000-00FF,U+02BB-02BC,U+0400-045F,U+0490-04B3,U+04D8-04D9,U+2116,U+202F,U+2019'`; `next/font/local` + `adjustFontFallback`; jami ≈110 KB. Playwright: `document.fonts.check('16px Manrope','Ҳ')`.

Komponentlar: shadcn (Button, Badge, Card, Dialog, Sheet, Table, Tabs, Input, Select, Toast=sonner) + patterns: `StatusPill` (enum → rang+ikon+matn), `SlaTimer` (`<time role="timer" aria-live="off">` + alohida polite region holat o'zgarganda), `MoneyText`, `DataTable` (TanStack + virtual), `EmptyState`, `Stepper`, `PhoneInput`, `StirInput` (9 raqam + reestrdan topish), `FileDrop`, `LangSwitcher`, `RoleSwitcher`. Sana — `<input type="date">`, kutubxona yo'q. Xarita F1 — `SidingMap` SVG (demo `spurMap`) + stansiya ro'yxati; MapLibre F2.

### 5.5 Data-qatlam

- Ochiq sahifalar: RSC + `"use cache"` + `cacheTag('terminal:'+slug)`, `cacheLife('hours')`; pasport yangilansa `updateTag`. PPR: qobiq statik, «bugungi bo'sh slotlar» `<Suspense>`.
- Kabinet: TanStack Query, `staleTime 60 s`, `refetchInterval 15 s` faol sahifalarda (talabnomalar inbox, slot grid) — **SSE/LISTEN-NOTIFY F1 da yo'q** (20+ terminal bo'lganda). Kalitlar `['orders',{orgId,status}]`, `['slots',terminalId,date]`, `['letter',id]`.
- Mutatsiyalar: REST Route Handlers (bot/mobil ham shu); Server Actions faqat cookie (til, tema). `Idempotency-Key` UUID barcha POST larda (DB `IdempotencyKey` unique, 24 soat).
- Optimistik: `useSlotHold` — `onMutate` slot HELD, 409 → rollback + toast; `heldUntil` countdown serverdan (`PlatformConfig.slotHoldTtlMin`), 2 daqiqa qolganda amber + «Uzaytirish» (1 marta, +3 daq).
- `packages/domain/api-client.ts` — fetch wrapper + zod javob sxemalari (VagonFlow mobil `api.ts` asos); tRPC yo'q.

### 5.6 i18n

`packages/i18n` = VagonFlow `i18n.ts` porti (funksiya-kalitlar, `t()`), **next-intl yo'q**. Locale `lang` cookie, URL prefiksi yo'q. **Manba `oz.json` (kirill — soha atamalari, DS/terminal auditoriyasi)**; `uz.json = translit(oz, exceptions.json)` (СВХ→SVX, ГУ-27→GU-27, ЎТЙ→O'TY, Е→Ye so'z boshida, Ц→S/Ts) PR da commit; `ru.json` qo'lda. Default locale: `TERMINAL`/egasi/operator → `oz`, mehmon → `Accept-Language`. K7 = **Must F1**. Foydalanuvchi matni kiritilgan alifboda saqlanadi (`textScript`), ko'rsatishda `translit()` faqat kirill→lotin. `formatSum` (U+202F), sana `dd.MM.yyyy HH:mm`, TZ `Asia/Tashkent` qat'iy.

### 5.7 PWA

F1: `manifest.webmanifest` + ikonlar + statik `Cache-Control` — service worker **yo'q**; `InstallPrompt` (iOS yo'riqnoma). Web Push (VAPID, `web-push`) — `DeviceToken(platform:'web')`. Serwist/offline navbat — pilot loglarida «internetsiz buyurtma yo'qoldi» ko'rinsa (F2). Idempotency-Key F1 dayoq.

### 5.8 Performance byudjeti (CI bloklaydi: `lighthouserc.json`, `budgets.json`)

| Metrika | Landing (4G, Moto G4) | Kabinet |
|---|---|---|
| LCP | ≤ 2,0 s (3G ≤ 3,5 s) — LCP = `<picture>` poster | ≤ 2,5 s |
| INP / CLS | ≤ 200 ms / ≤ 0,05 | ≤ 200 ms / ≤ 0,05 |
| JS boshlang'ich (gz) | **≤ 150 KB** | ≤ 180 KB |
| 3D chunk | ≤ 200 KB, lazy, faqat desktop tier ≥ 2 | — |
| Shriftlar | 3 fayl ≈ 110 KB | |
| Video | H.264 ≤ 1,8 MB (720p) / mobil ≤ 0,9 MB | — |
| Scroll TBT | < 50 ms, long task 0 (mobil profil) | |

### 5.9 Testlar

vitest 4: `calcQuote`, `translit`, zod sxemalar, `order-fsm`/`letter-fsm`, `wagonCheckDigit`, hold TTL; RTL faqat `SlotGrid`, `PriceBreakdown`, `LetterBuilder`. Playwright: `order.spec` (3 ekran → tasdiq), `slot-conflict.spec` (2 kontekst bir slot → 409, TTL config dan), `letter.spec` (xat → PDF 200 + docx + rozilik OTP), `a11y.spec` (`@axe-core/playwright`, 8 sahifa, 0 serious; qo'lda: WCAG 2.2.2 video pauza), `locales.spec` (oz/uz/ru, layout diff < 2 %), `tenant.spec` (har endpoint «boshqa mijoz → 403»). Storybook yo'q — `/dev/ui` galereya.

---

## 6. Backend

### 6.1 Modullar (`apps/web/src/features/*` + `packages/domain`)

| Modul | Mas'uliyat | F1 entitylar | Tashqi |
|---|---|---|---|
| `identity` | OTP, sessiya (HS256 cookie), Organization/Membership, KYC navbati, STIR reestr qidiruvi | User, Organization, Membership, OtpCode, KycCheck | Eskiz, (F2) E-IMZO/OneID |
| `catalog` | Terminal pasporti, xizmatlar, tarif versiyalari, reyting agregati | Terminal, TerminalService, Tariff, Review | S3 (foto), railmap |
| `booking` | TimeSlot sig'imi, hold/confirm/release, no-show | TimeSlot, SlotBooking | `orders` |
| `orders` | Buyurtma FSM, VF talabnoma bog'i, hodisalar | Order, OrderItem, OrderExtra, OrderStatusHistory, WagonBatch, WagonBatchWagon | `booking`, `pricing`, VF |
| `pricing` | `calcQuote()` — `packages/domain`, formula konfiguratsiyada | PlatformConfig | `catalog.Tariff` |
| `documents` | Akt/Invoice/xat PDF (react-pdf), DOCX, QR, «stol uslug» navbati | Document, DocumentTemplate, Invoice, Signature, File | S3, (F2) E-IMZO, Didox |
| `letters` | Stansiya xati FSM, rozilik, ruxsat, VF letter/wagon-memo | StationLetter, LetterWagon, SidingConsent, StationPermit | VF, `documents` |
| `assets` | Siding ko'zgusi, «claim», (F2) Asset/Listing/Deal | Siding | VF sinxron |
| `notifications` | Kanal tanlash (Telegram → Web Push → SMS), shablon `{name}`, retry | Notification, DeviceToken | Telegraf, web-push, Eskiz |
| `admin` | PlatformConfig, KYC tasdiq, SLA monitor, 8a xat fallback, to'lov belgisi | AuditLog, Event | — |
| `integrations` | Outbox relay, webhook qabul (dedupe), VF adapter (`INTEGRATION_MODE=fake \| live`) | OutboxEvent, InboundEvent, VfSyncLog | VF |
| `reference` | Station, CargoType (ETSNG + pg_trgm), WagonType, import skriptlari | Station, CargoType, WagonType, ImportBatch/Row | xlsx |

Modul qoidasi: `features/A` faqat `features/B/index.ts` (public) ni import qiladi — ESLint `no-restricted-imports` bilan (eslint-plugin-boundaries kerak emas).

### 6.2 API ro'yxati (Route Handlers, `/api/*`, 85 endpoint F1)

Umumiy: zod validatsiya chegarada; xato `application/problem+json` `{code, title, detail, errors[]}`; cursor pagination `{data, nextCursor}`; `Idempotency-Key` barcha POST; `If-Match` slot/tarif/xat tahririda.

| Modul | Endpointlar |
|---|---|
| auth | `POST /api/auth/check-phone` · `POST /api/auth/otp` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/me` · `PATCH /api/me` · `POST /api/me/memberships/switch` |
| orgs | `POST /api/orgs` · `GET /api/orgs/[id]` · `PATCH /api/orgs/[id]` · `GET /api/orgs/lookup?stir=` (import reestri) · `POST /api/orgs/[id]/kyc` (hujjat yuklash) · `GET /api/orgs/[id]/members` · `POST /api/orgs/[id]/members` · `DELETE /api/orgs/[id]/members/[uid]` |
| reference | `GET /api/stations?q=` · `GET /api/stations/[esr]` · `GET /api/cargo-types?q=` (pg_trgm) · `GET /api/wagon-types` · `GET /api/config` (public PlatformConfig qismi) |
| catalog | `GET /api/terminals?station=&service=&sort=` · `GET /api/terminals/[slug]` · `PATCH /api/terminals/[id]` · `POST /api/terminals/[id]/photos` · `GET /api/terminals/[id]/tariffs` · `POST /api/terminals/[id]/tariffs` (yangi versiya) · `GET /api/terminals/[id]/reviews` · `POST /api/quote` (login'siz tez hisob) |
| booking | `GET /api/terminals/[id]/slots?date=` · `POST /api/slots/hold` · `POST /api/slots/hold/[id]/extend` · `DELETE /api/slots/hold/[id]` · `PUT /api/terminals/[id]/slots` (terminal sig'im/oynalar) |
| orders | `POST /api/orders` · `GET /api/orders` · `GET /api/orders/[no]` · `POST /api/orders/[no]/confirm` · `POST /api/orders/[no]/reject` · `POST /api/orders/[no]/cancel` · `POST /api/orders/[no]/events` · `GET /api/orders/[no]/timeline` · `POST /api/orders/[no]/review` · `GET /api/orders/[no]/act.pdf` · `GET /api/orders/[no]/invoice.pdf` |
| documents | `GET /api/document-types` · `POST /api/documents` · `GET /api/documents` · `GET /api/documents/[id]` · `GET /api/documents/[id]/file` · `POST /api/documents/[id]/revision` · `POST /api/documents/[id]/ready` (operator) · `GET /api/verify/[qrToken]` (public) |
| letters | `POST /api/letters` · `GET /api/letters` · `GET /api/letters/[id]` · `PATCH /api/letters/[id]` · `GET /api/letters/[id]/preview` (HTML) · `GET /api/letters/[id]/pdf` · `GET /api/letters/[id]/docx` · `POST /api/letters/[id]/request-consent` · `POST /api/letters/[id]/consent` · `POST /api/letters/[id]/submit` · `POST /api/letters/[id]/decide` (operator 8a / VF webhook) · `GET /api/letters/[id]/permit.pdf` |
| assets | `GET /api/sidings?station=` · `GET /api/sidings/[id]` · `POST /api/sidings/[id]/claim` · `GET /api/sidings/map` (SVG uchun JSON) |
| notifications | `GET /api/notifications` · `POST /api/notifications/[id]/read` · `POST /api/devices` (web push subscribe) |
| ty-code | `POST /api/ty-code` · `GET /api/ty-code` · `PATCH /api/ty-code/[id]` |
| admin | `GET /api/admin/kyc` · `POST /api/admin/kyc/[id]/decide` · `GET /api/admin/sla` · `PATCH /api/admin/config` · `POST /api/admin/invoices/[id]/paid` · `GET /api/admin/outbox` · `GET /api/admin/analytics/[kind]` |
| integrations | `POST /api/webhooks/vagonflow` · `GET /api/health` · `POST /api/events` (frontend event batch) · `POST /api/client-errors` (20 qator, Sentry o'rniga) |
| F2 qo'shiladi | `/api/payments/*` (webhook, intent), `/api/assets/*`, `/api/deals/*`, `/api/loco/requests`, `/api/specialists/*`, `/api/tma/auth`, `/api/mobile/*` (track batch, devices), `/api/documents/[id]/sign` (PKCS7) |

### 6.3 Auth / RBAC

- Kirish: `+998` + 6 xonali OTP (Eskiz, 5 daq, 3 urinish; `OtpCode` da urinish soni; nginx `limit_req`). Sessiya — **VagonFlow `auth/session.ts` aynan**: jose HS256 cookie (`httpOnly; Secure; SameSite=Lax`), `sv` (session version — «barcha qurilmalardan chiqish»), 7 kun; refresh/JWKS/Session jadvali — mobil bilan (F2); admin TOTP — to'lov bilan (F2).
- Claim: `{sub, memberships:[{orgId, orgKind, orgRole, terminalId?}], active: membershipId, sv}`.
- **RBAC = `OrgKind × OrgRole`** (data linzasi): `OrgKind {SHIPPER LOGISTICS FORWARDER TERMINAL ASSET_OWNER PLATFORM}` (F1; DECLARANT, CARRIER F2), `OrgRole {OWNER MANAGER OPERATOR ACCOUNTANT VIEWER}` (DRIVER F2). Prefiks = f(orgKind).
- Ikki qatlam: `requireRole()` (layout/route) + `prisma.forTenant(session)` extension (`where: {orgId}` / `{terminalId}` avtomatik, bo'sh scope = fail-closed) + `tenant.spec` 403 testlari. RLS va CASL **yo'q**.
- Profil egallash (reality-critical): STIR kiritilganda reestrdan faqat `name/homeStation` ko'rsatiladi, `kycStatus=PENDING`; buyurtma berish `VERIFIED` dan keyin — F1: operator hujjat (guvohnoma skani) + direktor bilan qo'ng'iroq (SLA 1 ish kuni); F2: E-IMZO challenge-auth (sertifikat TIN == STIR) avtomatik. `KycSource {EIMZO ONEID MANUAL}`.
- Servis-to-servis: shared-secret Bearer (env, 90 kun) + webhook HMAC + `X-Event-Id` unique — 20 qator; RS256/JWKS/mTLS yo'q (bir ega, bir bulut).

### 6.4 State machine'lar (`packages/domain`)

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> PENDING: submit (hold + quote), slaConfirmUntil +30 daq
  PENDING --> CONFIRMED: terminal confirm (booking CONFIRMED, VF Request)
  PENDING --> REJECTED: terminal reject (sabab)
  PENDING --> EXPIRED: 30 daq cron, rating -0.05, slot RELEASED
  CONFIRMED --> IN_PROGRESS: event ARRIVED (placedAt = GU-45)
  IN_PROGRESS --> DONE: event LOADED/UNLOADED + akt Document
  DRAFT --> CANCELLED: mijoz
  PENDING --> CANCELLED: mijoz
  CONFIRMED --> CANCELLED: mijoz (F2: slot fee ushlanadi)
  DONE --> DISPUTED: F2, 72 soat
  DISPUTED --> DONE: arbitr
  DONE --> [*]
```

`OrderStatus {DRAFT PENDING CONFIRMED REJECTED EXPIRED IN_PROGRESS DONE CANCELLED DISPUTED}` — 9 (DISPUTED F2). To'lov holati `Invoice.status`/`Payment.status` da, Order da emas. Sub-hodisalar (`OrderStatusHistory.code`): `VF_REQUEST_CREATED, WAGONS_PROVIDED, ARRIVED, WEIGHED, LOADED, UNLOADED, RELEASED, ACT_ISSUED, INVOICE_PAID`. `BookingStatus {HOLD CONFIRMED RELEASED NO_SHOW}`; NO_SHOW F2 (slot oxiri + 60 daq, ARRIVED yo'q). `LetterStatus` — 3.3. SLA raqamlari faqat `PlatformConfig`: `terminalConfirmMin=30, slotHoldTtlMin=10, holdExtendMin=3, ratingPenalty=5 (0.05), ownerConsentH=48, letterExpireDays=1, commissionPct=0, commissionPayer=TERMINAL, docSlaHours=4, kycSlaDays=1` (to'liq SLA jadvali — 12.1).

O'tishlar faqat `transition(order, event, actor)` orqali (`Map<from, Map<event,to>>`, xstate yo'q); har o'tish `OrderStatusHistory` + `OutboxEvent` bitta tranzaksiyada.

### 6.5 Fon ishlari (`apps/worker`, node-cron, Redis yo'q)

| Job | Trigger | Mantiq |
|---|---|---|
| `hold.expire` | `* * * * *` | `SlotBooking HOLD AND holdExpiresAt < now` → RELEASED, `held--` (FOR UPDATE) |
| `sla.expire` | `* * * * *` | `Order PENDING AND slaConfirmUntil < now` → EXPIRED, rating, alternativa xabari |
| `letter.expire` | `0 1 * * *` | `periodTo + 1 < today` → EXPIRED; AWAITING_OWNER 48 soat → OWNER_DECLINED(timeout) |
| `outbox.relay` | poll 1 s (`setInterval`, `FOR UPDATE SKIP LOCKED`) | Telegram/push/SMS/VF/webhook yuborish, `attempts`, backoff 1m/10m/1h, 5 xato → `paused` + admin alert |
| `vf.sidingSync` | `0 3 * * *` | VF `/sidings` → `Siding` upsert, `VfSyncLog` |
| `render.job` | `Job` jadvali poll 5 s | PDF (react-pdf), DOCX, xlsx import — `concurrency 2` |
| `rating.recalc` | `*/15 * * * *` | `Terminal.ratingAvg`, `loadPct` denorm |
| `retention` | `0 4 * * 0` | OtpCode 10 daq, Notification 180 kun, ImportRow 30 kun; AuditLog/Document/Invoice — 5 yil |
| `audit.chainCheck` | `0 5 * * *` | `AuditLog.hash` zanjiri (F2 — pul paydo bo'lganda) |
| `backup.verify` | oylik 1-juma | pgBackRest restore stage ga, `orders` soni solishtirish |

F2 qo'shiladi: `demurrage.tick`, `slot.remind (-24h/-2h)`, `slot.noShowCheck`, `payment.reconcile`, `eta.alert`. Redis/pg-boss chegarasi: kuniga > 10 000 job yoki relay lag > 60 s.

### 6.6 Integratsiya adapterlari (interfeys + fake)

`features/integrations/<name>/{provider.ts, adapter.ts, fake.ts, health.ts}`; `INTEGRATION_MODE=fake|live`. `VagonFlowProvider` (requests, letters, wagonMemos, sidings), `SmsProvider` (Eskiz; PlayMobile ikkinchi), `ChatProvider` (Telegraf), `PushProvider` (web-push; FCM F2), `RailmapProvider`, (F2) `SignatureVerifier` (e-imzo-server), `PaymentProvider` (bitta), `EdoProvider` (Didox). `CompanyRegistry.lookup(stir)` — F1 faqat import qilingan `Organization` dan; IIP shartnomasi bo'lganda `SOLIQ_API` qo'shiladi. ASOUP — `WagonLocationProvider` interfeysi bor, implementatsiya `ManualLocationProvider` (VF/mijoz), O'TY API ochilguncha.

### 6.7 Xavfsizlik

- zod chegarada; Prisma parametrlangan; `next.config` headers: CSP nonce, HSTS, X-Frame DENY, Referrer-Policy; CORS faqat `APP_HOST` + mobil.
- PII: `User.phoneEnc` (AES-256-GCM, `PII_KEY` SOPS, `keyVersion`) + `phoneHash` (HMAC) lookup — `packages/db/crypto.ts` Prisma `$extends`; STIR ochiq; pasport skanlari faqat S3 alohida bucket, 30 kundan keyin faqat KYC natijasi; loglarda maskalash `+9989****01`.
- AuditLog append-only (app-rolga `REVOKE UPDATE, DELETE`), `prevHash/hash` ustunlari bor, zanjir tekshiruvi F2.
- Rate-limit: nginx `limit_req 10r/s burst 20`; OTP — `OtpCode` da telefon 3/10 daq, IP 20/soat; hCaptcha 3-urinishdan.
- Narx faqat serverda (`calcQuote`), klientdan faqat `terminalId, cargoTypeId, weightKg, extras[]`; quote 15 daq imzolangan (`hmac`).
- Fayl: MIME + magic-bytes, 10 MB, presigned PUT S3, `Content-Disposition: attachment`; ClamAV F2.
- Slot poygasi: `SELECT ... FOR UPDATE` + `CHECK(booked+held<=capacity)`; `UNIQUE(terminalId, localDate, window)`.
- Sirlar: SOPS+age, `.env` git da yo'q; rotatsiya 90 kun; Payme/Click kalitlari faqat `payments` (F2).
- Pentest: ichki F1 oxiri (ASVS L2 chek-list, IDOR Playwright), tashqi — F2 to'lovdan oldin.

### 6.8 Papka daraxti — `features/letters` misoli

```
apps/web/src/features/letters/
├── index.ts                 # public: createLetter, requestConsent, giveConsent, submitLetter, decideLetter, LetterCard
├── schema.ts                # zod: CreateLetter {sidingId, cargoTypeId, operation, wagonNos[], periodFrom, periodTo, contractNo, contractFileId}
├── service.ts               # FSM (packages/domain/letter-fsm), tranzaksiya + history + outbox
├── render/
│   ├── LetterPdf.tsx        # @react-pdf/renderer: yuk egasi blankasi, vagon jadvali (mono), rozilik bloki, QR, footer
│   └── letter.docx.ts       # docx npm — foydalanuvchi shabloni (.docx) asosida
├── ui/
│   ├── LetterBuilder.tsx    # 4 qadam stepper (mobil ham), WagonNumbersInput (paste, VF providedWagons checkbox)
│   ├── LetterPreview.tsx    # HTML A4 / mobil 100 % kenglik
│   ├── ConsentBlock.tsx     # status, signedAt, method
│   └── LetterStatusStepper.tsx
└── __tests__/ letter-fsm.test.ts  render.test.ts
apps/web/src/app/api/letters/  route.ts  [id]/route.ts  [id]/{preview,pdf,docx,request-consent,consent,submit,decide,permit.pdf}/route.ts
```

---

## 7. Ma'lumotlar modeli

Konvensiya: `id String @id @default(cuid())` (VagonFlow Int bilan to'qnashmaydi; tashqi kalitlar `@unique`), `createdAt/updatedAt @db.Timestamptz(3)`, pul `BigInt` tiyin (`*Tiyin`), tenant jadvallarda `orgId` indeksli, soft-delete faqat katalog obyektlarida, moliya/audit jadvallari append-only. Postgres 17, Prisma 5.22 (Prisma 7 ga o'tish — alohida ADR, VagonFlow bilan bir vaqtda). `uuidv7()` kerak emas.

### 7.1 Entity jadvali (F1 = 41 model / 39 qator; jami 64 model / 52 qator)

Hisob: F1 qatorlari 1–39, ulardan 20 (`WagonBatch` + `WagonBatchWagon`) va 38 (`ImportBatch` + `ImportRow`) ikkitadan model — 39 + 2 = **41 F1 model**. F2: 40–51 qatorlar = 16 model (42, 48 ikkitadan, 50 uchta); F3: 52-qator = 7 model. Jami 41 + 16 + 7 = 64. Backend/data linzalaridagi 60+ F1 modeldan 41 qoldi; qolganlari 7.1 oxirida «O'chirilgan» ro'yxatida.

| # | Entity | Asosiy maydonlar | Faza | Izoh |
|---|---|---|---|---|
| 1 | Organization | kind OrgKind, name, stir @unique (9 raqam), address, director, tyCode?, homeStationId?, kycStatus, vfClientId? @unique, deletedAt? | F1 | STIR checksum yo'q — 9 raqam + reestr mavjudligi |
| 2 | User | phoneEnc, phoneHash @unique, name, locale, telegramId?, sv Int, lastLoginAt? | F1 | |
| 3 | Membership | userId, orgId, role OrgRole, terminalId?, isOwner, acceptedAt? @@unique([userId, orgId]) | F1 | |
| 4 | OtpCode | phoneHash, codeHash, purpose, attempts, expiresAt, usedAt? | F1 | rate-limit shu yerda |
| 5 | KycCheck | orgId, source KycSource, request Json, result, checkedById?, checkedAt | F1 | MANUAL F1 |
| 6 | PlatformConfig | key @id, value Json, updatedById | F1 | SLA/komissiya/TTL |
| 7 | Station | esrCode @unique (String, 6), nameUz/Oz/Ru/En, dor, regionCode?, lat?, lng?, vfStationId?, railmapId? | F1 | ESR import |
| 8 | CargoType | etsngCode @unique, groupCode, name, nameUz?, isBulk, tariffClass? | F1 | pg_trgm indeks |
| 9 | WagonType | code, name, axles, capacityT | F1 | |
| 10 | Siding | stationId, name, ownerOrgId?, ownerNameRaw? (yashirin, claim gacha), lengthM, capacityWagons, occupiedWagons, usageType, locoType, loadNorm?, unloadNorm?, contractEnd?, listingMode?, vfSidingId? @unique, registryRef?, railmapId?, syncedAt | F1 | VF master |
| 11 | Terminal | orgId, stationId, kind TerminalKind (YARD/CONTAINER/LC/SVX), slug, passport Json, hours Json, lat/lng, status, ratingAvg, ratingCount, loadPct, claimedAt? | F1 | |
| 12 | TerminalService | terminalId, serviceCode, isEnabled, leadTimeMin @@unique | F1 | ServiceCatalog = enum/config |
| 13 | Tariff | terminalId, serviceCode, version, validFrom, validTo?, priceTiyin, unit, tiers Json?, cargoGroupCode? | F1 | append-only, EXCLUDE gist |
| 14 | TimeSlot | terminalId, localDate @db.Date, window Int (1..n), startsAt, endsAt, capacity, booked, held, status @@unique([terminalId, localDate, window]) | F1 | CHECK booked+held<=capacity; `resourceId?` F2 |
| 15 | SlotBooking | slotId, orderId, status BookingStatus, holdExpiresAt?, extendedOnce, confirmedAt?, releasedAt? | F1 | |
| 16 | Order | no @unique, shipperOrgId, createdById, terminalId, stationId, direction, operation, cargoTypeId, weightKg, wagonCount, subtotalTiyin, extrasTiyin, commissionTiyin, commissionPayer, totalTiyin, status, slaConfirmUntil?, vfRequestId?, note? | F1 | kind faqat TERMINAL |
| 17 | OrderItem | orderId, serviceCode, tariffId (muzlatilgan), qty, unitPriceTiyin, amountTiyin | F1 | |
| 18 | OrderExtra | orderId, extraCode, priceTiyin, status, payload Json? | F1 | |
| 19 | OrderStatusHistory | orderId, fromStatus?, toStatus, code?, actorId?, actorRole?, reason?, payload Json?, at | F1 | append-only; ARRIVED/WEIGHED… shu yerda |
| 20 | WagonBatch / WagonBatchWagon | orderId, kind, vfRequestId?; wagonNo, seq, netKg?, sealNo?, placedAt? (GU-45), readyNoticeAt?, removedAt?, delayReason? | F1 | demurraj F2 shu maydonlardan |
| 21 | Document | templateCode, orgId, orderId?, letterId?, kind DocKind, payload Json, fileId?, sha256, qrToken @unique, status, preparedById?, slaDueAt? | F1 | |
| 22 | Signature | documentId, signerUserId, onBehalfOrgId, method SignMethod (SMS_OTP / EIMZO), certSerial?, pkcs7Ref?, signedAt, ip | F1 | EIMZO F2 |
| 23 | Invoice | no @unique, orgId, orderId?, amountTiyin, vatTiyin, status, dueAt, fileId?, paidAt?, paidMarkedById?, didoxId? | F1 | bank o'tkazma |
| 24 | File | bucket, key @unique, mime, sizeBytes, sha256, ownerOrgId?, uploadedById, isPublic | F1 | S3 |
| 25 | StationLetter | no @unique, shipperOrgId, sidingId, stationId, cargoTypeId, operation, periodFrom, periodTo, wagonCountPlanned, contractNo?, contractFileId?, signatureLevel, status LetterStatus, documentId?, sentAt?, decidedAt?, returnReason?, vfLetterId? | F1 | |
| 26 | LetterWagon | letterId, wagonNo, expectedAt?, vfWagonMemoId?, placedAt?, removedAt? @@id([letterId, wagonNo]) | F1 | |
| 27 | SidingConsent | letterId @unique, ownerOrgId, decidedByUserId, decision (AGREE / AGREE_WITH_CONDITIONS / DECLINE), conditions?, method, signatureId?, decidedAt | F1 | |
| 28 | StationPermit | letterId @unique, permitNo (DS matni), issuedByName?, issuedVia (VF / OPERATOR), validFrom, validTo, conditions?, scanFileId?, revokedAt? | F1 | |
| 29 | Review | orderId, fromOrgId, targetType, targetId, stars, text?, reply? | F1 | |
| 30 | Notification | userId, channel, template, payload, status, sentAt?, readAt?, providerRef? | F1 | |
| 31 | DeviceToken | userId, platform (web/android/ios), token @unique, lastSeenAt | F1 | VF porti |
| 32 | AuditLog | actorUserId?, actorOrgId?, action, entity, entityId, before?, after?, ip, prevHash, hash, at | F1 | append-only, 5 yil |
| 33 | OutboxEvent | aggregate, aggregateId, type, payload, status, attempts, nextAt? | F1 | |
| 34 | InboundEvent | source, eventId @unique, payload, processedAt? | F1 | webhook dedupe |
| 35 | IdempotencyKey | key @unique, userId, responseHash, status, expiresAt | F1 | |
| 36 | Event | userId?, orgId?, name, props Json, sessionId, at | F1 | KPI (PostHog o'rniga) |
| 37 | VfSyncLog | entity, vfId, ysId, payloadHash, syncedAt, error? | F1 | |
| 38 | ImportBatch / ImportRow | source, fileId, totals; rowNo, rowHash @unique, raw, targetId?, error? | F1 | idempotent seed |
| 39 | TyCodeApplication | orgId, stationId, monthlyVolumeT, checklist Json, status, notes | F1 | |
| 40 | Payment | orgId, invoiceId, provider, providerTxnId? @unique, amountTiyin, status, idempotencyKey, raw | F2 | bitta provayder |
| 41 | EscrowRef | orderId @unique, bankRef, status (HELD/RELEASED/REFUNDED), releaseSignalAt? | F2 | bank eskrou, platforma pul ushlamaydi |
| 42 | Asset / AssetListing | ownerOrgId, kind (WAGON/LOCOMOTIVE), specs, permitNo?, permitUntil?, scope; mode, priceTiyin, status, premiumUntil | F2 | Siding uchun alohida Asset yo'q — `Siding.listingMode` |
| 43 | AssetDeal | listingId, requesterOrgId, qty, periodFrom/To, priceTiyin, status | F2 | |
| 44 | ManeuverRequest | locoAssetId, sidingId, wagonCount, windowFrom/To, status, priceTiyin, vfManeuverOrderId? | F2 | |
| 45 | SidingServiceContract | sidingId, ownerOrgId, contragentOrgId, no, validFrom/To, feeTiyin?, fileId, signatureIds[] | F2 | letter.contractId FK |
| 46 | SvxWarehouse | orgId, stationId, licenseNo, licenseUntil, capacityM2, tariffs Json | F2 | |
| 47 | Ad | orgId, category, title, body, stationId?, priceNote, phoneEnc, status, premiumUntil | F2 | |
| 48 | Specialist / SpecialistOrder | userId, kind[], regions[], verified, rating; orderId, feeTiyin, status, respondBy | F2 | |
| 49 | Dispute | orderId, openedByOrgId, reason, status, slaDueAt, resolution, refundTiyin? | F2 | |
| 50 | Vehicle / AutoTrip / DriverLocation | plate, kind, capacityT; orderExtraId, driverUserId, status, gateSlotId?; vehicleId, at, lat, lng | F2 | mobil bilan |
| 51 | TerminalResource | terminalId, kind (CRANE/TRACK/GATE), capacityUnits; `TimeSlot.resourceId?` | F2 | |
| 52 | BnplApplication / Referral / Vacancy / Application / Port / Scale / RoadService | — | F3 | hamkor API / ma'lumotnoma |

O'chirilgan (backend/data linzalaridan): LedgerAccount, LedgerEntry, EscrowHold, Installment, InstallmentSchedule, RailTransfer, Payout, DspTask, Session, SlotTemplate (F2), Hold (SlotBooking ichida), materialized view ×6, partitsiya, replica, pg_cron.

### 7.2 ER diagramma (F1 yadro — soddalashtirilgan: 41 modeldan 31 tasi)

Ko'rsatilmagan F1 modellar (munosabati trivial yoki tenant/texnik): OtpCode, KycCheck, PlatformConfig, WagonType, TerminalService, AuditLog, InboundEvent, IdempotencyKey, Event, VfSyncLog, ImportBatch/ImportRow, TyCodeApplication. `Document.orderId` va `Document.letterId` ikkalasi ixtiyoriy (XOR — akt/faktura buyurtmaga, xat PDF `StationLetter` ga bog'lanadi; «stol uslug» hujjati ikkalasisiz ham bo'lishi mumkin) — diagrammada `|o--o{` bilan berilgan.

```mermaid
erDiagram
  Organization ||--o{ Membership : has
  User ||--o{ Membership : has
  Organization ||--o{ Terminal : operates
  Station ||--o{ Terminal : hosts
  Station ||--o{ Siding : has
  Organization o|--o{ Siding : claims
  Terminal ||--o{ Tariff : prices
  Terminal ||--o{ TimeSlot : opens
  TimeSlot ||--o{ SlotBooking : books
  Organization ||--o{ Order : places
  Terminal ||--o{ Order : receives
  Station ||--o{ Order : origin
  CargoType ||--o{ Order : classifies
  Order ||--o{ OrderItem : lines
  Tariff ||--o{ OrderItem : frozen
  Order ||--o{ OrderExtra : addons
  Order ||--o{ OrderStatusHistory : log
  Order ||--o{ SlotBooking : reserves
  Order ||--o{ WagonBatch : wagons
  WagonBatch ||--o{ WagonBatchWagon : contains
  Order |o--o{ Document : docs
  Order |o--o{ Invoice : bills
  Organization ||--o{ Invoice : billed
  Organization ||--o{ Document : owns
  Document ||--o{ Signature : signed
  User ||--o{ Signature : signs
  Document ||--o| File : file
  Organization ||--o{ StationLetter : writes
  Siding ||--o{ StationLetter : target
  Station ||--o{ StationLetter : addressed
  CargoType ||--o{ StationLetter : cargo
  StationLetter ||--o{ LetterWagon : lists
  StationLetter ||--o| SidingConsent : consent
  Organization ||--o{ SidingConsent : ownerOrg
  StationLetter ||--o| StationPermit : permit
  StationLetter |o--o| Document : pdf
  Order ||--o{ Review : rated
  Organization ||--o{ Review : writes
  User ||--o{ Notification : gets
  User ||--o{ DeviceToken : devices
  Order ||--o{ OutboxEvent : emits
  StationLetter ||--o{ OutboxEvent : emits
```

### 7.3 Enumlar (`packages/domain/enums.ts`, Prisma bilan bir xil)

```
OrgKind      SHIPPER LOGISTICS FORWARDER TERMINAL ASSET_OWNER PLATFORM        (F2: DECLARANT CARRIER)
OrgRole      OWNER MANAGER OPERATOR ACCOUNTANT VIEWER                          (F2: DRIVER)
KycStatus    NONE PENDING VERIFIED REJECTED        KycSource  MANUAL EIMZO ONEID
TerminalKind YARD CONTAINER LC SVX                 Operation  LOAD UNLOAD EMPTY_DISPATCH STORAGE
Direction    LOCAL IMPORT EXPORT                   Ownership  CARGO MPS SPS   (VagonFlow bilan bir xil)
OrderStatus  DRAFT PENDING CONFIRMED REJECTED EXPIRED IN_PROGRESS DONE CANCELLED DISPUTED
BookingStatus HOLD CONFIRMED RELEASED NO_SHOW      SlotStatus OPEN FULL CLOSED
LetterStatus DRAFT AWAITING_OWNER OWNER_CONSENTED OWNER_DECLINED SUBMITTED PERMITTED RETURNED IN_EFFECT EXPIRED REVOKED
ConsentDecision AGREE AGREE_WITH_CONDITIONS DECLINE   SignMethod SMS_OTP EIMZO   SignatureLevel OTP ERI PAPER
DocKind      STATION_LETTER ACT INVOICE GU27_NAKLADNOY SMGS RESHIP VU_ACT_SET CLIENT_REPORT
DocStatus    DRAFT ORDERED IN_WORK READY REVISION SIGNED CANCELLED
DelayReason  TERMINAL CLIENT RAILWAY               CommissionPayer CLIENT TERMINAL
InvoiceStatus ISSUED PAID OVERDUE CANCELLED        PaymentStatus (F2) CREATED PENDING PAID FAILED REFUNDED
OutboxStatus PENDING SENT FAILED PAUSED            NotifChannel TELEGRAM PUSH SMS INAPP
```

### 7.4 Muhim qarorlar

| # | Qaror | Nega | Alternativa (rad) |
|---|---|---|---|
| 1 | Pul `BigInt` tiyin, foiz `Int` (300 = 3,00 %) | 3,2 mlrd so'mlik teplovoz Int32 ga sig'maydi; float bank uchun yaroqsiz | Decimal — serializatsiya yuki |
| 2 | Hamma vaqt `Timestamptz`, `TimeSlot.localDate` alohida `date` | Server TZ o'zgarsa slot 5 soat siljimasin; «bugungi slotlar» indeksdan | local vaqt saqlash |
| 3 | Slot = terminal × kun × oyna (`window`), sig'im bitta raqam; oynalar terminal sozlaydi (default 6×2 soat, yoki 2 smena) | eModal modeli; resurs (kran/yo'l) F2 da `resourceId?` bilan qo'shiladi; temir yo'l uchun smena oynasi ham shu modelga sig'adi | resurs × oyna F1 (mijoz qaysi resursni band qilayotganini bilmaydi) |
| 4 | Tarif append-only + `EXCLUDE USING gist (terminal_id, service_code, tstzrange)`; `OrderItem.tariffId` muzlatiladi | Nizoda «qaysi tarif bilan» javobli; DB kafolatlaydi | TariffHistory + trigger |
| 5 | Tenant = `orgId`/`terminalId` ustuni + `forTenant()` extension; RLS yo'q | Pilot; RLS Prisma pool bilan har so'rovni tranzaksiyaga o'raydi | RLS |
| 6 | Append-only: AuditLog, OrderStatusHistory, Tariff (app-rol `REVOKE UPDATE, DELETE`) | «Kim, qachon, nima qildi» | pgaudit |
| 7 | PII: `phoneEnc` + `phoneHash`; STIR ochiq; pasport faqat S3 | Dump chiqsa o'qilmaydi; qidiruv kerak | pgcrypto (kalit DB da) |
| 8 | Saqlash muddati: AuditLog/Document/Invoice/Signature — **5 yil** (2024 dan buxgalteriya 5 yil); Notification 180 kun; OtpCode 10 daq; DriverLocation (F2) 90 kun | qonun + hajm | «hech narsani o'chirmaymiz» |
| 9 | Transactional Outbox (`OutboxEvent`, worker poll 1 s, `SKIP LOCKED`) | VF/Telegram yotsa buyurtma yo'qolmasin, ikki marta ketmasin | handler ichida `fetch()` |
| 10 | Hisobot — indeksli SQL (`analytics.sql`), MV/partitsiya/replica yo'q | 3 000 buyurtma/oy × 5 yil = 180 k qator | 6 MV + pg_cron + replica |
| 11 | `Siding` — VF master, YS tunda o'qiydi; `ownerNameRaw` egasi «claim» qilmaguncha ommaviy ko'rsatilmaydi | O'TY ichki reestri (179-telegramma) | bitta DB |
| 12 | `Order.kind` yo'q (faqat terminal); «stol uslug» = `Document(status)`; mutaxassis/rail-payment — F2 alohida | takror modellar | OrderKind 4 xil |

### 7.5 Import pipeline (`packages/db/seed/`, idempotent, `ImportBatch/ImportRow`, `rowHash`)

```
00-config.ts        PlatformConfig (commissionPct=0, commissionPayer=TERMINAL, slotHoldTtlMin=10, terminalConfirmMin=30, docSlaHours=4)
01-esr-stations.ts  ЕСР.xlsx V_STAN, DOR='73' → ~300 Station (KOD String, leading zero); nameUz ← VF Station join; lat/lng ← railmap API (214)
02-etsng.ts         yuklar.xlsx 407 qator → CargoType (6 raqam rasmiy .doc dan; nazorat raqami tekshiruvi yo'q — faqat mavjudlik)
03-wagon-types.ts   VF WagonType API → WagonType
04-sidings.ts       Шахобча йўллар.xlsx 1 393 → Siding (registryRef = esrCode:№, VF bilan bir formula); Лист1 94 qator ИНН → Organization.stir (ownerOrgId)  [CONSENT_REF env bo'lmasa o'tkazib yuboriladi]
05-clients.ts       «Yagona darcha» 18 428 → Organization (stir upsert, homeStationId; telefon ustuni umuman o'qilmaydi; User yaratilmaydi)  [CONSENT_REF majburiy]
06-vf-link.ts       VF Station/Siding/Client → vf*Id backfill (VfSyncLog)
07-terminals.ts     pilot 5–8 obyekt pasporti (anketa xlsx) → Terminal, TerminalService, Tariff v1, TimeSlot 30 kun (oynalar terminal sozlamasi bo'yicha)
```

Migratsiya: `prisma migrate` (VF `db push` emas), har migratsiya `-- rollback:` izohi; EXCLUDE/CHECK — qo'lda SQL. Seed 04/05 — O'TY yozma roziligi (`CONSENT_REF`) bo'lmasa skript o'zini o'tkazib yuboradi va CI da ogohlantiradi.

---

## 8. UI/UX

### 8.1 Dizayn tili — «Raqamli karvonsaroy»

Metafora: Ipak yo'li karvonsaroyi (ravoq, hovli, tartib) × zamonaviy terminal. Motivlar dekor emas, funksiya:

| Motiv | Qayerda | Qanday | Taqiq |
|---|---|---|---|
| Ravoq | Hero video maskasi (desktop o'ng 5/12), terminal kartasi rasmi | `border-radius: var(--radius-arch)` | 1 ekran = 1 ravoq |
| Girih (8 qirrali yulduz) | Seksiya foni, xat blankasi vodyanoy belgisi, 404 | SVG `<pattern>` 128 px, `--color-rail`, opacity .06/.08 | rangli/gradient girih |
| Gumbaz | Loader/progress ring, slot sig'imi indikatori | 180° arc | illyustratsiya sifatida |
| Karvon yo'li | Marshrut chizig'i (timeline, sxema) | `stroke-dasharray 2 6` + offset animatsiya | |
| Qum | Sahifa foni `#F6F1E7` | iliq neytral, Uzum/ATI sovuq oqidan ajratadi | |

Anti-generic 12 qoida (uxui linzasi): teal solid tugma (gradient yo'q); glassmorphism yo'q (navbar solid `rgb(13 28 47 / .92)`, blur faqat ≥1024 px + `prefers-reduced-transparency: no-preference`); feature-kartada real mikro-demo; ikonka doirasiz 20 px; stok illyustratsiya yo'q; raqamlar faqat o'zimizniki; fade-up faqat 3 seksiyada; radius 6/12/20; emoji sarlavha yo'q; har sarlavha fe'l + raqam; hero chapga tekis 7/5; hero 100 svh, CTA fold ustida (1366×768).

### 8.2 Landing strukturasi (6 seksiya, 10 emas)

| # | Seksiya | Sarlavha (oz manba, uz ko'rsatilgan) | Vizual | Animatsiya |
|---|---|---|---|---|
| 1 | **Hero + tez hisob** | «Yuk saroyini 3 daqiqada toping, band qiling, kuzating» · chap 7/12: `Stansiya (ESR autocomplete)` + `Yuk turi` + `Vazn` → «Narxni ko'rish» (`POST /api/quote`, login'siz, 3 terminal kartasi inline) · o'ng 5/12: ravoq ichida video | 3 ishonch belgisi: `N terminal (pasport bilan)` · `N shahobcha xaritada` · `30 daq — terminal javob SLA` (jonli, API dan) | Sarlavha so'zma-so'z 240 ms/stagger 40; video loop; pauza tugmasi 32 px (`aria-pressed`, localStorage) |
| 2 | Muammo → Yechim | «Hozir: 6 qo'ng'iroq, 2 kun. YukSaroy'da: 1 buyurtma, 3 daqiqa» | Split: chap xira qog'oz/telefon, o'ng ilova kartasi | IntersectionObserver + `@starting-style` |
| 3 | Qanday ishlaydi + tarmoq 3D | «Buyurtma → Slot → Yuklash» — 3 ustunli grid (gorizontal pin yo'q) + ostida `RailNetwork3D` (desktop) / WebP parallax (mobil) | Har karta jonli mini-UI (vizard, slot grid, timeline) | Kamera scroll progress bilan (10 qatorli listener, GSAP yo'q) |
| 4 | Rollar | 5 tab: logist, terminal, shahobcha egasi, ekspeditor, (F2) haydovchi | Ekran mockup ravoq maskada | Tab crossfade 160 ms |
| 5 | Ishonch + stansiya xati preview | «Stansiya xati — 3 daqiqada, QR bilan tekshiriladi» + chip: `Audit izi · QR · ERI (F2)` | A4 preview real | statik |
| 6 | CTA + footer | «Pilotga 0 % komissiya bilan qo'shiling» — telefon + SMS | Girih .06 | magnetic ≤ 8 px |

Raqamlar «18 428 mijoz» va «6 daromad oqimi» landing'da **yo'q** (O'TY reestri, investor xabari).

### 8.3 Video-banner

**Storyboard (8 s, 24 fps, seamless loop, matn videoda emas):**

| Vaqt | Kadr | Kamera | Rang |
|---|---|---|---|
| 0–2 s | Tong, tuman, relslar ustidan past uchish | Dron 3 m, oldinga 2 m/s | Soyalar navy→teal, yorug'lik amber |
| 2–4 s | Terminal: richstaker 40 ft konteynerni ko'taradi, orqada gantri kran | Crane-up 3→12 m | Quyosh gorizontda, flare yo'q |
| 4–6 s | Yarim vagonlar qatori yonidan o'tish, bitta vagon raqami fokusda | Lateral dolly 1,5 m/s | HTML overlay: JetBrains Mono «Vagon 62 t · Slot 10:00–12:00» |
| 6–7,5 s | Vagonlar yuqoridan, rels chiziqlari tarmoq sxemasiga aylanadi | Tilt-down 40 m | Teal ga siljiydi — 3D ga ko'prik |
| 7,5–8 s | Tumanga dissolve → 0 kadr | Statik | Tuman navy 80 % |

**Spetsifikatsiya (bitta ADR):**

| Parametr | Desktop | Mobil |
|---|---|---|
| O'lcham / fps / uzunlik | 1280×720 / 24 / 8 s (hero 5/12 ravoq ichida — 1080 kerak emas) | 720×1280 / 24 / 6 s (Higgsfield `reframe` yoki ffmpeg crop) |
| Formatlar | `h264 High ≤1,8 MB` (majburiy, hamma brauzer) + `av1 ≤1,2 MB` (ixtiyoriy, ffmpeg 1 qator) | h264 ≤0,9 MB |
| Poster | `<picture>`: AVIF ≤50 KB + WebP ≤80 KB, `media=(max-width:767px)` 720×1280; `fetchpriority=high` — **LCP shu**; video ostida absolute qatlam, yuklangach opacity crossfade | |
| Atributlar | `muted playsinline loop preload="none" disablepictureinpicture`, `src` JS orqali IntersectionObserver + rIC dan keyin | |
| Fallback | `prefers-reduced-motion` → poster + «Videoni yoqish»; `video.play().catch(() => poster)` (iOS Low Power, Firefox autoplay blok — tizim controls yo'q); ko'rinmasa `pause()`; `saveData ?? false` fail-closed emas — poster faqat aniq `true` bo'lganda | |
| A11y | Doimiy Pauza/Play tugma (WCAG 2.2.2), `aria-hidden` video, matn HTML da | |

ffmpeg: `ffmpeg -i hero.mov -an -vf "scale=1280:720,fps=24" -c:v libx264 -profile:v high -crf 23 -movflags +faststart hero-720.h264.mp4` (+ `-c:v libsvtav1 -crf 38` av1).

**Generatsiya:** F1 — AI (Higgsfield: Kling 3.0 multi-shot / Veo 3.1), avval `generate_image` bilan 3 key-art (O'TY vagonlari «generic» bo'lmasin), image-to-video; F2 — real dron (Sergeli/Toshkent-tovar, O'TY ruxsati).

3 prompt:
1. **Veo 3.1 (kadr 1–2):** `Cinematic aerial drone shot at dawn over a Central Asian railway freight terminal, low altitude gliding forward along steel rails with thin morning fog, then craning up to reveal a reach stacker lifting a 40-foot container beside a gantry crane; teal-blue shadows and warm amber sunrise highlights, dry steppe landscape, Soviet-era brick warehouse in background, photoreal, 24fps, smooth stabilized camera, no text, no logos, no people.`
2. **Kling 3.0 (multi-shot loop):** `Multi-shot sequence, 8 seconds, seamless loop: Shot 1 — foggy dawn, camera glides 3 m above railway tracks toward a freight yard. Shot 2 — crane-up past open-top gondola wagons loaded with grain, a reach stacker moving a container. Shot 3 — lateral dolly along a row of gondola wagons, one wagon number plate in sharp focus. Shot 4 — tilt down from 40 m, rail lines form a network pattern, dissolve into the same fog as shot 1. Color grade: deep navy shadows, teal midtones, amber highlights. Photoreal, no text, no logos, no people.`
3. **Higgsfield mobil 9:16 (Crane Up preset, 6 s):** `Vertical 9:16, Uzbekistan railway freight terminal at golden hour, gantry crane silhouette, gondola wagons in a row, reach stacker with container, subtle dust in the air, teal and amber color grade, slow crane-up camera, photoreal, no text.`

### 8.4 3D effektlar — `RailNetwork3D` (bitta sahna)

Ma'lumot: ESR + railmap → `scripts/build-railmap.ts` → `public/data/railmap.min.json` (`{stations:[{esr,name,x,y,terminal}], edges}`, d3-geo geoMercator, ≤80 KB gz).

```
<Canvas dpr={[1,1.5]} frameloop="demand" gl={{antialias:false, powerPreference:'high-performance'}}>
  <ScrollCamera path={curve5pts} progress={scrollProgress}/>  // Toshkent → Qo'qon → Buxoro-2 → Urganch → Nukus
  <CountryOutline/>   // GeoJSON → ExtrudeGeometry, navy, 1 draw call
  <RailLines/>        // drei Line2, barcha edges bitta geometriya, teal, 1 draw call
  <Stations/>         // InstancedMesh, 1 draw call
  <Terminals/>        // sprite + oddiy pulse (sin(uTime)), additive, 1 draw call
</Canvas>
```

Yo'q (F2 «polish»): EffectComposer/Bloom, CargoFlow 5 000 Points, custom shaderlar, vagon GLTF, Lenis, GSAP. Byudjet: ≤8 draw call, ≤40 k uchburchak, chunk ≤200 KB gz, 60 fps desktop. **Yuklash sharti (fail-closed):** `matchMedia('(min-width:1024px) and (pointer:fine)')` + `detect-gpu` `tier >= 2` + `!prefers-reduced-motion` + WebGL2; aks holda `<picture>` WebP 1600 px render + CSS `animation-timeline: scroll()` parallax. `deviceMemory`/`effectiveType` (Chromium-only) ishlatilmaydi. Hover → DOM karta (`<Html>` emas). `role="img" aria-label` + yashirin stansiya ro'yxati.

### 8.5 Scroll xoreografiyasi

Faqat 1 pin — hero (≤150 vh), faqat desktop `pointer:fine`; 0–40 % video opacity 1→0 + ravoq maskasi kengayadi (`clip-path`), 40–100 % kamera progress. Qolgan seksiyalar: `IntersectionObserver` + `@starting-style` / CSS `animation-timeline: scroll()` (Chrome 115+, Safari 26; bo'lmasa oddiy). Gorizontal scroll, snap, Lenis — yo'q. `prefers-reduced-motion` → hamma 0 ms, pin oddiy oqimga aylanadi. Custom cursor yo'q. Lighthouse «non-composited animations» 0, scroll TBT < 50 ms.

### 8.6 Ilova ekranlari (matnli wireframe)

**Shipper dashboard** (12 ustun, 24 px gap):
```
[ 8: Bugun — faol buyurtmalar (YS-1041 tasdiqlandi 10:00–12:00 · YS-1038 kutilmoqda ⏱ 18 daq) ] [ 4: TY kod holati + «Yangi buyurtma» CTA ]
[ 8: Kelayotgan vagonlar (VF Request / mijoz kiritgan) — vagon № · stansiya · «Tushirish slotini band qilish» ] [ 4: Yaqin terminallar sig'imi (3 mini-gumbaz arc) ]
[ 12: So'nggi hujjatlar — chip: Tayyor / Rozilik kutilmoqda / Ruxsat № ]
```

**Katalog** — 40/60: chapda kartalar (rasm ravoq 96×72, nom, `24/7` chip, `load %` bar, reyting, tarif `18 500 so'm/t`), chip-filtrlar (hudud, xizmat); o'ngda F1 `SidingMap`/stansiya ro'yxati (F2 MapLibre). Mobil: ro'yxat default, «Xaritada ko'rish» tugma.

**Buyurtma vizardi — 3 ekran** (stepper yuqorida, sticky xulosa o'ngda; har qadamda oldingi qadam chip sifatida):
1. Yuk: yo'nalish, operatsiya, ETSNG qidiruv (pg_trgm), vazn, vagon soni / № (tushirishda; VF Request bo'lsa avto).
2. Terminal + slot: 3 tavsiya (yaqin stansiya) → karta ichida slot grid (kun × oyna, katak = segmentli bar: teal bo'sh / amber 1 qoldi / faint to'la; rang + raqam), qo'shimchalar checkbox; hold countdown, 2 daq qolganda amber + «Uzaytirish».
3. Xulosa: `62 t × 18 500 = 1 147 000 + Tarozi 120 000 = 1 267 000 so'm` (komissiya qatori faqat `payer=CLIENT`), oferta havolasi, «Buyurtma berish» → 30 daq SLA taymeri.

**Terminal inbox** — deadline bo'yicha tartib, har qatorda countdown `18:42` + matn chip «18 daq qoldi», «Qabul» / «Rad (sabab majburiy)»; `SlaTimer` `aria-live=off`, alohida polite region: «Talabnoma YS-1038: 5 daqiqa qoldi». Slot boshqaruvi: kun × oyna sig'im, «+/−» tugma (2.5.7).

**Buyurtma timeline** — vertikal, 8 qadam, aktor chipi, vaqt, SLA halqasi; sub-hodisalar (ARRIVED/WEIGHED/LOADED) shu yerda; F2 demurraj taymeri + sabab chipi.

**Stansiya xati konstruktori** — desktop 2 panel (forma | jonli A4 preview: yuk egasi blankasi, sand-soft qog'oz, girih vodyanoy, DS nomiga murojaat, vagon jadvali mono, rozilik bloki, QR, footer «Tayyorlangan: YukSaroy»); mobil — 4 qadamli stepper, preview alohida tab (HTML, 100 % kenglik). Vagonlar: paste (8 raqamli chip, nazorat raqami shake), VF `providedWagons` checkbox, (F2) kamera OCR. Stepper: Egasiga yuborildi → Rozilik → Stansiyaga topshirildi → Ruxsat № → (F2) Vagon qo'yildi. Sinov: 10 vagonli xat telefonda ≤ 4 daq.

**Egasi roziligi** (bot/web) — bitta ekran: shahobcha, mijoz, yuk, davr, vagon soni; «Qarshi emasman» (SMS kod) / «Shart bilan» (matn) / «Rad».

### 8.7 Motion tizimi

`--dur-1..5` = 80/160/240/400/700 ms; ilovada `--dur-5` taqiq. Tugma `scale(.98)` 80 ms; slot katak chegara 160 ms + segment stagger 30 ms; SLA halqa oxirgi 5 daq amber, 1 daq bad + 2 puls (reduced-motion — faqat rang + matn); buyurtma yuborildi — View Transitions 400 ms; toast (sonner) 240 ms; vagon № chip 160 ms, xato shake 2×4 px; karta hover `translateY(-2px)` + `--shadow-2`; drawer 240 ms `--ease-emph`; summa `tabular-nums` bilan 240 ms sanaladi; preview maydoni 400 ms `--teal-soft` yonadi; skeleton faqat > 300 ms javobda.

### 8.8 A11y (WCAG 2.2 AA)

Kontrast 4.5:1 matn / 3:1 UI (teal-ink/amber-ink); fokus `outline 2px teal` + `scroll-padding-top 96px` (2.4.11); target ≥24 px, mobil 44, slot 48 (2.5.8); sudrash o'rniga «+/−» (2.5.7); STIR qayta so'ralmaydi (3.3.7); OTP paste ruxsat, CAPTCHA faqat 3-urinishdan (3.3.8); video pauza tugmasi (2.2.2); 3D `role=img` + ro'yxat; reduced-motion hamma 0; `<html lang="uz-Latn" | "uz-Cyrl" | "ru">`; ʻ (U+02BB) bir xil, qidiruv normalizatsiyasi backend'da; matn uzunligi +25 % — `padding`, wrap.

### 8.9 «Lol qolish» checklist (20)

1. Poster 1 s ichida, LCP < 2,0 s (3G < 3,5 s). 2. Video 3 s ichida silliq, loop tikish sezilmaydi. 3. 1366×768 da sarlavha + tez hisob + CTA fold ustida. 4. Tez hisob login'siz 3 terminal narxini beradi. 5. Video → 3D o'tish uzilishsiz (trace, long task 0). 6. 3D da o'z stansiyangizni topasiz, terminallar pulsatsiyada. 7. Mobil (Redmi Note 11, iPhone 12) — WebP parallax, 30 fps dan tushmaydi. 8. Reduced-motion da hamma o'qiladi. 9. Har seksiyada real ekran, stok yo'q. 10. Raqamlar faqat o'zimizniki, jonli. 11. Teal matn faqat teal-ink (lint o'tdi). 12. Unbounded ≤2 display, sarlavha ≤2 qator. 13. Ravoq 1 ekranda 1 ta, girih ≤.08. 14. Tab/PageDown bilan fokus yashirin emas. 15. Pauza tugmasi ishlaydi, holat saqlanadi. 16. JS ≤150 KB gz (3D lazy). 17. Ilovada animatsiya > 400 ms yo'q. 18. Vizard 3 ekran, 5 sinovchida median ≤ 3 daq. 19. Slot sig'imi rang + raqam bilan o'qiladi. 20. Xat preview A4 print → PDF blanka, QR, rozilik bloki bilan to'g'ri; kirill ↔ lotin layout diff < 2 %.

---

## 9. Brend va logo

### 9.1 Nom

**YukSaroy** qoladi (kirill **ЮкСарой**, URL `yuksaroy`). «Yuk» — turkiy o'zak (MDH/Turkiya uchun tayyor eksport qiymati), «Saroy» — karvonsaroy (Ipak yo'li logistika tuguni); «yuk saroyi» — грузовой двор ning rasmiy o'zbekcha atamasi — insayder darhol tushunadi. Xavflar: ingliz «yuck» → talaffuz qoidasi /yook-sa-ROY/ + deskriptor «Rail Terminal Marketplace»; rus «сарай» → «ЮкСарой» (о bilan), ravoq belgisi ma'no beradi; tavsifiy nom → kombinatsiyalangan belgi (grafik + so'z) sifatida IMA ro'yxati (F0). Alternativa faqat IMA salbiy bo'lsa — «Rabot».

**Domen (bugun):** `yuksaroy.uz` 03.09.2026 SUVAN NET orqali Farg'onadan ro'yxatdan o'tgan («Aktivatsiyani kutish») — egaligini tasdiqlash (registrator/ahost hisobi); siz emas bo'lsa — `yuksaroy.com` (bo'sh) + `yuk-saroy.uz`/`yuksaroy.co.uz` zaxira. Barcha hostname faqat `APP_HOST` env orqali. `@yuksaroy_bot`, `@yuksaroy` — bugun band qilinsin.

**Tagline:** asosiy — «Yukingiz uchun raqamli karvonsaroy» (Юкингиз учун рақамли карвонсарой / Цифровой караван-сарай для вашего груза / The digital caravanserai for your cargo); funksional (CTA ustida) — «Terminal top. Slot band qil. Yukla.»; ishonch — «Har vagon, har slot — ochiq va vaqtida».

### 9.2 Logo — 3 yo'nalish (UI tokenlariga qayta bo'yalgan)

Qoidalar: 512 viewBox, `path/rect/line/circle`, ≤10 element, 32 px da o'qiladi. Ranglar: navy `#0D1C2F`, qum `#F6F1E7`, teal `#0E9384`, teal-ink `#0B7568`, amber `#C77E1E`, amber-hi `#E0A24A`.

**A) «Ravoq» — karvonsaroy peshtoqi + rels (TAVSIYA).** Darvozadan kirasiz, yo'l ochiladi: ravoq = saroy, rels = yuk, uchidagi nuqta = manzil/slot. Fon kvadrati bilan tayyor app-ikona.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="YukSaroy">
  <rect x="48" y="48" width="416" height="416" rx="56" fill="#0D1C2F"/>
  <path d="M144 424 V264 C144 204 204 170 256 146 C308 170 368 204 368 264 V424 Z" fill="#F6F1E7"/>
  <line x1="166" y1="400" x2="346" y2="400" stroke="#0E9384" stroke-width="12" stroke-linecap="round"/>
  <line x1="184" y1="348" x2="328" y2="348" stroke="#0E9384" stroke-width="11" stroke-linecap="round"/>
  <line x1="202" y1="300" x2="310" y2="300" stroke="#0E9384" stroke-width="10" stroke-linecap="round"/>
  <line x1="218" y1="258" x2="294" y2="258" stroke="#0E9384" stroke-width="9" stroke-linecap="round"/>
  <line x1="176" y1="424" x2="240" y2="226" stroke="#C77E1E" stroke-width="16" stroke-linecap="round"/>
  <line x1="336" y1="424" x2="272" y2="226" stroke="#C77E1E" stroke-width="16" stroke-linecap="round"/>
  <circle cx="256" cy="204" r="14" fill="#E0A24A"/>
</svg>
```

**A-16 — favicon/16 px varianti** (shpal va relssiz; brend linzasida faqat matn bilan tasvirlangan, fayl yo'q edi):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0D1C2F"/>
  <path d="M128 448 V256 C128 176 200 132 256 104 C312 132 384 176 384 256 V448 Z" fill="#F6F1E7"/>
  <circle cx="256" cy="220" r="28" fill="#E0A24A"/>
</svg>
```

**A-32 — favicon/32 px varianti** (shpalsiz: ravoq + 2 rels + nuqta; 16 px da A-16 ga tushadi):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0D1C2F"/>
  <path d="M128 448 V256 C128 176 200 132 256 104 C312 132 384 176 384 256 V448 Z" fill="#F6F1E7"/>
  <line x1="168" y1="448" x2="240" y2="228" stroke="#C77E1E" stroke-width="22" stroke-linecap="round"/>
  <line x1="344" y1="448" x2="272" y2="228" stroke="#C77E1E" stroke-width="22" stroke-linecap="round"/>
  <circle cx="256" cy="204" r="22" fill="#E0A24A"/>
</svg>
```

**A-mono — 1 rang** (muhr, DOCX blanka, chop, `<svg class="text-navy">` ichida rang tashqaridan): fon yo'q, ravoq konturi + 2 rels `stroke="currentColor"`, nuqta `fill="currentColor"`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="YukSaroy">
  <path d="M112 448 V264 C112 184 192 140 256 108 C320 140 400 184 400 264 V448" stroke-width="28"/>
  <line x1="176" y1="448" x2="240" y2="236" stroke-width="22"/>
  <line x1="336" y1="448" x2="272" y2="236" stroke-width="22"/>
  <circle cx="256" cy="200" r="16" fill="currentColor" stroke="none"/>
</svg>
```

**B) «YS» monogram — Y (strelka/spreader) + konteyner + S (yuk oqimi).** Tech/marketpleys tomonga og'ish kerak bo'lsa (investor, xalqaro). 16 px da S yo'qoladi — favicon faqat Y + konteyner.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="YS">
  <path d="M104 72 L256 236 L408 72" fill="none" stroke="#0B7568" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="256" y1="236" x2="256" y2="300" stroke="#0B7568" stroke-width="44" stroke-linecap="round"/>
  <rect x="144" y="292" width="224" height="176" rx="28" fill="none" stroke="#0D1C2F" stroke-width="18"/>
  <rect x="144" y="292" width="34" height="34" rx="6" fill="#0D1C2F"/>
  <rect x="334" y="292" width="34" height="34" rx="6" fill="#0D1C2F"/>
  <rect x="144" y="434" width="34" height="34" rx="6" fill="#0D1C2F"/>
  <rect x="334" y="434" width="34" height="34" rx="6" fill="#0D1C2F"/>
  <path d="M310 344 C310 318 202 318 202 352 C202 386 310 374 310 408 C310 442 202 442 202 416" fill="none" stroke="#C77E1E" stroke-width="30" stroke-linecap="round"/>
</svg>
```

**C) «Gumbaz» — rad** (ikkala linzada ham: turizm/madaniyat brendlari bilan chalkashadi, temir yo'l belgisi yo'q). Figma da A/B ikkitasi A/B-testga chiqadi.

**Girih pattern** (`brand/girih-pattern.svg`, 128 px kafel, `--color-rail`, opacity .06 — to'liq fayl; har yulduz = tekis kvadrat + 45° kvadrat → 8 qirrali yulduz; markazda bitta, to'rt burchakda chorak-yulduzlar qo'shni kafel bilan birlashadi):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid slice">
  <defs>
    <pattern id="girih" width="128" height="128" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="#8DA0B3" stroke-width="1.5">
        <rect x="24" y="24" width="80" height="80"/>
        <rect x="24" y="24" width="80" height="80" transform="rotate(45 64 64)"/>
        <rect x="-40" y="-40" width="80" height="80"/>
        <rect x="-40" y="-40" width="80" height="80" transform="rotate(45 0 0)"/>
        <rect x="88" y="-40" width="80" height="80"/>
        <rect x="88" y="-40" width="80" height="80" transform="rotate(45 128 0)"/>
        <rect x="-40" y="88" width="80" height="80"/>
        <rect x="-40" y="88" width="80" height="80" transform="rotate(45 0 128)"/>
        <rect x="88" y="88" width="80" height="80"/>
        <rect x="88" y="88" width="80" height="80" transform="rotate(45 128 128)"/>
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#girih)" opacity=".06"/>
</svg>
```

CSS da: `background: url(/brand/girih-pattern.svg)`; xat blankasida (react-pdf) `opacity .08`, rang `--color-rail` o'rniga `--color-sand` qorong'i fonda.

**Wordmark/lockup:** `YukSaroy` Unbounded 700, tracking −0.02em; «Yuk» navy, «Saroy» teal-ink (qorong'i fonda qum / amber-hi). Gorizontal: belgi chapda, balandligi = cap-height × 1,6; himoya maydoni = belgi balandligining 1/4; minimal lockup 120 px, belgi 24 px. Deskriptor «Rail Terminal Marketplace» Manrope 500, tracking .08em.

### 9.3 Palitra va tipografika (5.4 tokenlari bilan bir xil — bitta manba)

| Token | Hex | Rol | Kontrast |
|---|---|---|---|
| navy | #0D1C2F | hero fon, nav, wordmark | qum matn 15+:1 |
| teal-ink | #0B7568 | **primary action**, link, success matn | oq matn 5,6:1 |
| teal | #0E9384 | chiziqlar, ikonka, ≥24 px, dark rejim tugma | oqda 3,8:1 (matnga emas) |
| amber | #C77E1E | accent (rels, urg'u), pending | matnga emas |
| amber-ink | #8F5A12 | amber matn (badge, narx) | 5+:1 |
| amber-hi | #E0A24A | navy fonda highlight, logo nuqtasi | 9+:1 navy da |
| qum (page) | #F6F1E7 | sahifa foni | |
| sand / sand-soft | #E9DCC3 / #F6F0E3 | landing seksiya / xat qog'ozi | |
| ink / muted / rail | #141821 / #5B6473 / #8DA0B3 | matn / ikkilamchi / sxema chiziqlari | |

Shriftlar: Unbounded 700 (display), Manrope variable (UI), JetBrains Mono 500 (raqamlar). ʻ (U+02BB) glif testi Figma da («Oʻzbekiston»); bo'lmasa sarlavhalarda ‘ (U+2018) qoidasi. Ikonografiya: lucide + 12 maxsus (yarim vagon, yopiq vagon, sisterna, konteyner, teplovoz, shahobcha strelkasi, kran, richstaker, tarozi, SVX, slot, ruxsat xati).

Foto/video uslubi: haqiqiy O'zbekiston terminallari, oltin/ko'k soat, teal-orange grade, stok yo'q. 3D — mat navy, mis metall, teal emissiv; mobil fallback WebP (PNG sekvensiya yo'q).

### 9.4 Asset ishlab chiqarish rejasi

| Qadam | Vosita | Natija | Muddat |
|---|---|---|---|
| 1 | Figma MCP `create_new_file` → `/figma-use` → `use_figma`: `01 Logo` (A/B, mono, 16/32/64 test), `02 Color` (Variables light/dark = tokens.css), `03 Type`, `04 Pattern`, `05 Icons`; `get_variable_defs` bilan tekshiruv | Vektor manba, Code Connect Button/Card/SlotCell | 1 kun |
| 2 | Canva MCP `list-brand-kits` → kit (palitra, shriftlar, logo A) → `create-brand-template-draft` (Telegram post 1280×720, OG 1200×630, Instagram) → `publish-brand-template` | Marketing shablonlari | 0,5 kun |
| 3 | Higgsfield `generate_image` (5 prompt quyida), `upscale_image`; `generate_video` (8.3 promptlar), `reframe` 9:16, `upscale_video`; `generate_3d` faqat konsept | Key-art, hero video, OG | 2 kun |
| 4 | Gamma `generate` — brandbook 12 sahifa + pitch deck | Brandbook PDF | 0,5 kun |

AI promptlar (rasm): (1) *Logo render:* «Minimal 3D render of a logo mark: pointed Islamic archway in deep navy #0D1C2F rounded square, two copper #C77E1E railway rails converging inside the arch toward a small saffron #E0A24A dot, teal #0E9384 sleepers; matte ceramic, soft studio light, isometric 3/4 view, sand #F6F1E7 background, no text.» (2) *Hero key-art:* «Cinematic wide shot, dusk: modern Uzbek railway freight terminal seen through a monumental caravanserai arch; container cranes, gondola wagons, subtle glowing 8-point-star grid on the ground marking booking slots; teal-orange grade, navy shadows, drone perspective, photoreal, 21:9, no text.» (3) *3D ikon to'plami:* «Set of 6 low-poly 3D icons on sand background, consistent isometric angle: gondola wagon, tank wagon, 40ft container, shunting locomotive TEM2, gantry crane, railway weighbridge; matte navy body, copper accents, teal emissive lines, no text.» (4) *OG/poster:* «Poster: bold wordmark space left, right side ogee-arch cutout revealing golden-hour container yard photo; navy background, faint teal girih bottom-right, copper accent line, premium editorial.» (5) *Telegram avatar:* «Flat icon 640×640 circle, navy background, cream pointed arch centered, small saffron dot at apex, no text, high contrast.»

Assetlar: iOS 1024, Android adaptive (fg ravoq+rels, bg navy+girih 8 %), favicon 32 (A-32, shpalsiz) / 16 (A-16), muhr/DOCX (A-mono), PWA maskable 512, bot avatar 640, OG 1200×630, hujjat blankasi — **yuk egasining rekvizitlari sarlavhada**, YukSaroy lockup faqat footer'da (12-bo'lim).

---

## 10. Mobil ilova

### 10.1 Qaror

**Expo SDK 55 + expo-router v7, `apps/mobile`, F2 (S9 dan, hafta 19; S8 — F1 pilot stabilizatsiyasi), alohida binary `uz.yuksaroy.app`** (VagonFlow `com.uzty.vagonflow` — xodimlar, YukSaroy — bozor). SDK 56 emas: Hermes V1 + reanimated xotira regressiyasi, SDK 57 stable bo'lgach `expo install --fix`. Flutter — ikkinchi til, VagonFlow 53 ekranlik Expo tajribasi va PLAY-STORE/iOS-RELEASE kitlari yo'qoladi. **F1 da mobil kanal = responsive web (PWA manifest) + Telegram bot.** Native majburiy bo'lgan yagona rol — haydovchi (background GPS) — F2.

**Nega F2:** 7 rol × 2 platforma = XL; Store 2–4 hafta; F1 gipotezalari (H2 terminal 30 daq, H3 mijoz onlayn buyurtma, H4 stansiya xat) web + bot bilan tekshiriladi. Alternativa — mobil 1-haftadan (mobile linzasi 12 hafta, 2 RN dev) — jamoa 5 FTE ga sig'maydi, backend API hali barqaror emas.

Mobil VagonFlow API ga to'g'ridan-to'g'ri urmaydi — faqat YukSaroy `/api/*` (bitta sessiya; F2 da refresh token + `Session` jadvali qo'shiladi).

### 10.2 Rol ekranlari (F2 MVP: logist, terminal, haydovchi to'liq; qolganlari «lite»)

| Rol (route group) | Tab | Ekranlar |
|---|---|---|
| `(logist)` | Bosh · Terminallar · Buyurtma · Kuzatuv · Profil | Bosh (faol buyurtmalar, «vagoningiz ertaga keladi»); katalog + pasport; vizard 3 ekran (web bilan bitta `packages/domain` FSM); slot grid (kun → vertikal ro'yxat); buyurtma timeline + SLA; hujjatlar PDF (GU-27/SMGS/akt) + QR; TY kod; **shahobcha xati 4 qadam** (vagonlar: VF `providedWagons` checkbox / paste / F2 OCR; preview alohida tab; imzo qadamlari asinxron — «Egasiga yuborildi») |
| `(terminal)` | Bugun · Talabnomalar · Slotlar · Darvoza · Ko'proq | Bugun (bandlik, SLA ogohlantirish); inbox qabul/rad 30 daq (push dan ochiladi); slot kalendar; darvoza QR skaner (F2 gate); tariflar; hisobot; sharhlar; e'lon |
| `(driver)` | Reyslar · Xarita · Darvoza · Profil | Reys kartasi (terminal, slot, ETA); «Reysni boshlash» → GPS; jonli lokatsiya + batareya rejimi; gate QR (TOTP-uslub 60 s); foto-dalil (watermark serverda); yo'l servislari (F3); KYC |
| `(owner)` — shahobcha/vagon egasi | Roziliklar · Shahobchalarim · E'lonlar · Daromad | Rozilik so'rovi (bir ekran, OTP), park/ijara e'loni, so'rovlar inbox |
| `(forwarder)`, `(declarant)`, `(loco)` | lite | inbox + detal + e'lon + profil (4 ekran) |
| `(common)` | — | OTP kirish, rol tanlash, bildirishnomalar, profil/KYC, sozlamalar (til, PIN, batareya-wizard), `verify/[token]` |

Jami F2 ≈ 45 ekran (60 emas).

### 10.3 Offline / GPS / push / QR / ERI

- **Offline:** TanStack Query `persistQueryClient` (MMKV) — katalog, buyurtmalar, slotlar 24 soat; yozish `expo-sqlite` + Drizzle `outbox(id, method, path, body, idempotencyKey, tries)`, `track_points`, `photos_pending`; NetInfo online → ketma-ket, server `Idempotency-Key` bilan takrorni yutadi; 409 → «Slot band». Slot hold offline'da taqiq. WatermelonDB yo'q.
- **GPS (haydovchi):** `TaskManager.defineTask('YS_TRACK')`, `startLocationUpdatesAsync` Balanced 30 s/100 m, foreground service; batareya: < 3 km/soat 5 daq → 300 s; terminalga 2 km → High 10 s; `POST /api/mobile/track/batch` (10 nuqta yoki 60 s). Ruxsat ketma-ketligi: prominent-disclosure → When-In-Use → Always; Play deklaratsiyasi + 30 s video. OEM (Xiaomi/Huawei/Oppo) batareya-wizard; server watchdog 10 daq nuqta yo'q → push. expo-location OEM da yiqilsa 2 hafta ichida → `react-native-background-geolocation` (pullik). Geofence `Terminal.gate {lat,lng,radiusM:300}` faqat ETA/ogohlantirish; haqiqat manbai — darvoza QR check-in.
- **Push:** VagonFlow `push.ts` porti; kanallar `orders` (MAX), `slots` (HIGH), `trip`, `marketing` (LOW); `DeviceToken(platform)`; `data.route` deep-link.
- **Deep link:** `yuksaroy://`, universal `https://{APP_HOST}/o/YS-1041`, `/t/{slug}`, `/l/{letterId}`, `/v/{token}`; `assetlinks.json` / AASA — domen tasdiqlangach.
- **QR:** `expo-camera` `CameraView` (`barcodeTypes:['qr']`); hujjat QR = qisqa imzolangan token `/v/{jti}` — server `Document.sha256`, imzolovchi, holat; gate QR — 60 s TOTP.
- **ERI:** ikki daraja — OTP (`expo-local-authentication`) slot/tasdiq/rozilik; E-IMZO (ID-karta ilovasi) — **deeplink oqimi** (SiteID, DocumentID, hash, CRC32 → PKCS7 qaytadi), QR emas; SiteID ro'yxati F0 da boshlanadi. PFX ilovada saqlanmaydi.

### 10.4 Telegram Mini App (TMA)

`apps/web/src/app/tma/*` — alohida Vite ilovasi yo'q; `POST /api/tma/auth` (initData HMAC tekshiruvi ~30 qator) → oddiy sessiya; origin-himoya (20.07.2026) sababli faqat `APP_HOST` dan xizmat qiladi; bot `web_app` tugmasi shu URL ni ochadi. Funksiyalar: holat/timeline, slot band qilish (OTP), terminal qabul/rad, egasi roziligi, e'lonlar; ERI/GPS/kamera — faqat native. Bot `@yuksaroy_bot` alohida (VF botidan ajratilgan), Telegraf naqshi bir xil.

### 10.5 Chiqarish

Play: `uz.yuksaroy.app`, EAS `production` AAB, Internal → Closed (stansiya/terminal xodimlari — Play Closed track, APK sideload emas: 2026-09-30 dan developer verification) → Production; background location deklaratsiyasi, Data safety. App Store: iOS-RELEASE.md, TestFlight pilot. EAS Update: `runtimeVersion: {policy:'fingerprint'}`, kanallar `preview/production`, foizli rollout, JS-OTA haftada, native oyda. CI: `eas build --profile preview` PR da, `eas update` main da. Jamoa F2: 1 RN dev (VagonFlow mobil muallifi) + web-jamoa backend.

---

## 11. AI qatlami

### 11.1 Qaror

**F1 da LLM yo'q — AI byudjeti $0.** Rasmiy stansiya xati — qonun bo'yicha standart matn, foydalanuvchining `.docx` shabloni bor: determinik shablon + 6 o'zgaruvchan maydon (siding, org, STIR, vagonlar, davr, shartnoma) — LLM faqat xato manbai, latency va **ma'lumot chet elga chiqishi** (Anthropic `inference_geo` faqat us/global; `Siding.ownerName/contractNo/junctionSwitch`, mijoz bazasi — O'TY ichki/tijorat siri; memorandumdagi «ma'lumotlar Respublikada» bandi). ETSNG tanlash — `pg_trgm` 407 qator ustida; tarjima — VagonFlow translit + operator; SMS — shablon `{name}`.

**Nega modul, mikroservis emas (F2 dan):** `apps/web/src/lib/ai/` — client singleton, `prompts/` (PROMPT_VERSION), `schemas/` (zod → `zodOutputFormat`), `pii.ts`, `usage.ts` (`AiCall` jadvali: feature, model, tokenlar, cache_read, costUsd, latency — prompt matni yozilmaydi). Vercel AI SDK/LangChain yo'q.

### 11.2 Use-case reestri

| # | Use-case | Ma'lumot | Yechim | Model | ≈ $/so'rov | Xavf / nazorat | Faza |
|---|---|---|---|---|---|---|---|
| 1 | Stansiya xati matni | Siding, org, vagonlar, davr | **Shablon (docx + react-pdf), 0 LLM** | — | 0 | — | F1 |
| 2 | ETSNG kodi tanlash («g'alla» → 011005) | ETSNG 407 | `pg_trgm` + sinonim lug'ati | — | 0 | top-3, foydalanuvchi tanlaydi | F1 |
| 3 | SMS/push personalizatsiya | segment | shablon `{name}, {station}` | — | 0 | — | F1 |
| 4 | Xat matnini «yaxshilash» (ixtiyoriy tugma) | faqat matn, reestr maydonlarisiz | Sonnet 5, structured output, `warnings[]` | Sonnet 5 | 0,01 | vagon to'plami/davr tengligi kodda; 8 xonali begona raqam → rad | F2 (ixtiyoriy) |
| 5 | OCR: GU-27/SMGS skan → maydonlar | foto/PDF | Sonnet 5 vision, `confidence` | Sonnet 5 / Haiku 4.5 | 0,012 / 0,006 | past confidence → foydalanuvchi tasdiqlaydi | F2 |
| 6 | OCR: tarozi cheki (vazn, vagon №) | foto | Haiku 4.5 vision | Haiku 4.5 | 0,004 | vagon № nazorat raqami | F2 |
| 7 | Terminal pasportini anketa skanidan to'ldirish | anketa | Sonnet 5 vision + schema | Sonnet 5 | 0,02 | egasi tasdiqlaydi | F2 (onboarding) |
| 8 | E'lon matni sifat (sarlavha/tavsif, yetishmagan maydon) | e'lon | Haiku 4.5 | Haiku 4.5 | 0,002 | faqat kiritilgan faktlar | F2 |
| 9 | Anti-frod klassifikator (soxta e'lon, reyting shishirish) | matn, graf | qoidalar SQL + Haiku | Haiku 4.5 | 0,001 | avto-blok yo'q, moderator navbati | F2 |
| 10 | Tarjima uz/oz/ru (terminal pasporti, e'lon) | matn | translit + Haiku Batch (ru) | Haiku 4.5 | 0,0015 | glossariy system'da | F2 |
| 11 | Mijoz-yordamchi RAG (ЮҚТ, SMGS, FAQ) | normativ PDF → pgvector | Sonnet 5 + `citations`, tool `search_docs`, `get_order_status` | Sonnet 5 | 0,016 | manba moddasi + «yuridik maslahat emas» | F2 |
| 12 | Narx bashorati («adolatli narx») | ≥ 6 oy, ≥ 2 000 bitim | LightGBM → `Prediction` jadvali; F1–F2 median/kvartil SQL | ML; izoh Haiku | 0 | MAPE < 15 % bo'lsa UI da | F3 |
| 13 | ETA / navbat bashorati | slot tarixi, VF hodisalar | regressiya (ML) | — | 0 | «taxminiy» belgisi | F3 |
| 14 | Porojnyak tavsiyasi | e'lonlar, GPS | SQL matching + scoring | Haiku (matn) | 0,001 | kuniga ≤ 3 push | F3 |
| 15 | Text-to-SQL boshqaruv | read-only rol | Opus 5, tool `run_sql` (SELECT, 5 s timeout) | Opus 5 | 0,016 | SQL ko'rsatiladi | F3 |
| 16 | Nizo xulosasi loyihasi | AuditLog, foto | Sonnet 5, tool `get_audit_log` | Sonnet 5 | 0,03 | arbitr imzolaydi | F3 |
| 17 | Ovozli buyurtma (o'zbek STT) | audio | Aisha AI STT / Whisper zaxira + Haiku ekstraksiya | Haiku 4.5 | 0,001 + STT | WER yuqori — tasdiq ekrani | F3 |
| 18 | Mijoz oylik hisobot narrativi | agregat SQL | Sonnet 5 (raqamlar tayyor beriladi) | Sonnet 5 | 0,02 | LLM hisoblamaydi | F3 |

Model qoidasi: klassifikatsiya/qisqa matn → Haiku 4.5; hujjat/vision → Sonnet 5 (`thinking: adaptive`, `effort: medium`); huquqiy RAG/text-to-SQL → Opus 5. Prompt caching: `system[0]` barqaror + `cache_control ephemeral`, o'zgaruvchan JSON `messages[0]`; `PROMPT_VERSION` o'zgarsa eval majburiy (golden set: 50 xat, 100 ETSNG juftlik, 30 nakladnoy sahifa; `hallucinated_numbers = 0`).

### 11.3 Ma'lumot lokalizatsiyasi (uch qatlam)

1. Yuridik shaxs ochiq ma'lumoti (nom, STIR, manzil) — API ga ketishi mumkin.
2. Jismoniy shaxs (direktor F.I.Sh., telefon, haydovchi) — `pii.ts` `{{PERSON_1}}`, `{{PHONE_1}}` almashtiradi.
3. **O'TY reestr maydonlari** (`Siding.ownerName`, `contractNo`, `junctionSwitch`, mijoz bazasi), pasport/guvohnoma skanlari — **API ga umuman ketmaydi** (ESLint qoidasi: `lib/ai` ichida `Siding`/`Organization` importi taqiq); KYC OCR F3 da on-prem (vLLM, Toshkent DC) yoki Tesseract `uzb_cyrl`.

### 11.4 Xat generatsiyasi — F2 «matnni yaxshilash» prompt + schema (F1 shablon determinik)

Kirish (`LetterInput`) — faqat matn qismi, reestr maydonlarisiz:
```ts
type LetterInput = { lang: "uz-Cyrl"|"uz-Latn"|"ru"; stationName: string; applicantName: string;
  sidingName: string; cargoName: string; operation: "yuklash"|"tushirish"; wagonCount: number;
  period: { from: string; to: string }; draftBody?: string[] };   // vagon raqamlari, STIR, shartnoma № — LLM ga berilmaydi, shablon qo'yadi
```
System (keshlanadi): «Sen O'zbekiston temir yo'l yuk tashish sohasida rasmiy xatlar tuzuvchi mutaxassissan. Faqat berilgan JSON dagi faktlardan foydalan; raqam, sana, ism qo'shma/o'zgartirma. Uslub: rasmiy-ish, "Hurmatli ... stansiyasi boshlig'i!", 2–4 abzats, yakunda: "...davrida kelgan vagonlarni ... shahobcha yo'liga qo'yib berishingizni so'rayman." Nomuvofiqlikni matnga emas, `warnings` ga yoz. Til: `lang`. Chiqish — faqat schema.»
```ts
export const LetterText = z.object({ subject: z.string().max(160), salutation: z.string(),
  body: z.array(z.string()).min(2).max(4), requestSentence: z.string(), closing: z.string(), warnings: z.array(z.string()) });
```
Kodli tekshiruv: chiqishda 8 xonali raqam yo'q (`/\b\d{8}\b/` → rad), `period` matnda kirishdagi bilan teng, uzunlik ≤ 1 200 belgi; `parsed_output === null` → 1 retry → qo'lda tahrir. Vagon jadvali, STIR, shartnoma №, QR — shablon qo'yadi, LLM ko'rmaydi.

### 11.5 Ma'lumot platformasi

F1: `Event` jadvali (10 nom: `catalog_view, catalog_filter, quote_hero, order_step, order_submit, slot_pick, terminal_decide, letter_generate, letter_send, consent_decide`) + admin 3 recharts ekrani (voronka, SLA, terminal yuklamasi) — SQL `analytics.sql`. F2: PostHog hobby (session replay «UI lol qoldirdimi») — hajm 100 k event/oy dan oshsa. F3: ClickHouse + PeerDB (> 50 mln qator). ML pipeline (`ml/train_price.py`, LightGBM, tunda, `Prediction` jadvali) — ≥ 2 000 bitim va ≥ 6 oy dan keyin.

---

## 12. Domen va huquq

### 12.1 Jarayonlar va hujjatlar (tuzatilgan)

| Forma | Nomi | Kim to'ldiradi | YukSaroy da |
|---|---|---|---|
| **GU-27** | Транспортная ж/д накладная — **yuk xati** | jo'natuvchi | «Stol uslug» tayyorlash xizmati (`DocKind.GU27_NAKLADNOY`) |
| GU-29 | Дорожная ведомость — yo'l vedomosti | stansiya | faqat ko'rish (e-nakl); **katalogda yo'q** |
| GU-12 | Vagon talabnomasi | jo'natuvchi ↔ MTU/Kargo/Boshqarma | **VagonFlow `Request`** — YS yaratmaydi, uzatadi |
| GU-45 | Приёмосдатчик pamyatkasi (qo'yish/olish) | stansiya + shahobcha egasi | `placedAt/removedAt` — demurraj manbai |
| GU-46 | Qo'yish-olish vedomosti | stansiya | shahobcha hisob-kitobi (F3) |
| SMGS | Xalqaro yuk xati (ETSNG + GNG) | jo'natuvchi | «Stol uslug» |
| ETTYuX / ESF | e-yuk xati (soliq), e-faktura | jo'natuvchi | Didox API (F2) |
| VU/GU-45 asosidagi dalolatnomalar | akt to'plami | terminal/stansiya | «Stol uslug» |

**SLA jadvali (Ish standarti v1.0 dan tuzatilgan; barcha normalar `PlatformConfig` da, kodda raqam yo'q):**

| Jarayon | Mas'ul | Norma | Buzilsa | `PlatformConfig` kaliti |
|---|---|---|---|---|
| Talabnomani tasdiqlash / rad etish | Terminal | 30 daq (`slaConfirmUntil`) | `EXPIRED`, slot `RELEASED`, reyting −0,05, mijozga 2 alternativa; H2 min 80 % bo'lmasa 60 daq + auto-accept | `terminalConfirmMin=30`, `ratingPenalty=5` |
| Slot hold (vizard 2-ekran) | Tizim / mijoz | 10 daq, 1 marta +3 daq | `HOLD → RELEASED` (cron 1 daq), mijozga toast | `slotHoldTtlMin=10`, `holdExtendMin=3` |
| Shahobcha egasining roziligi | Shahobcha egasi | 48 soat | `OWNER_DECLINED(timeout)`, mijozga xabar, xat DRAFT ga qaytariladi | `ownerConsentH=48` |
| Xat → DS ruxsati | DS (VF ekrani) / operator 8a | **SLA va'da yo'q** («O'TY tartibida»); KPI median ≤ 1 ish kuni (2.4) | faqat o'lchanadi, jarima yo'q | — |
| Xat davri tugashi | Tizim | `periodTo` + 1 kun | `EXPIRED`; davr tashqarisida kelgan vagon → ogohlantirish | `letterExpireDays=1` |
| «Stol uslug» hujjati (GU-27, SMGS, qayta jo'natish, VU to'plami) | Platforma mutaxassisi | 4 ish soati (`slaDueAt`) | admin SLA monitor qizil; 1 bepul REVISION; H8 | `docSlaHours=4` |
| KYC (operator, F1) | Platforma operatori | 1 ish kuni | KYC navbati qizil, admin alert | `kycSlaDays=1` |
| TY kod olish | O'TY / mijoz | **SLA yo'q** — «3 ish kuni» olib tashlandi | — | — |
| Demurraj (F2) | Terminal / mijoz / O'TY | `unloadNorm` (GU-45 `placedAt` dan `readyNoticeAt` gacha) | `delayReason` majburiy: `TERMINAL` — terminal hisobidan (Ish standarti), `CLIENT` — mijoz, `RAILWAY` — reytingga ta'sir qilmaydi | `Siding.unloadNorm` / `Terminal.passport.unloadNorm`, F2 |
| Bildirishnoma yetkazish | Tizim (outbox) | 30 s (99 %) — SLO 13.4 | `outbox_lag > 60 s` alert; 5 xato → `paused` | — (worker) |

Kodlar: ETSNG 6 raqam (ilk 2 — guruh; tarif sinfi); ESR 6 raqam (O'TY 72xxxx, `String`, leading zero); vagon № 8 raqam, 8-si mod-10 nazorat (`packages/domain/wagonCheckDigit.ts` — majburiy); STIR 9 raqam — **nazorat raqami algoritmi ochiq emas** (lex.uz 499477 kuchini yo'qotgan) → faqat 9 raqam + reestr mavjudligi / E-IMZO sertifikat TIN.

Onboarding (TY kod, ELS, MTU shartnomasi): e-nakl oferta huquqlarni uchinchi shaxsga o'tkazishni taqiqlaydi → platforma operatori mijoz nomidan **kirmaydi**; YS = cheklist + shablon + deep-link + holat; DAS UTY bilan axborot almashinuv shartnomasi (ETTYuX pretsedenti) — F2 muzokara.

Slot va temir yo'l reallikligi: vagon berish O'TY (VF `Request` 3 bosqichli tasdiq) va DSP manevriga bog'liq → terminal oynasi = terminal sozlagan davr (2 soat yoki smena); slot «o'tkazib yuborish» sababi RAILWAY bo'lsa terminal reytingiga ta'sir qilmaydi (H7 o'lchanadi).

Demurraj: ikki to'lov — O'TY vagonlari uchun «плата за пользование» (soatlab, GU-45 dan), umumiy yo'lda turish; SPS — egasi shartnomasi. YS taymeri (F2) `placedAt` (GU-45) dan `readyNoticeAt` gacha minus `unloadNorm`; `delayReason TERMINAL|CLIENT|RAILWAY` majburiy; Ish standarti «terminal hisobidan» faqat `TERMINAL`.

Shahobcha shartnomalari (3 xil): ekspluatatsiya (O'TY ↔ egasi), qo'yish-olish (O'TY ↔ egasi/kontragent), **kontragent shartnomasi (egasi ↔ boshqa yuk egasi — bizning holat)**; ZRU-1006 (29.05.2025 dan) noumumiy yo'l egasiga pullik xizmat huquqi → «ijara» emas, **«shahobcha xizmati shartnomasi»**. Xatdan oldin shartnoma № bo'lishi kerak — `StationLetter.contractNo` + fayl (F1), `SidingServiceContract` (F2).

Stansiya xati zanjiri: yuk egasi → DS (rekvizitlar, STIR, TY kod, ETSNG, vagonlar/soni, shahobcha, davr, so'rov gapi) → egasi vizasi + shartnoma № → DS rezolyutsiya (yo'qsa MTU/DNCH) → DSP GU-45 + manevr, DNC «okno» → DU-58/DU-2/GU-45/GU-46 jurnallar. ZRU-793: faqat ERI yuridik kuch → F1 gibrid (chop + muhr), F2 ERI ikkalasida. **Xat yuk egasining blankasida**, YukSaroy — vositachi emas, faqat tayyorlovchi (footer).

Xususiy teplovoz: shahobcha ichida — `locoType=PRIVATE`, mashinist guvohnomasi, ТО/ТР; umumiy yo'lga chiqish — ZRU-701 ruxsatnoma + PTE + «akt dopuska»; tortish narxi davlat tartibga soladi → e'lon faqat noumumiy yo'lda (`scope=PRIVATE_SIDING_ONLY`, `permitNo/permitUntil` majburiy). SVX — PKM-1028 litsenziya, `licenseNo/licenseUntil`, customs.uz reyestri bilan qo'lda. Tarozi — Uzstandart poverka (`certUntil`), GU-36.

Tarif: 01.07.2026 dan shartnomaviy narxlar, shahobchaga qo'yish-olish +5 %, O'TY manevr 510 823 so'm; yangi metodika tayyorlanmoqda → **kalkulyator formulasi konfiguratsiyada** (`Tariff` versiyalar, `PlatformConfig`), temir yo'l tarifi «taxminiy, O'TY hisobiga ko'ra».

### 12.2 O'TY tizimlari va integratsiya darajalari

| Tizim | Ochiqlik | YS yondashuvi |
|---|---|---|
| e-nakl «Yagona darcha» (DAS UTY) | oferta: huquq o'tkazish taqiq, ochiq API yo'q, ETTYuX bilan B2G integratsiya bor | L0 (mijoz o'zi) F1; L2 axborot almashinuv shartnomasi F2 muzokara |
| ASOUP (dislokatsiya) | yopiq | `WagonLocationProvider` interfeys, `ManualLocationProvider` (VF/mijoz); ASOUP — W |
| EBRD dasturi (€38,4 mln, 2027+) | API rejasi e'lon qilinmagan | kuzatiladi (H15) |
| VagonFlow (O'TY ichki vositasi) | bizniki | **L3 — asosiy temir yo'l adapteri** (Station, Siding, Request, WagonMemo, stansiya inboxi) |
| railway.uz ochiq jadvallar (ESR, operatsiya kodlari 1–12, K) | ochiq | terminal imkoniyatlari filtri |
| L1 — mijoz login/paroli bilan robot-kirish | **taqiq** | kod-review qoidasi |

### 12.3 Litsenziya va muvofiqlik

| Soha | Norma | YS qarori |
|---|---|---|
| Marketpleys operatori | «Elektron tijorat to'g'risida» (17.04.2025, Senat 18.05.2026): rezident yuridik shaxs, **uvedomlenie 01.07.2025 dan**, sotuvchi tekshiruvi, subsidiar javobgarlik, soliq agenti | **Legal-0 epik (S0)**: yuridik shaxs, uvedomlenie (my.gov.uz), 3 oferta (mijoz / xizmat ko'rsatuvchi / arbitraj), M2 DoD ga kiradi; terminal xizmati «o'z nomidan» sotilmaydi — vositachi |
| Shaxsiy ma'lumotlar | ZRU-547; ZRU-1125 (26.03.2026) lokalizatsiya faqat biometrik/genetik/telekom; pd.gov.uz reestri | 3 baza ro'yxati F0 (foydalanuvchilar; haydovchilar GPS F2; mutaxassislar F2); hosting O'zbekiston (memorandum bandi); rozilik alohida checkbox; `DELETE /me` |
| Reklama SMS/qo'ng'iroq | 01.11.2026 dan faqat oldindan rozilik + PD reestri | **SMS aktivatsiya to'lqinlari yo'q**; faqat opt-in (ro'yxatdan o'tganlar); OTP 95 so'm, reklama 175 so'm |
| ERI | ZRU-793: faqat ERI yuridik kuch; oferta aksepti SMS-OTP mumkin (FK 370) | F1: oferta OTP, rozilik OTP (ichki), xat gibrid qog'oz; F2: E-IMZO (shartnoma F0 da, egasi CTO, 4–6 hafta) |
| To'lov | ZRU-578: to'lov xizmati — MB litsenziyasi; agent — bank shartnomasi bilan | Platforma pul ushlamaydi; F1 bank o'tkazma; F2 bitta provayder (kichik to'lovlar) + bank eskrou hisobi (`EscrowRef`); ELS agentligi F3 bank bilan |
| Rassrochka | PP-294 (iste'molchi, 250 BHM) — B2B ga tegishli emas; B2B foizli qarz = ZRU-765 (nobank kredit tashkiloti) | O'z mablag'idan rassrochka **yo'q**; F3 — bank/MFO hamkor (faktoring/BNPL), YS agent, `BnplApplication` |
| EDO/ESF | my.soliq.uz ESF majburiy; Didox/Faktura | Didox API F2; F1 PDF akt + Invoice |
| Soliq | QQS 12 % komissiyaga; tranzit summalar — yo'q; marketpleys stavkalari 2026 | 2-yildan QQS rejimi; buxgalter bilan |
| Kiberxavfsizlik | O'RQ-764, 3573-Nizom: MAI (transport) ekspertiza | O'TY API ulanishidan oldin (F3) ekspertiza xulosasi |
| Hujjat saqlash | 10.02.2024 dan buxgalteriya hujjatlari **5 yil** | AuditLog/Document/Invoice/Signature 5 yil |
| Ma'lumot manbalari | «Yagona darcha» 18 428 — O'TY/DAS UTY egasi; «Шахобча йўллар.xlsx» — ichki hujjat (179-telegramma) | **F0 memorandum bandi**: reestr importi, shahobcha reestri, VF bot orqali opt-in xabar; `CONSENT_REF` bo'lmasa seed o'tkazib yuboriladi; egasi claim qilmaguncha nomi yashirin; landing'da reestr raqami yo'q |
| O'TY bilan shakl | Memorandum (F0) → axborot almashinuv shartnomasi (F2) → agentlik (F3) | YS O'TY ga **sotilmaydi** — mustaqil operator, axborot hamkori (davlat xaridi = tender, mahsulot O'TY mulki) |

### 12.4 Taklif tomoni reallikligi (reality skeptigi, critical)

Pilot «terminallari» (Toshkent-tovar, Chuqursoy, Sergeli, To'ytepa) — O'TY yuk saroylari va O'ztemiryo'lkonteyner (O'TY sho'ba AJ) — «boshlig'i» xususiy marketpleysga tarif/slot ochish va «6 oy 0 %» qabul qilish huquqiga ega emas; bu O'TY Boshqaruvi darajasidagi qaror. **F0 qayta yozildi:** (1) O'TY Yuk tashish departamenti bilan memorandum — pilot yuk saroylari ro'yxati bilan; (2) taklif tomonining mustaqil qismi — xususiy LC/SVX (Angren LC, quruq portlar), xususiy shahobcha egalari (1 393 reestr, claim orqali), xususiy teplovoz — bular bilan haqiqiy shartnoma; (3) GTM skript ikkiga: O'TY departamenti (institutsional) va xususiy LC egasi (4 daqiqalik). H1 gipotezasi: «5 obyektdan ≥ 3 tarif beradi» — ikkala segment bo'yicha alohida.

### 12.5 Xavf reestri (domen)

| # | Xavf | Ehtimol | Yumshatish | Egasi |
|---|---|---|---|---|
| 1 | O'TY yuk saroylari pilotga kirmaydi (korporativ qaror) | Yuqori | Memorandum departament darajasida; xususiy LC/SVX segmenti parallel | CEO |
| 2 | DS elektron/QR xatni qabul qilmaydi | Yuqori | Gibrid qog'oz F1; DS intervyu F0; E-IMZO F2 | Ops |
| 3 | DAS UTY API bermaydi | Yuqori | L0 + L3 (VF) bilan boshlash | CEO |
| 4 | Reestr/shahobcha ma'lumotini ruxsatsiz ishlatish | Yuqori | Yozma rozilik; opt-in; `CONSENT_REF` | CEO |
| 5 | Terminologik xato (GU-29) | Yuqori | `docs/glossary.md` yagona manba; PR chek-listida «domen glossariy» | Product |
| 6 | Tarif metodikasi o'zgaradi | Yuqori | Formula konfiguratsiyada, versiyalangan | Product |
| 7 | Vagon №/ESR validatsiyasiz xato hujjat | Yuqori | Validatorlar, ESR spravochnigi | CTO |
| 8 | Rassrochka = ro'yxatsiz operator / kredit faoliyati | Yuqori | O'z mablag'idan yo'q; bank hamkor | CFO |
| 9 | Platforma hisobida tranzit pul | O'rta | Bank o'tkazma; split/eskrou bankda | CFO |
| 10 | Profil egallash (STIR ochiq) | O'rta | Operator KYC F1, E-IMZO F2; unverified = read-only | CTO |
| 11 | Xususiy teplovoz ruxsatsiz umumiy yo'lga | O'rta | `permitNo` verifikatsiya, «faqat noumumiy yo'l» | Compliance |
| 12 | Demurraj taymeri GU-45 bilan mos emas | O'rta | `placedAt`, `delayReason` | Product |
| 13 | Subsidiar javobgarlik | O'rta | Oferta chegaralari, KYC, sug'urta hamkori | Legal |
| 14 | E-tijorat uvedomleniesiz start | O'rta | Legal-0 epik S0 | Legal |
| 15 | Shahobcha «ijarasi» yer huquqini buzadi | O'rta | «Xizmat shartnomasi» shakli | Legal |
| 16 | O'TY reformasi — kontragent o'zgaradi | O'rta | «Huquqiy voris» bandi | Legal |

### 12.6 Glossariy (`docs/glossary.md` — yagona manba; 25 qator, 43 atama — bir qatorda bir nechta qarindosh atama)

| uz-Latn | uz-Cyrl | ru | en |
|---|---|---|---|
| Yuk saroyi | Юк саройи | Грузовой двор | Freight yard |
| Shahobcha yo'l | Шахобча йўл | Подъездной путь необщего пользования | Private siding |
| Umumiy foydalanish yo'li | Умумий фойдаланиш йўли | Путь общего пользования | Public track |
| Vagon qo'yish-olish | Вагон қўйиш-олиш | Подача-уборка вагонов | Placement/removal |
| Manevr ishi | Маневр иши | Маневровая работа | Shunting |
| Talabnoma (GU-12) | Талабнома | Заявка ГУ-12 | Wagon request |
| **Yuk xati (GU-27)** | Юк хати | Накладная ГУ-27 | Consignment note |
| Yo'l vedomosti (GU-29) | Йўл ведомости | Дорожная ведомость | Road sheet |
| Priyomosdatchik pamyatkasi (GU-45) | Приёмосдатчик памяткаси | Памятка приёмосдатчика | Placement memo |
| Qo'yish-olish vedomosti (GU-46) | Қўйиш-олиш ведомости | Ведомость подачи-уборки | Placement sheet |
| SMGS yuk xati | СМГС юк хати | Накладная СМГС | SMGS note |
| ETTYuX / ESF | ЭТТЮХ / ЭҲФ | ЭТТН / ЭСФ | e-Waybill / e-Invoice |
| ETSNG / GNG kodi | ЕТСНГ / ГНГ коди | Код ЕТСНГ / ГНГ | Cargo codes |
| ESR kodi | ЕСР коди | Код ЕСР | Station code |
| TY kod | ТЙ код | Код грузоотправителя | Shipper code |
| ELS / TexPD | ЕЛС / ТехПД | Единый лицевой счёт / ТехПД | Account / Doc center |
| MTU / DS / DSP / DNC / DNCH | МТУ / ДС / ДСП / ДНЦ / ДНЧ | Узел / Начальник станции / Дежурный / Диспетчер / Ревизор | Node / Station master / Duty officer / Dispatcher / Inspector |
| Vagon egasi (SPS) / Inventar (MPS) | СПС / МПС | Собственник / Инвентарный парк | Private / Railway fleet |
| Demurraj | Демурраж | Плата за пользование / простой | Demurrage |
| Taym-slot | Тайм-слот | Временное окно | Time slot |
| ЕТП / TRA / PTE | ЕТП / ТРА / ПТЭ | Единый техпроцесс / ТРА / ПТЭ | Process / Station act / Rules |
| Tormoz bashmog'i / Tutashuv strelkasi / Yuklash fronti | Тормоз башмоғи / Туташув стрелкаси / Юклаш фронти | Башмак / Стрелка примыкания / Фронт погрузки | Brake shoe / Junction switch / Loading front |
| SVX / Bojxona ombori | СВХ / Божхона омбори | Склад временного хранения / Таможенный склад | Temporary storage / Bonded |
| Vagon tarozisi / Poverka | Вагон тарозиси / Поверка | Вагонные весы / Поверка | Weighbridge / Calibration |
| ERI / Eskrou / Ekspeditor / Deklarant / Dislokatsiya | ЭРИ / Эскроу / Экспедитор / Декларант / Дислокация | ЭЦП / Эскроу / Экспедитор / Декларант / Дислокация | Signature / Escrow / Forwarder / Declarant / Location |

---

## 13. DevOps / xavfsizlik / infra

### 13.1 Hosting — UzCloud (Uzinfocom), barcha muhitlar O'zbekistonda

**Qaror.** UzCloud: bitta shartnomada VPS + S3 (3× replikatsiya, AWS API) + DBaaS (F2) + SLA 99,95 % + 5 Tier III DC. **Nega.** O'RQ-1125 adekvatlik ro'yxati hali yo'q; O'TY memorandumida «ma'lumotlar Respublikada»; TAS-IX 2–5 ms (stansiyalarda internet zaif); O'TY API ulanishida (F3) 3573-Nizom ekspertizasi. **Alternativa.** Hetzner/AWS eu-central 2–3× arzon — O'TY muzokarasidagi yo'qotish undan katta; Eskiz VPS 30–40 % arzon — SLA yo'q → faqat dev. Cloudflare **ishlatilmaydi** (TLS chet elda tugaydi).

| Muhit | Konfiguratsiya | Narx/oy | Deploy |
|---|---|---|---|
| dev | laptop, `compose.dev.yml` (db, minio, mailpit), seed | — | — |
| stage (`stage.{APP_HOST}`) | UzCloud 4 vCPU/8 GB/40 GB | 516 k | `main` merge → avtomatik |
| prod (`app.{APP_HOST}`) | 8 vCPU/16 GB/80 GB NVMe + 100 GB data-disk | 1 136 k + 200 k | `v*` teg + 1 approval |
| mon | 2 vCPU/4 GB (Uptime Kuma, Grafana/Prometheus) | 258 k | Ansible |
| S3 + backup + 2 IPv4 | | ~250 k | |
| **Jami F1** | | **≈ 2,4 mln so'm (~$200)** | |
| F2 (DBaaS + 2-VM) | | ≈ 4 mln | Managed K8s faqat 13.2 mezoni ishlasa |

### 13.2 Compose → K8s mezoni

Compose da qolamiz, toki quyidagilardan **≥ 2** bajarilmaguncha: DAU > 2 000 yoki p95 > 500 ms (16 vCPU da ham); deploy > 10/hafta; fon ishchilari > 3 alohida masshtab; O'TY shartnomasi HA talab qildi. O'tish — UzCloud Managed K8s (k3s bosqichisiz).

**Prod compose (5 + 1):** `db` (postgres:17, WAL arxiv S3), `web` (Next standalone), `worker`, `bot`, `nginx`, `backup` (pgBackRest). Yo'q: valkey, minio, libreoffice, eimzo-server (F2 `e-imzo-server` ichki tarmoqda, `ports` yo'q), otel-collector.

IaC: Ansible 3 playbook (`base.yml` ufw/fail2ban/docker/node_exporter, `app.yml` compose+nginx+certbot, `monitoring.yml`); Terraform faqat UzCloud API tasdiqlansa (F2). Sirlar: SOPS + age (`infra/secrets/*.enc.yaml`), 2 kalit (jamoa, CI), `deploy.sh` da `sops -d` → `.env` (`chmod 600`); rotatsiya 90 kun; Vault yo'q.

### 13.3 CI/CD (GitHub Actions; github MCP 401 — `gh` CLI bilan sozlanadi)

Ishlaydigan skelet (haqiqiy GitHub Actions sintaksisi; `secrets.*`/`vars.*` nomlari va `production` muhitining «required reviewer: tech lead» sozlamasi repo Settings → Environments da S0 da kiritiladi):

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*']
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
  packages: write
jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: ci, POSTGRES_DB: ys_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:ci@localhost:5432/ys_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck
      - run: pnpm --filter @yuksaroy/db exec prisma migrate deploy
      - run: pnpm turbo test -- --coverage          # vitest, packages/domain 100 %, umumiy ≥ 70 %
      - run: pnpm audit --audit-level=high
      - run: pnpm turbo build                        # + budgets.json tekshiruvi
  e2e:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: docker compose -f infra/compose.ci.yml up -d --wait
      - run: pnpm --filter e2e exec playwright install --with-deps chromium
      - run: pnpm --filter e2e exec playwright test
      - run: pnpm dlx @lhci/cli autorun              # lighthouserc.json + budgets.json
  image:
    needs: e2e
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    strategy:
      matrix: { app: [web, worker, bot] }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/${{ matrix.app }}:${{ github.sha }}
      - uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${{ github.repository }}/${{ matrix.app }}:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: '1'
  deploy-stage:
    needs: image
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://stage.${{ vars.APP_HOST }}
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGE_HOST }}
          username: deploy
          key: ${{ secrets.STAGE_SSH_KEY }}
          script: /opt/yuksaroy/deploy.sh ${{ github.sha }}
  deploy-prod:
    needs: image
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment:
      name: production            # required reviewer: tech lead (Settings → Environments)
      url: https://app.${{ vars.APP_HOST }}
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.PROD_SSH_KEY }}
          script: /opt/yuksaroy/deploy.sh ${{ github.ref_name }}
      - run: |
          curl -fsS https://app.${{ vars.APP_HOST }}/api/health
          curl -fsSo /dev/null https://${{ vars.APP_HOST }}/terminallar
```

`deploy.sh`: `sops -d` → `compose pull` (GHCR, serverda build yo'q) → `compose run --rm web prisma migrate deploy` (expand → migrate → contract) → `compose up -d --wait` → `curl /api/health` → xato bo'lsa `.last_good` ga qaytish + Telegram alert. S0 = VagonFlow ssh-action + GHCR pull + `pnpm audit` + Trivy; semgrep/ZAP/Renovate/syncpack/release-please — sprintiga bittadan, ehtiyoj chiqqanda. PR-preview muhitlari yo'q.

### 13.4 Kuzatuv

**F1:** Uptime Kuma (`/api/health` 60 s, TLS muddati, domen → Telegram) + Grafana + Prometheus (node_exporter, cAdvisor, postgres_exporter, `/metrics`: http latency histogram, `order_created_total`, `slot_hold_total`, `terminal_confirm_seconds`, `outbox_lag_seconds`, `sms_sent_total`) + pino JSON (docker log driver, `docker logs | grep` yetadi) + `/api/client-errors` (20 qator). **Yo'q:** OTel/Tempo/Loki (p95 > 800 ms yoki log grep ishlamay qolganda), Sentry (PII chet elda), Metabase (admin 3 recharts ekrani), PostHog (F2).

SLO (oylik): availability 99,5 % (error budget 3 s 39 daq); API p95 < 400 ms; OTP 60 s ichida 98 %; terminal xabari 30 s 99 %. Alert → Telegram: 5xx > 2 %/5 daq, disk > 80/90 %, WAL arxiv 15 daq uzilsa, sertifikat < 14 kun, `outbox_lag > 60 s`, `paused` outbox; error budget 50 % → reliz muzlatiladi.

### 13.5 Backup / DR

| Obyekt | Vosita | Chastota | Saqlash | RPO / RTO |
|---|---|---|---|---|
| Postgres | pgBackRest → UzCloud S3, `archive_mode=on`, WAL 60 s | full kun 02:00, diff 6 soat | 30 kun PITR, oylik 12 oy | ≤ 1 daq / 60 daq (F2 DBaaS: 5 daq) |
| Fayllar | S3 versioning + `s3 sync` ikkinchi hudud 15 daq | uzluksiz | 90 kun | 15 / 30 daq |
| Konfig/sirlar | git (SOPS) | commit | doimiy | 0 / 10 daq |
| Grafana | provisioning YAML | — | — | 0 / 15 daq |

DR mashqi — har oy 1-juma, stage ga `pgbackrest restore --type=time`, `orders` soni solishtiriladi, `docs/runbooks/dr-drill.md`. VagonFlow Telegram dump ham shu testdan o'tsin.

### 13.6 Threat model (STRIDE, top-11)

| # | Tahdid | Nazorat |
|---|---|---|
| 1 | OTP brute-force / SMS-bombing | `OtpCode.attempts`, telefon 3/10 daq, IP 20/soat (nginx + DB), 5 xato → 30 daq, hCaptcha 3-urinishdan |
| 2 | Sessiya o'g'irlash (XSS) | `httpOnly; Secure; SameSite=Lax`, `sv` bekor qilish, CSP nonce |
| 3 | Narxni klientda o'zgartirish | `calcQuote()` faqat serverda, quote HMAC 15 daq |
| 4 | IDOR `/api/orders/[no]` | `forTenant()`, `tenant.spec` har endpoint 403 |
| 5 | Rozilik/xat soxtalashtirish, replay | F1: OTP + `Signature(ip, at)` + `Document.sha256` + QR; F2: PKCS7 verify (OCSP), TSA, `signature_nonce` unique |
| 6 | Reestr eksporti (insayder) | `tashkilotlar` faqat PLATFORM/OWNER, sahifalash 50, CSV eksport 2 kishi + audit; telefon shifrlangan |
| 7 | Zararli fayl | MIME + magic-bytes, 10 MB, presigned PUT, `attachment`, ClamAV F2, alohida `files.` subdomen |
| 8 | Slot poygasi / DoS | `FOR UPDATE` + CHECK + UNIQUE(terminalId, localDate, window); nginx `limit_req` |
| 9 | Rol ko'tarish (terminal → boshqa terminal) | `Membership.terminalId` claim, `forTenant` fail-closed, rol o'zgarishi faqat PLATFORM + audit |
| 10 | Supply chain | `pnpm audit`, lockfile, Trivy, `permissions` minimal (`contents: read`); Renovate F2 |
| 11 | To'lov webhook soxtalashtirish (F2) | HMAC, idempotency, summa serverdagi quote bilan, IP allowlist |

ASVS L2 chek-list (`docs/security/asvs-checklist.md`), PII reestri (`pii-register.md`). Pentest: ichki F1 oxiri (3 kun), tashqi F2 to'lovdan oldin ($4–8 k, Toshkent kompaniyasi, 3 taklif), 3573-Nizom ekspertizasi O'TY API dan oldin (F3), bug bounty F3.

E-IMZO (F2): foydalanuvchi kaliti serverga kelmaydi (`E-IMZO.js` `create_pkcs7`, mobil deeplink); `e-imzo-server` ichki tarmoqda verify + timestamp; PKCS7 S3 `documents/` versioning; `verify` sahifasi hashni qayta hisoblaydi; platforma o'z imzosi — alohida `signer` xizmati, `.pfx` git/S3 da hech qachon.

### 13.7 Sifat darvozalari

DoD: PR ≤ 400 qator; CI yashil; pul/ruxsat/slot mantiqi uchun vitest majburiy; migratsiya expand-only; yangi endpoint → 403 testi; i18n oz/uz/ru kalitlari, hardcoded matn yo'q; loglar PII siz; tashqi chaqiriq timeout + retry + metrika; **domen glossariy tekshiruvi** (GU-27 ≠ GU-29, atamalar); landing Lighthouse mobil ≥ 85. Trunk-based, squash, Conventional Commits, CODEOWNERS (`packages/db`, `lib/auth`, `infra/**` — tech lead), review SLA 4 soat; reviewer chek-listi: ruxsat filtri, narx serverda, tranzaksiya/lock, test, o'chirsa bo'ladigan kod (ponytail), glossariy.

---

## 14. Bozor va GTM

### 14.1 Faktlar reestri (`docs/facts.md` — PM/market/brend bitta manbadan)

| Fakt | Qiymat | Manba |
|---|---|---|
| O'TY yuk tashish 2025 | **107,9 mln t** (+5,1 %) | Statistika qo'mitasi / everyday.uz 14.02.2026 |
| Tranzit 2025 | 15,3 mln t | spot.uz 01.07.2026 |
| Konteyner 2025 | 355 752 TEU (+21 %) | cac.wtmreport |
| Logistika markazlari | 27 (24 tasi «quruq port»), Toshkent sh. 7, vil. 4 | spot.uz 14.11.2025 |
| O'ztemiryo'lkonteyner terminallari | 21 stansiya (O'TY tarkibida) | railway.uz |
| Ekspeditorlar reestri | 74 | railway.uz |
| Shahobcha yo'llar | 1 393 (reestr), 482 (info) | lokal |
| Mijozlar reestri | 18 428 / STIR 18 338 / stansiyaga 7 056 / telefon 0 | lokal |
| E-logistika (Mintrans) ishga tushdi | **03.03.2026** | yuz.uz |
| SMS narxi | OTP 95 so'm, reklama 175 so'm (Eskiz) | eskiz.uz |
| To'lov komissiyasi | Payme/Click/Uzum 0,8–2 % | vc.ru |
| Tarif | 01.07.2026 shartnomaviy narxlar, shahobchaga +5 %, manevr 510 823 so'm | spot.uz 12.06.2026 |

### 14.2 Raqobat

| Platforma | Nima | Kuchli | Zaif | YS farqi |
|---|---|---|---|---|
| E-logistika (Mintrans) | avto jo'natuvchi–tashuvchi–qabul qiluvchi | rasmiy status, ETTN | avto; terminal/shahobcha/vagon yo'q; kontent bo'sh | rail-side obyektlar; integratsiya (ETTN, tashuvchi reestri), raqobat emas |
| O'TY e-nakl + EBRD | hujjat, dispetcherlik (ichki) | ma'lumot egasi | marketpleys/slot/reyting yo'q | YS = O'TY ustida «front»; API F2 |
| ATI.SU | avto birja, 10 mln MAU | likvidlik, reyting | faqat avto, RF | avto-birja F3 «oxirgi milya» |
| RZD ETP GP | vagon + terminal-ombor onlayn (×3,5 2020) | isbotlangan model | RZD sho'balari xizmati, UX og'ir | xususiy + davlat aralash, aktivlar bozori — eng yaqin shablon |
| KTZ Express | raqamli ekspeditor | hajm | o'zi sotadi | YS neytral maydoncha; F4 hamkor |
| Ikarus Way / TITR | tranzit matching, eskrou 48 soat | eskrou + POD | ichki yuk saroylari yo'q | eskrou modelini bank orqali ko'chiradi |
| Uzum / Kaspi | B2C super-app | to'lov, brend | B2B rail yo'q | Uzum Bank — potentsial faktoring hamkori |

Eng xavfli raqib — Mintrans «temir yo'l moduli» e'lon qilsa → javob: 6 oyda 20 obyekt shartnomasi + E-logistika bilan API hamkorlik taklifi.

### 14.3 TAM / SAM / SOM (tonna-operatsiya)

```
T_op  = 107,9 mln t × 2 operatsiya            = 215,8 mln t-op/yil
P_avg = 17 000 so'm/t (demo 16 000–18 500);  K_add = 1,30 (tarozi, SVX, saqlash, hujjat, oxirgi milya)
TAM   = 215,8 mln × 17 000 × 1,3             ≈ 4,77 trln so'm/yil (~$367 mln)
SAM   = TAM × 25 % (umumiy terminallar + ijaradagi shahobchalar; kon/zavod o'z shahobchasi chiqmaydi) ≈ 1,19 trln
SOM 3 yil = SAM × 45 % (Toshkent + Urganch, Buxoro-2, Qarshi, Nukus, Denov) × 27 % onlayn ≈ 145 mlrd so'm GMV/yil
```
Bottom-up tekshiruv: 20 obyekt × 150 bitim × 2,5 mln = 90 mlrd/yil (SOM ning 62 %); mijoz tomondan: 18 428 → faol 30 % → 27 % aktivatsiya = 1 500 to'lovchi × 2 bitim × 2,5 mln = 90 mlrd. Qo'shimcha bozorlar (TAM dan tashqari): aktivlar bozori, vagon ijarasi (2,1–2,6 mln/oy/vagon), teplovoz smena 12–14 mln, hujjat 90–320 ming/hujjat.

### 14.4 Pozitsiya

**«Temir yo'l yuki uchun terminal, shahobcha va vagon — 3 daqiqada topiladi, onlayn band qilinadi.»** Marketpleys (ekspeditor emas — 74 ekspeditor raqib emas, mijoz/taklif). 3 ustunlik: (1) rail-side ma'lumot (1 393 shahobcha, 300 ESR, VF modellari — O'TY roziligi bilan); (2) operatsion qatlam — stansiya xati, slot, 30 daq SLA (soha regulyatsiyasini bilish); (3) F3 da ikki tomonlama moliya (bank hamkor bilan).

### 14.5 Pilot rejasi (F1, Toshkent tuguni) — ikki segment

| Segment | Obyekt | Kim qaror qiladi | Taklif |
|---|---|---|---|
| Institutsional (O'TY) | Toshkent-tovar (24/7, SVX), Chuqursoy/Sergeli/To'ytepa (O'ztemiryo'lkonteyner) | O'TY Yuk tashish departamenti — memorandum, pilot ro'yxati | Vitrina + slot pilot; komissiya 0 %, SaaS bepul; evaziga slot jadvali/tarif ochiq |
| Xususiy | Angren LC (quruq port), Ohangaron, xususiy SVX, 1 393 reestrdan «claim» qilgan shahobcha egalari (Sergeli-sanoat, Biokimyo tipidagi), xususiy teplovoz (TEM2 Sergeli) | egasi/direktor — 4 daqiqalik skript | Haqiqiy terminal shartnomasi, 0 % 6 oy, birinchi 50 e'lon bepul |

Muvaffaqiyat (F1 oxiri): 5–8 obyekt pasporti to'liq, 300 CBO/oy, slotlarning 20 % onlayn, tasdiq ≤ 30 daq ichida ≥ 85 % (maqsad; H2 minimal chegara 80 % — 2.4 bilan bir xil), ≥ 20 stansiya xati ruxsat olgan.

**Taklif tomonini to'ldirish:** «katalog avval» — 21 + 24 + 27 ≈ 50 obyekt pasporti jamoa tomonidan ochiq ma'lumotdan (manzil, ish vaqti), «claim your terminal»; shahobcha reestri — egasi claim qilmaguncha faqat stansiya + uzunlik (nomi yashirin).

### 14.6 Aktivatsiya (18 428 reestr) — huquqiy chegara ichida

| To'lqin | Segment | Kanal | Sharti |
|---|---|---|---|
| W0 (F1 boshi) | VagonFlow faol mijozlari (~800, bot sessiyasi bor) | **VF bot ichida opt-in xabar** (SMS emas) | O'TY memorandumida «VF bot orqali xabar» bandi |
| W1 | e-nakl «Yagona darcha» foydalanuvchilari | e-nakl ichida banner/xabar (DAS UTY) | Memorandum |
| W2 | MTU (7 ta) oylik yig'ilishi, stansiya DSP orqali offlayn seminar | shaxsan, QR | — |
| W3 | Ekspeditorlar (74) — «agent» tarif (komissiyaning 30 %) | to'g'ridan-to'g'ri | — |
| SMS | faqat o'zi ro'yxatdan o'tgan va rozilik bergan foydalanuvchilarga (tranzaksion) | Eskiz 95 so'm | 01.11.2026 qoidasi |

Telefon ustunlari reestrdan **umuman import qilinmaydi**; W1 «SMS ×2 1 000 mijoz» rejasi olib tashlandi.

### 14.7 Narx siyosati

| Oqim | F1 | F2 | F3 | Nega |
|---|---|---|---|---|
| Bitim komissiyasi (`commissionPayer=TERMINAL`, mijoz ko'rmaydi) | 0 % | 2 % | 3 % | mijoz tomonida 0 ishqalanish; 2,5 mln bitimda 75 ming — terminal uchun mijoz jalb narxidan arzon; H6 A/B F2 |
| SaaS terminal | bepul | Start 0 / Pro 1,5 mln / Enterprise 4 mln so'm/oy | ↑ | freemium bo'lmasa taklif kelmaydi (H13: 20 dan ≥ 8 obuna) |
| Slot fiksatsiya | yo'q | 50 000 so'm, no-show da qaytmaydi | ↑ | H14 |
| E'lon / premium | bepul | oddiy bepul 30 kun, VIP 300 ming/oy, top-3 1 mln/oy | ↑ | likvidlik avval |
| Hujjat («stol uslug») | GU-27 180 k, SMGS 320 k, qayta jo'natish 250 k, VU to'plami 150 k | paket −15 % | | H8 |
| ELS agentlik | — | — | 0,5 % (min 20 k) bank shartnomasi bilan | ZRU-578 |
| Rassrochka/faktoring | — | — | bank/MFO stavkasi, YS agentlik 1–2 % | PP-294/ZRU-765 |

### 14.8 Unit-ekonomika (F3 holati: take-rate 3 %, terminal to'laydi)

| Ko'rsatkich | Mijoz (demand) | Terminal (supply) |
|---|---|---|
| CAC | 150 000 (opt-in kanal + onboarding qo'ng'irog'i) → to'lovchi 600 000 | 5 000 000 (2 tashrif + 1 oy 0 %) |
| ARPU/oy | mijoz to'lamaydi; GMV 5 mln | SaaS 1,5 mln + komissiya 2 × 2,5 mln × 3 % = 150 000 + slot 50 k × 60 = 3 mln → ≈ 4,65 mln |
| Gross margin/oy | — | 4,65 mln − bank komissiyasi (~0,5 %) − support 300 k ≈ 4,3 mln |
| LTV (40 oy) / CAC | — | 172 mln / 5 mln = **34** |
| Payback | — | 1,2 oy |

Take-rate skeyl (SOM 145 mlrd GMV; SaaS 0,54 va qo'shimcha oqimlar 1,2 mlrd take-rate ga bog'liq emas, o'zgarmaydi): 2 % → 2,9 + 0,54 + 1,2 = 4,6 mlrd/yil; 3 % → 4,35 + 0,54 + 1,2 = 6,1 mlrd; 4 % → 5,8 + 0,54 + 1,2 = 7,5 mlrd (churn ↑). Sezgirlik: obyekt soni 20 → 30 bo'lsa SaaS 0,54 → 0,81 mlrd; komissiya terminaldan ushlangani uchun mijoz LTV/CAC hisobi F3 da qayta (payer o'zgarsa).

### 14.9 Hamkorlar

| Hamkor | Rol | Faza |
|---|---|---|
| O'TY Yuk tashish departamenti / DAS UTY | memorandum, reestr roziligi, e-nakl banner, API | F0 / F2 |
| Payme yoki Click (bittasi) | kichik to'lovlar | F2 |
| Bank (TBC / Hamkor / Uzum Bank / Ipoteka) | eskrou hisobi, faktoring/BNPL, ELS agentlik | F2 / F3 |
| E-IMZO / UNICON | ERI | F0 shartnoma → F2 |
| Didox | ESF/akt | F2 |
| Eskiz (PlayMobile zaxira) | SMS | F1 |
| Sug'urta (Gross, Apex) | yuk sug'urtasi agentlik | F3 |
| Mintrans E-logistika | ETTN, tashuvchi reestri API | F3 |

---

## 15. MCP va skill'lardan foydalanish rejasi (`docs/plan/mcp-matrix.md`)

Qoida: har vosita aniq chiqish (artefakt) beradi; sessiyada mavjud bo'lmagan yoki 401 bergan (github MCP) — `gh` CLI / qo'lda.

| Faza | Ish | MCP / skill | Chiqish | Kim |
|---|---|---|---|---|
| F0 | Dizayn tokenlari, logo A/B, ikonlar, Variables light/dark | Figma MCP `create_new_file` → `/figma-use` → `use_figma`, `get_variable_defs` | `YukSaroy · Brand` fayli; `tokens.css` bilan mos | Dizayner |
| F0 | Brend kit, ijtimoiy shablonlar (Telegram post, OG, Instagram) | Canva MCP `list-brand-kits`, `create-brand-template-draft`, `publish-brand-template`, `export-design` | Marketing shablonlari | Dizayner |
| F0 | Key-art (3 hero referens), logo render, 3D ikon konsept | Higgsfield `generate_image`, `generate_image_batch`, `upscale_image`, `remove_background`; `generate_3d` faqat referens | `public/hero/poster-*`, brandbook rasmlari | Dizayner |
| F0 | Hero video (8 s desktop, 6 s mobil) | Higgsfield `generate_video` (Kling 3.0 multi-shot / Veo 3.1), `reframe` 9:16, `upscale_video`, `video_analysis` (loop tikish tekshiruvi); ffmpeg | `hero-720.h264.mp4`, `hero-m.h264.mp4` | Dizayner |
| F0 | Brandbook 12 sahifa, pitch deck, memorandum taqdimoti | Gamma `generate`, `generate_multi_page_gamma`, `export_gamma` | PDF/PPTX | PM |
| F0 | Landing/kabinet maketlari (artboard), foydalanuvchi bilan tahrir | `design` skill (Claude Design canvas), `taste-skill:brandkit`, `taste-skill:imagegen-frontend-web` (seksiya-rasm), `imagegen-frontend-mobile` (F2) | Maket artefakti | Dizayner + PM |
| F0 | Skeleton, CI, deploy | `gh` CLI (github MCP 401 tuzatilguncha), `superpowers:writing-plans`, `superpowers:using-git-worktrees` | Monorepo, `ci.yml` | Tech lead |
| F1 | Kutubxona API tekshiruvi har PR (Next 16.3 `cacheComponents`, React 19.2, Prisma 5.22/7, R3F 9.7, TanStack v5, `@react-pdf/renderer`, `docx`, Telegraf, Expo 55) | **context7** `resolve-library-id` → `query-docs` | To'g'ri API, deprecated yo'q | Barcha dev |
| F1 | shadcn komponentlarini qo'shish, audit | shadcn MCP `search_items_in_registries`, `get_add_command_for_items`, `get_item_examples_from_registries`, `get_audit_checklist` | `packages/ui/components/*` | Frontend |
| F1 | Hero/3D/vizard animatsiyalari, mikro-interaksiya tokenlari | `motion-design` skill (timing/easing), `improve-animations` (audit), `animation-vocabulary` (atama) | `--dur/--ease` tokenlari, `HeroScene` | Frontend |
| F1 | Landing/kabinet sifat auditi | `impeccable:impeccable`, `taste-skill:redesign-skill`, `design:accessibility-review`, `design:design-critique` | Tuzatishlar ro'yxati | Dizayner |
| F1 | Performance byudjeti | chrome-devtools MCP `lighthouse_audit`, `performance_start_trace/stop_trace`, `performance_analyze_insight`, `emulate` (Moto G4/3G), `take_screenshot` (1366×768, 390×844) | LCP/INP/CLS/TBT hisobot, CI `lighthouserc.json` | Frontend |
| F1 | E2E 5 kritik oqim (order, slot-conflict, letter, a11y, locales) | Playwright MCP `browser_navigate/click/fill_form/snapshot`, `browser_run_code_unsafe` (2 kontekst slot poygasi) | `apps/e2e/*.spec.ts` | QA |
| F1 | Admin/terminal analitika ekranlari (3 recharts) | `dataviz` skill (palitra, mark spec), `data:build-dashboard` (prototip) | `boshqaruv/analitika` | Fullstack |
| F1 | Xat DOCX/PDF shablon tekshiruvi | `anthropic-skills:docx`, `pdf-viewer:open`/`annotate` (DS bilan ko'rib chiqish) | `letter.docx.ts`, `LetterPdf.tsx` | Fullstack + domen-ekspert |
| F1 | Seed importlari (ESR, ETSNG, shahobcha, reestr) | `anthropic-skills:xlsx`, `data:explore-data`, `data:validate-data` | `packages/db/seed/*` + sifat hisobot | Backend |
| F1 | Qarorlar/ADR xotirasi (stack, palitra, komissiya, stansiya inboxi) | memory MCP `create_entities`, `add_observations`, `search_nodes`; `productivity:memory-management` | `docs/adr/*`, sessiyalararo kontekst | Tech lead |
| F1 | Kod sifati | `ponytail:ponytail-review` (PR), `ponytail:ponytail-debt` (oylik ledger), `code-review`, `security-review`, `superpowers:test-driven-development` | PR chek-list, `ponytail:` izohlar ro'yxati | Barcha |
| F1 | Diagrammalar (C4, ER, FSM) hujjatlarda | `artifact-diagramming`, Figma `generate_diagram` (FigJam) | `docs/*.md` mermaid, FigJam | Tech lead |
| F2 | Mobil (Expo 55) skrinshot/crash/GPS sinovi | mobile MCP `mobile_list_available_devices`, `mobile_launch_app`, `mobile_take_screenshot`, `mobile_get_crash`, `mobile_swipe/click` | Ekran regressiyasi, OEM batareya wizard tekshiruvi | Mobil dev |
| F2 | Figma ↔ kod bog'lash | Figma `add_code_connect_map`, `get_design_context`, `generate_figma_design` (kod → Figma) | Code Connect Button/Card/SlotCell | Frontend |
| F2 | AI use-case'lar (OCR, matn yaxshilash) | `claude-api` skill (model/narx/structured output), eval `tests/ai/*.eval.test.ts` | `lib/ai/*`, `docs/ai-eval.md` | Backend |
| F2 | Bozor/foydalanuvchi ovozi | `last30days` (ATI/RZD ETP/E-logistika yangiliklari), `design:user-research`, `design:research-synthesis` | Intervyu sintezi (DS, terminal, egasi) | PM |
| Doimiy | Sprint/vazifa boshqaruvi | `productivity:task-management` (TASKS.md), `schedule`/`loop` (nightly eval, DR mashqi eslatmasi) | TASKS.md, cron | PM |

Minimal majburiy to'plam (bo'lmasa loyiha to'xtaydi): context7 (F1 har PR), Figma (tokenlar), Higgsfield (hero), Playwright + chrome-devtools (byudjet darvozasi), memory (ADR). Qolganlari — ehtiyoj chiqqanda.

---

## 16. Roadmap, jamoa, byudjet

### 16.1 Fazalar (haftalar)

| Faza | Haftalar | Mazmun | Milestone |
|---|---|---|---|
| **F0** | 1–6 | Legal-0 (yuridik shaxs, e-tijorat uvedomleniesi, PD reestri, 3 oferta); O'TY departamenti memorandumi (pilot ro'yxati, reestr/shahobcha/VF bot roziligi); DS Sergeli/Chuqursoy intervyu (H4); E-IMZO ariza (VPN kalit, SiteID); domen egaligi + yuksaroy.com + @yuksaroy_bot; IMA tekshiruvi; brend (Figma tokenlar, logo A/B, hero video); 5–8 obyekt pasporti + tarif anketasi; S0–S2 muhandislik | **M0** «Hello prod» (hafta 2): `stage` `/api/health`; **M1** F0 yakuni (hafta 6): memorandum, landing demo, katalog seed |
| **F1** | 7–18 | S3–S8: slot dvigateli, buyurtma FSM, terminal kabineti, VF integratsiya v1, shahobcha katalogi + xat konstruktori (gibrid), stol uslug, reyting, admin, i18n, bot, Playwright, ichki pentest | **M2** F1 MVP prod (hafta 18): Toshkent tuguni, 300 CBO/oy maqsadi |
| **F2** | 19–34 (S9–S16) | E-IMZO (rozilik + xat ERI), VF stansiya inboxi + WagonMemo naryad + DSP webhook, bitta to'lov provayderi + bank eskrou + Didox ESF, terminal SaaS kabineti (resurs, e'lon, hisobot), aktivlar bozori + bitim, mutaxassislar, demurraj taymeri, MapLibre, Expo mobil (logist/terminal/haydovchi), TMA, tashqi pentest, PostHog | **M3** F2 prod (hafta 34) |
| **F3** | oy 9–14 | Bank hamkori: faktoring/BNPL agentligi, ELS agentlik; DAS UTY axborot almashinuv (agar bo'lsa); avto-birja + GPS; analitika/ML (median → LightGBM); tender, referal; 3573 ekspertiza; hududlar (Urganch, Buxoro-2, Qarshi, Nukus, Denov) | 20+ obyekt, 3 000 CBO/oy |
| **F4** | 15+ oy | Xalqaro portlar, akademiya, ma'lumot-analitika API, K8s (mezon bo'yicha) | — |

### 16.2 Jamoa (bitta shtat jadvali)

| Rol | F0–F1 (oy 1–6) | F2 (oy 7–12) | Oylik (so'm, yalpi) |
|---|---|---|---|
| Tech lead (fullstack Next/Prisma, arxitektura, prod tasdig'i) | 1 | 1 | 35 mln |
| Fullstack senior (slot/buyurtma/xat, 3D-hero) | 1 | 1 | 25 mln |
| Fullstack middle (bot, worker, import, admin) | 1 | 1 | 15 mln |
| Backend senior (to'lov, ERI, Didox) | — | 1 | 25 mln |
| Mobil (Expo, VF mobil muallifi) | — | 1 | 17 mln |
| UI/UX + motion dizayner | 0,5 | 0,5 | 18 mln × 0,5 |
| DevOps/SecOps | 0,5 (F0 da 1 oy full) | 0,5 | 18 mln × 0,5 |
| QA (manual + Playwright) | 0,5 (3-oydan) | 1 | 12 mln |
| PM / Product owner | foydalanuvchi | foydalanuvchi | 0 |
| Domen-ekspert (temir yo'l) | foydalanuvchi + tarmoq | 0,5 | 10 mln × 0,5 |
| **Jami FTE** | **≈ 5** (4,5) | **≈ 7,5** | |
| **Jamoa xarajati/oy** | **≈ 99 mln** (35+25+15+9+9+6) | **≈ 152 mln** (35+25+15+25+17+9+9+12+5) | |

Nega 9 FTE emas: F1 qamrovi YAGNI qisqartirishlardan keyin (41 model, 85 endpoint, 7 band, Redis/NestJS/ERI/to'lov yo'q) 3 dasturchiga sig'adi; PM sprint bahosi (23 sprint-birlik) 5 FTE ga qayta hisoblanganda 12 hafta = 6 sprint × ~4 birlik. Xavf: tech lead ketsa — CODEOWNERS ikki kishi (senior ham).

### 16.3 Byudjet

| Modda | F0–F1 (6 oy) | F2 (6 oy) | F0–F2 (12 oy) |
|---|---|---|---|
| Jamoa | 594 mln (99 × 6) | 912 mln (152 × 6) | 1 506 mln |
| Infra (UzCloud) | 14 mln (2,4/oy) | 24 mln (4/oy) | 38 mln |
| Servislar (GitHub, Figma, SMS OTP ~10 k × 95, domenlar, E-IMZO, Higgsfield/Gamma obuna) | 18 mln | 24 mln | 42 mln |
| Tashqi pentest | — | 70 mln | 70 mln |
| Rezerv 10 % | 63 mln | 103 mln | 166 mln |
| **Jami** | **≈ 0,69 mlrd so'm (~$53 k)** | **≈ 1,13 mlrd (~$87 k)** | **≈ 1,82 mlrd so'm (~$140 k)** |
| Investor so'rovi (+ marketing 150 mln, yuridik/bank integratsiya 100 mln) | | | **≈ 2,1 mlrd so'm, 12 oy, F0–F2** |

Tekshiruv: F0–F1 = 594 + 14 + 18 = 626 + 63 = 689; F2 = 912 + 24 + 24 + 70 = 1 030 + 103 = 1 133; jami = 1 506 + 38 + 42 + 70 = 1 656 + 166 = 1 822. Kurs ≈ 13 000 so'm/$.

Market linzasidagi «3,2 mlrd / 14 oy / 6 kishi» va devops «1,35 mlrd / 6 oy / 9 FTE» shu jadvalga almashtiriladi. IT Park rezidentligi (JShDS 7,5 %) — buxgalter bilan.

### 16.4 Sprint 1–6 mazmuni (2 haftalik, DoD bilan)

| Sprint | Haftalar | Natija | Qabul mezoni |
|---|---|---|---|
| **S0** | 1–2 | Monorepo skeleton (`apps/web`, `worker`, `bot`; `packages/db`, `domain`, `ui`, `i18n`, `config`), CI yashil (lint/typecheck/test/build), dev compose, Ansible `base.yml` stage VM, domen + TLS, `tokens.css` + Figma Variables, logo A/B SVG, **Legal-0** boshlandi, E-IMZO ariza yuborildi | `stage.{APP_HOST}/api/health` 200; Figma tokenlar = CSS |
| **S1** | 3–4 | Prisma sxema v1 (41 F1 model, 7.1), migratsiya, seed 00–03 + 07 (5 obyekt pasporti), auth (telefon + OTP, sessiya porti), `OrgKind × OrgRole`, `forTenant()`, `requireRole`, admin KYC navbati, i18n oz/uz/ru skeleti | OTP bilan kirish; 3 rol prefiksi; `tenant.spec` 403; seed idempotent |
| **S2** | 5–6 | Katalog + pasport (`use cache`), `SidingMap` SVG + stansiya ro'yxati (railmap API), `calcQuote()` + tarif matritsasi, **landing**: hero video + poster + tez hisob (`POST /api/quote`) + `RailNetwork3D` (desktop) + qolgan 5 seksiya (jami 6, 8.2), Lighthouse CI | **M1**: memorandum, landing demo; LCP ≤ 2,0 s, JS ≤ 150 KB |
| **S3** | 7–8 | Slot dvigateli (`TimeSlot`, hold/extend/confirm, `FOR UPDATE`, cron expire), buyurtma vizardi 3 ekran, Order FSM + history + outbox, terminal inbox + 30 daq SLA + auto-expire, Telegram bot (holat, qabul/rad) | `slot-conflict.spec` 409; `order.spec` 3 daq; SLA expire cron |
| **S4** | 9–10 | VagonFlow v1 (`requests` route VF tomonida, webhook + dedupe, Siding sinxron), buyurtma timeline + sub-hodisalar (`placedAt`), akt/invoice PDF (react-pdf), Web Push, SMS (Eskiz), AuditLog + Event, admin «to'landi» | VF Request yaratiladi va status webhook keladi; PDF Cyrillic to'g'ri |
| **S5** | 11–12 | **Shahobcha katalogi (claim) + stansiya xati konstruktori** (4 qadam, A4 preview, PDF + DOCX + QR, `/tekshir`), egasi roziligi (bot + SMS-OTP), submit gibrid, VF `letters` route + webhook (VF ekrani oddiy ro'yxat), operator 8a fallback, `letter.spec` | 10 vagonli xat ≤ 4 daq; DS Sergeli bilan UAT (qog'oz + QR) |
| S6 | 13–14 | Stol uslug navbati, TY kod cheklist, reyting, admin analitika 3 ekran, tashkilotlar jadvali (virtual), PWA manifest + install prompt, oz/uz/ru to'liq, a11y audit | `a11y.spec` 0 serious; `locales.spec` |
| S7 | 15–16 | Playwright 25 sinov, ichki pentest (ASVS L2), load test k6 200 RPS, pgBackRest + DR mashqi #1, Grafana/Uptime Kuma, runbooklar, `v1.0.0` | **M2** F1 prod (hafta 16–18), 10 tashqi mijoz UAT |
| S8 | 17–18 | Pilot stabilizatsiya (F1 ning oxirgi sprinti), H2/H3/H4 o'lchovi, F2 rejasi (E-IMZO shartnoma imzolangan bo'lishi kerak); F2 sprintlari S9–S16 (hafta 19–34) | 300 CBO/oy trend; tasdiq ≤ 30 daq ≥ 85 % (H2 minimal chegara 80 %) |

---

## 17. Xavflar (top-15) va ochiq savollar

### 17.1 Top-15 xavf

| # | Xavf | Ehtimol / ta'sir | Yumshatish | Egasi |
|---|---|---|---|---|
| 1 | O'TY yuk saroylari pilotga kirmaydi (korporativ qaror, «boshliq» huquqi yo'q) | Yuqori / Yuqori | Memorandum departament darajasida; xususiy LC/SVX/shahobcha segmenti parallel (12.4) | CEO |
| 2 | DS elektron/QR xatni rasmiy deb qabul qilmaydi (ZRU-793) | Yuqori / Yuqori | F0 intervyu (H4); F1 gibrid qog'oz; E-IMZO F2; VF stansiya ekrani | Ops |
| 3 | yuksaroy.uz egaligi tasdiqlanmaydi | O'rta / O'rta | Bugun tekshiruv; yuksaroy.com; `APP_HOST` env | CEO |
| 4 | Reestr/shahobcha/telefon ma'lumotini ruxsatsiz ishlatish → O'TY bilan munosabat uziladi | Yuqori / Yuqori | Yozma rozilik F0; `CONSENT_REF`; SMS to'lqinlari yo'q; landing raqamlari o'zimizniki | CEO |
| 5 | Terminal 30 daqiqada javob bermaydi (H2) | O'rta / O'rta | 2 hafta pilot; ≥ 80 % bo'lmasa 60 daq + auto-accept (`PlatformConfig`) | Product |
| 6 | Slot modeli t/y terminalda ishlamaydi — vagon O'TY ga bog'liq (H7) | O'rta / Yuqori | Oyna terminal sozlaydi (2 soat / smena); `delayReason=RAILWAY` reytingga ta'sir qilmaydi; slot vagon kelishiga bog'lanadi | Product |
| 7 | E-IMZO shartnomasi/SiteID kechikadi | O'rta / O'rta | F0 da boshlash (CTO, 4–6 hafta); F2 S9 (hafta 19) gacha OTP daraja | CTO |
| 8 | VagonFlow tomonidagi 4 route + 1 ekran + 3 webhook kechikadi | O'rta / O'rta | Operator 8a fallback; VF o'zgarishi bitta dev, 1 sprint | Tech lead |
| 9 | Profil egallash (STIR ochiq, telefon+OTP) | O'rta / Yuqori | F1 operator KYC (hujjat + qo'ng'iroq); F2 E-IMZO TIN == STIR; unverified read-only | CTO |
| 10 | Tarif metodikasi 2026–27 o'zgaradi | Yuqori / O'rta | Tarif versiyalar + config; «taxminiy» belgisi | Product |
| 11 | Terminologik xato soha ishonchini yo'qotadi | O'rta / Yuqori | Glossariy yagona manba, PR chek-list, domen-review | Product |
| 12 | Jamoa: tech lead / senior ketishi | O'rta / Yuqori | CODEOWNERS 2 kishi, ADR/memory, runbooklar | CEO |
| 13 | Mintrans E-logistika «temir yo'l moduli» | O'rta / O'rta | 6 oyda 20 obyekt; API hamkorlik taklifi | CEO |
| 14 | Landing performance (3D/video) o'rta Android da yiqiladi | O'rta / Past | Fail-closed fallback (detect-gpu, pointer:fine), byudjet CI da | Frontend |
| 15 | Huquqiy: e-tijorat uvedomleniesiz start, PD reestrisiz SMS | O'rta / O'rta | Legal-0 S0, M2 DoD | Legal |

### 17.2 Foydalanuvchidan qaror kutilayotgan nuqtalar (12)

| # | Savol | Variantlar | Tavsiya |
|---|---|---|---|
| Q1 | **yuksaroy.uz** sizniki mi (03.09.2026, SUVAN NET, Farg'ona)? | (a) ha — aktivatsiya; (b) yo'q — yuksaroy.com + yuk-saroy.uz, registratorga so'rov | Bugun tekshirish; har holda yuksaroy.com va @yuksaroy_bot ni olish |
| Q2 | Stansiya boshlig'i/DSP inboxi qayerda? | (a) VagonFlow ichida (`/station/letters`, 4 route + 1 ekran + 3 webhook — 4.3); (b) YukSaroy da `(station)` route group + `RAILWAY_STATION` rol | **(a)** — DS/DSP allaqachon VF da; (b) faqat O'TY VF ekranini rad etsa; 8a operator fallback ikkalasida |
| Q3 | F1 xat huquqiy shakli | (a) gibrid: PDF + QR + chop etilgan muhrli nusxa, ERI F2; (b) E-IMZO ni F1 ga tortish (S5 gacha shartnoma — xavfli) | **(a)**; E-IMZO shartnoma F0 da boshlanadi, F2 S9 dan (hafta 19) |
| Q4 | Komissiya modeli | (a) terminaldan take-rate, mijoz ko'rmaydi (0 % → 2 % → 3 %); (b) mijoz ko'radigan ochiq +3 % (Ish standarti matni) | **(a)** — `commissionPayer=TERMINAL`; Ish standarti §02 matni tuzatiladi; H6 A/B F2 |
| Q5 | Palitra | (a) demo navy/teal/amber UI tokenlari + brend qum foni, logolar qayta bo'yaladi (bajarildi, 9-bo'lim); (b) brend lojuvard/firuza/mis — UI tokenlari va kontrast lint qayta | **(a)** |
| Q6 | Logo | A «Ravoq + rels» / B «YS» | **A** (temir yo'l + saroy + darvoza bir belgida; favicon degradatsiyasi tabiiy); B — investor materiallarida test |
| Q7 | Hero video F1 | (a) AI (Higgsfield, ~$60/oy obuna, 1–2 kun); (b) real dron (O'TY ruxsati, 1 hafta+) | **(a)** F1, (b) F2 almashtirish |
| Q8 | O'TY/DAS UTY yozma roziligi — kim, qachon? Reestr + shahobcha reestri + VF bot xabari | memorandum bandi F0 hafta 1–4 | Rozilik bo'lmaguncha seed 04/05 o'tkazib yuboriladi, katalog «ochiq ma'lumot» bilan chiqadi |
| Q9 | Bank hamkori (eskrou hisobi, faktoring/BNPL, ELS agentlik) | TBC / Hamkor / Uzum Bank / Ipoteka | F1 davomida 3 bank bilan uchrashuv; F2 eskrou, F3 BNPL |
| Q10 | Pilot obyektlar ro'yxati va shakli | O'TY yuk saroylari (memorandum) + xususiy LC/SVX (shartnoma) — aniq 5–8 nom | Foydalanuvchi tarmog'idan; H1 ikkala segment bo'yicha |
| Q11 | Terminal 30 daqiqalik SLA pilot obyektlar bilan kelishilganmi? | 30 daq / 60 daq + auto-accept | `PlatformConfig.terminalConfirmMin` — pilotda o'lchab qaror |
| Q12 | Postgres 17 + Prisma 5.22 (VF bilan bir xil) — Prisma 7 ga qachon? | F1 da 5.22; ADR bilan VF va YS bir vaqtda (F2 oxiri) | **5.22 F1** |

---

## 18. Skeptiklar bilan hisob-kitob

| Skeptik | Topilma | Qaror | Qayerda |
|---|---|---|---|
| yagni, reality, complete | NestJS vs Next Route Handlers | **Qabul** — Next.js monolit + worker | 4.1 |
| yagni, uxperf, complete | Order FSM 4 xil | **Qabul** — 9 status, sub-hodisalar history da | 6.4 |
| yagni, uxperf, complete | Letter FSM 4 xil | **Qabul** — data modeli + RETURNED/IN_EFFECT, DspTask o'rniga WagonMemo | 3.3 |
| yagni, reality, complete | Eskrou/ledger/rassrochka platformada | **Qabul** — o'chirildi; bank eskrou F2, BNPL bank hamkor F3 | 7.1, 12.3 |
| yagni, reality, complete | GU-29 ≠ nakladnoy | **Qabul** — GU-27; GU-29 katalogdan chiqdi; GU-12 = VF Request | 12.1 |
| yagni | Postgres/Node/Prisma versiyalari | **Qabul** — 17 / 24 / 5.22 | 5.1, 7 |
| yagni | Redis/BullMQ vs Postgres-only | **Qabul** — node-cron + outbox + Job jadvali | 6.5 |
| yagni, complete | Prod compose 11 konteyner | **Qabul** — 5 + backup | 13.2 |
| yagni, uxperf | Slot hold 90 s vs 10 daq | **Qabul** — 10 daq config + «Uzaytirish» 1 marta (uxperf 5 daq taklifi — pilotda o'lchab pasaytiriladi) | 5.5 |
| yagni, uxperf, complete | Slot modeli resurs × oyna | **Qabul** — terminal × kun × oyna F1, `resourceId?` F2; xizmat bo'yicha agregat F2 | 7.4 |
| yagni, complete | Rollar 3 model | **Qabul** — OrgKind × OrgRole | 6.3 |
| yagni | RLS + CASL + forTenant + requireRole | **Qabul** — 2 qatlam | 6.3 |
| yagni | Kuzatuv 9 tizim | **Qabul** — Uptime Kuma + Grafana/Prometheus + pino | 13.4 |
| yagni, complete | 60 model, MV, partitsiya | **Qabul** — 41 F1 (39 qator), SQL | 7.1 |
| yagni, reality, complete | LLM bilan xat | **Qabul** — shablon, $0 F1; LLM faqat F2 ixtiyoriy, reestr maydonlarisiz | 11 |
| yagni, uxperf, complete | Komissiya kim to'laydi | **Qabul** — payer TERMINAL, 0 % F1 | 14.7, Q4 |
| yagni, complete | ERI F1/F2 — H4 | **Qabul** — gibrid F1, H4 F0 intervyu, E-IMZO F0 da boshlanadi | 3.3, Q3 |
| yagni, reality, complete | Demurraj GU-45 dan | **Qabul** — `placedAt`, `delayReason`; taymer F2 | 3.2, 7.1 |
| yagni, reality | STIR API yo'q; profil egallash | **Qabul** — reestr lookup + operator KYC F1, E-IMZO F2; checksum yo'q | 6.3, 12.1 |
| yagni, reality, complete | 18 428 reestr, telefonlar, SMS to'lqinlari | **Qabul** — yozma rozilik, opt-in, telefon import yo'q, SMS to'lqinlari yo'q | 12.3, 14.6 |
| yagni, uxperf, complete | Hero video 3 spets | **Qabul** — 8 s 720p H.264 ≤ 1,8 MB (+ AV1 ixtiyoriy), poster `<picture>`, preload none, pauza tugmasi | 8.3 |
| yagni, uxperf, complete | Palitra brend vs demo | **Qabul** (B) — demo tokenlari + qum fon, logolar qayta bo'yaldi | 5.4, 9 |
| yagni, uxperf | 3D/scroll stack (Lenis, GSAP, Bloom, shaderlar, pin 500 vh) | **Qabul** — bitta sahna, 1 pin ≤ 150 vh, GSAP/Lenis yo'q, detect-gpu fail-closed | 8.4, 8.5 |
| yagni, uxperf | MapLibre + PMTiles 300 MB | **Qabul** — SidingMap SVG F1, MapLibre F2 | 5.4 |
| yagni | PWA/offline ikki navbat, Serwist F1 | **Qabul** — manifest F1, SW/offline F2; Idempotency-Key F1 | 5.7 |
| yagni, complete | Mobil SDK 55/56, F1/F2, TMA alohida app | **Qabul** — SDK 55, F2, `/tma` route | 10 |
| yagni, complete | Monorepo 5 daraxt, 2 i18n | **Qabul** — bitta daraxt, next-intl yo'q, `packages/i18n` VF porti | 5.2, 5.6 |
| yagni | Auth RS256/JWKS/Session | **Qabul** — VF HS256 cookie; refresh mobil bilan F2; shared-secret Bearer | 6.3 |
| yagni, reality, complete | Jamoa/byudjet 4 xil | **Qabul** — 5 FTE F1 / 7,5 FTE F2, 0,69 / 1,82 mlrd | 16.2–16.3 |
| yagni, reality, complete | Domen egaligi | **Qabul** — Q1, `APP_HOST` | 9.1, Q1 |
| reality | Taklif tomoni O'TY korporativ qaror; sotuv skripti noreal | **Qabul** — F0 qayta yozildi, ikki segment | 12.4, 14.5 |
| reality, complete | Xat blankasi (yuk egasi), permitNo DS kiritadi | **Qabul** | 3.3 |
| reality, complete | Stansiya kabineti VF ichida | **Qabul (tavsiya)** — Q2 foydalanuvchi tasdiqlaydi; 8a fallback | 3.3, Q2 |
| reality | AI ma'lumot lokalizatsiyasi (`inference_geo: us`) | **Qabul** — reestr maydonlari API ga ketmaydi, lint qoidasi | 11.3 |
| reality | E-IMZO deeplink (QR emas), SiteID, egasi/muddat | **Qabul** — F0 CTO 4–6 hafta | 10.3, 16.1 |
| reality | B2B to'lov: Payme/Click 3 provayder ortiqcha; bank o'tkazma + Didox birinchi | **Qabul** — bitta provayder F2, Didox F2 | 2.2 M5.2–5.3 |
| reality | TY kod: operator mijoz nomidan yurmaydi, 3 kun SLA yo'q | **Qabul** | 3.4 |
| reality | «O'TY ma'lumoti orqali vagon yaqinlashuvi» — ASOUP yo'q | **Qabul** — VF lifecycle / mijoz vagon №; ASOUP = W | 2.2 M4.4 |
| reality, uxperf | Landing «18 428 mijoz» | **Qabul** — faqat o'z raqamlari | 8.2 |
| reality | STIR nazorat raqami algoritmi ochiq emas | **Qabul** | 12.1 |
| reality | SMS narxi 95/175 | **Qabul** | 14.1 |
| reality | Bozor raqamlari (107,9; E-logistika 03.03.2026) | **Qabul** — facts.md | 14.1 |
| reality | Hujjat saqlash 5 yil | **Qabul** | 7.4 |
| reality | Teplovoz e'loni narxi/ruxsati | **Qabul** — permitNo, scope | 3.6, 12.1 |
| reality | Legal-0 epik (uvedomlenie, PD reestri) | **Qabul** — S0, M2 DoD | 12.3, 16.4 |
| reality | Slot = kun + smena, 2 soat faqat gate | **Qisman** — oynani terminal sozlaydi (2 soat yoki smena), bitta model | 7.4 |
| uxperf | 3D fallback Chromium-only API | **Qabul** — detect-gpu, pointer:fine, fail-closed | 8.4 |
| uxperf | Vizard 3/5/6 qadam | **Qabul** — 3 ekran | 8.6 |
| uxperf | Kirill subset (Қ/Ғ/Ҳ) | **Qabul** — pyftsubset diapazonlari | 5.4 |
| uxperf | Scroll-jacking, pinlar, gorizontal snap | **Qabul** — 1 pin, snap yo'q | 8.5 |
| uxperf | WCAG 2.2.2 pauza tugmasi; backdrop-filter; JS byudjeti 120/350 | **Qabul** — pauza, solid navbar, ≤ 150 KB | 8.3, 8.1, 5.8 |
| uxperf | SLA taymer aria-live shovqin | **Qabul** — role=timer off + polite region | 5.4 |
| uxperf | i18n Should → Must, manba oz | **Qabul** | 5.6 |
| uxperf | Xat konstruktori mobil UX | **Qabul** — 4 qadam stepper, VF providedWagons | 8.6, 10.2 |
| uxperf | Sidebar 12 → 7 | **Qabul** | 5.3 |
| uxperf | Hero'da qidiruv/tez hisob | **Qabul** — 7/12 ustun, `POST /api/quote` | 8.2 |
| uxperf | Primary teal-ink #0B7568, fon qum | **Qabul** | 5.4 |
| uxperf | Unbounded og'irliklari, CLS | **Qabul** — 700 bitta fayl, adjustFontFallback | 5.4 |
| uxperf | Tile keshi 200 MB | **Qabul** — MapLibre F2, kesh 40 MB o'shanda | 5.7 |
| complete | Deal/ManeuverRequest/SidingServiceContract/SvxWarehouse yo'q | **Qabul** — F2 entitylar; F1 xatda contractNo + fayl | 7.1 |
| complete | Terminal «E'lon berish» route, chat | **Qabul** — e'lon F2 route; chat F3, F1 Telegram deep-link | 2.2 |
| complete | PDF 3 stack, LibreOffice | **Qabul** — react-pdf + docx; pdf-lib F2 | 5.1 |
| complete | Logo C rad, 16 px fayl yo'q | **Qabul** — A-16, A-32, A-mono SVG va to'liq girih fayli qo'shildi | 9.2 |
| complete | MCP matritsa yo'q | **Qabul** — 15-bo'lim | 15 |
| **Rad etilgan** | uxperf: hold 5 daq default | Rad (hozircha) — 10 daq config; pilot «yolg'on band» ko'rsatsa 5 ga tushiriladi | 5.5 |
| **Rad etilgan** | yagni: AV1 umuman yo'q | Qisman rad — AV1 ixtiyoriy 1 qator ffmpeg, H.264 majburiy | 8.3 |
| **Rad etilgan** | reality: ikkala imzo ERI F1 da (ZRU-793 qat'iy) | Rad F1 uchun — gibrid qog'oz huquqiy kuchni saqlaydi; ERI F2 | 3.3 |
| **Rad etilgan** | complete: Lenis + GSAP saqlansin (UX §4) | Rad — F2 «polish», H2/H3 isbotlangandan keyin | 8.5 |
| **Rad etilgan** | mobile: 1-haftadan 12 haftalik mobil reja, 2 RN dev | Rad — F2, 1 RN dev | 10.1 |

---

*Hujjat oxiri. Keyingi qadam: Q1–Q12 javoblari → S0 boshlanadi (monorepo skeleton, Legal-0, memorandum loyihasi, Figma tokenlar).*
