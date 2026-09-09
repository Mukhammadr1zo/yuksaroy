# YukSaroy — Mobil ilova (lens: mobile, rol: Mobile Lead)

## 0. Fakt-bazasi (2026-09-03 holati, manbalar oxirida)

**VagonFlow mobil (taminot-mobile/package.json, app.config.ts, eas.json):** Expo SDK 54 (`expo ~54.0.0`), `expo-router ~6`, React Native 0.81.5, React 19.1, `@react-native-firebase/messaging 22` (FCM, ixtiyoriy — google-services.json bo'lmasa push no-op), `expo-updates 29` (OTA, `runtimeVersion: appVersion`, kanal preview/production), `expo-location 19` (faqat ob-havo uchun, foreground), `expo-secure-store` (JWT), `expo-local-authentication` (Face ID/PIN qulf), `expo-image-picker` (faqat galereya, kamera o'chirilgan), `@react-native-community/netinfo` (offline-banner), `react-native-gifted-charts`. 53 ta ekran `app/(app)/`, 3 ta auth ekran. `src/lib/api.ts` — fetch wrapper (ApiError/NetworkError/TimeoutError, 15 s timeout, 401 → sessiya tozalash). `src/lib/push.ts` — FCM token registratsiyasi + Android kanal + `routeFromData` (server `route` maydoni bilan deep-link). `src/lib/i18n.ts` — oz/uz/ru context, funksiya-kalitlar. `docs/PLAY-STORE.md`, `docs/iOS-RELEASE.md` — nashr kitlari tayyor. Paket: `com.uzty.vagonflow`, EAS owner `muhammadrizo19`.

**Ekotizim (2026):**
- Expo SDK 55 (2026-yanvar): RN 0.83, React 19.2, Legacy Architecture olib tashlangan (`newArchEnabled` flagi yo'q), Expo Router v7, Hermes bytecode diffing — OTA yuklamalar 75 % kichik. SDK 56 (2026-05-21): RN 0.85, Hermes V1 default, Expo UI (SwiftUI/Compose) stable, `@gorhom/bottom-sheet`/datetimepicker uchun drop-in o'rinbosarlar; **ma'lum muammo:** Hermes V1 + reanimated/worklets xotira regressiyasi, SDK 57 da tuzatiladi.
- RN 0.82 dan boshlab faqat New Architecture; legacy 2025-iyunda muzlatilgan.
- Flutter: stable 3.47, «Flutter 4.0» yo'q (blog-taxminlar); Android 10+ da Skia olib tashlanib Impeller qoladi.
- Telegram Mini Apps: `LocationManager.requestLocation` (Bot API 8.0, bir martalik), `BiometricManager`, fullscreen/landscape, home-screen shortcut, share; 2026-07-20 dan origin-himoya (Mini App metodlari faqat asl domendan).
- Android developer verification: 2026-09-30 dan Braziliya/Indoneziya/Singapur/Tailandda majburiy, 2027 — global; tasdiqlanmagan dasturchi APK'si «advanced flow» bilan 24 soat kutish; ADB orqali o'rnatish istisno. Play siyosati: background location uchun deklaratsiya formasi + video, «prominent disclosure» ekrani; Android 17 target uchun enforcement 2026-oktyabr oxiri.
- expo-location: ilova yangilanganda location-FGS qotishi (expo/expo#47595), SDK 56 da ilova o'ldirilgach task qayta ro'yxatdan o'tmasligi — ikkalasi ochiq.
- Offline: 2026 tavsiyasi yangi Expo loyiha uchun `expo-sqlite` + Drizzle; WatermelonDB — 10k+ yozuv va tayyor sync-protokol kerak bo'lsa.
- E-IMZO (ID Karta) mobil ilovasi `uz.yt.idcard.eimzo`: sayt/ilova hujjatni QR ko'rinishida beradi → E-IMZO ilovasi kalitni (PFX Downloads papkasida yoki ID-karta NFC) tanlab imzolaydi.

---

## 1. Qaror: stack

| Mezon | Expo RN (monorepo, SDK 55) | Flutter 3.47 | Faqat PWA + Telegram Mini App |
|---|---|---|---|
| VagonFlow mobil bilan kod ulashish | **To'liq**: api.ts, push.ts, i18n, offline-banner, EAS/store kitlari ko'chadi | 0 % (Dart) | Web-komponentlar ulashiladi, mobil lib'lar yo'q |
| Next.js backend bilan tip ulashish (zod, Prisma tiplari) | **Ha** — `packages/types` | Yo'q (OpenAPI codegen kerak) | Ha |
| Background GPS (haydovchi) | Ha (expo-location + task-manager; OEM muammolari bor) | Ha (geolocator/background_locator — ham OEM muammolari) | **Yo'q** — PWA fon-GPS bermaydi, TMA faqat bir martalik lokatsiya |
| Push (FCM/APNs) | Ha (VagonFlow'da ishlab turibdi) | Ha | PWA iOS'da cheklangan, TMA — faqat bot xabari |
| Offline (SQLite) | Ha | Ha | IndexedDB (zaif) |
| Kamera/QR/foto-dalil | Ha | Ha | Kamera — ha, fon/EXIF — zaif |
| OTA yangilanish | EAS Update (75 % kichik diff) | Shorebird (pullik) | Tabiiy |
| Jamoa (hozir 1 TS full-stack) | **Bir til, bir repo** | Ikkinchi til + 2-jamoa | Bir til |
| MVP'gacha vaqt (7 rol) | 12 hafta | 16–20 hafta (noldan) | 6 hafta, lekin haydovchi roli yo'q |

**Qaror: Expo SDK 55 + expo-router v7, pnpm monorepo; TMA — ikkilamchi kanal (2-bo'lim 5), PWA — faqat web (`apps/web` responsive).** Nima uchun SDK 55, 56 emas: 56 dagi Hermes V1 xotira regressiyasi reanimated bilan (bizda animatsiya ko'p: slot grid, xarita) — SDK 57 stable bo'lgach bitta `expo install --fix` bilan o'tamiz (Q4 2026). Flutter alternativasi faqat alohida Flutter jamoasi yollansa mantiqli — hozirgi holatda VagonFlow'dagi 53 ekranlik Expo tajribasi va tayyor nashr hujjatlari (PLAY-STORE.md, iOS-RELEASE.md) Flutter'ning 3–4 oylik ustunligini yo'qqa chiqaradi.

**Bitta ilova yoki ikkita?** Ikkita binary: `com.uzty.vagonflow` — temir yo'l xodimlari (ichki), `uz.yuksaroy.app` — bozor (mijoz/terminal/haydovchi). Sabab: Play/App Store listing, ruxsatlar (background location faqat YukSaroy'da), auditoriya va brend har xil; VagonFlow'ning `CONSIGNEE` roli vaqt o'tib YukSaroy «logist» roliga ko'chadi. Alternativa — bitta super-app: ruxsatlar deklaratsiyasi og'irlashadi, xodim ilovasida «Reklama/e'lonlar» chiqishi ma'muriy noqulay. Mobil ilova VagonFlow API'ga to'g'ridan-to'g'ri urmaydi — faqat YukSaroy backend orqali (server-to-server, bitta JWT).

**Monorepo (`pnpm` + Turborepo):**
```
yuksaroy/
├─ apps/web        (Next.js 16, mavjud reja)
├─ apps/mobile     (Expo SDK 55)
├─ apps/tma        (Telegram Mini App — Next.js route yoki Vite, 5-bo'lim)
├─ packages/types      zod sxemalar: Order, Slot, Terminal, TrackPoint, Letter — backend ham shuni import qiladi
├─ packages/api-client taminot-mobile/src/lib/api.ts ko'chirilgan + typed endpointlar (`api.orders.list()`)
├─ packages/i18n       oz/uz/ru/en JSON lug'atlar + `t()`; VagonFlow i18n.ts shakli
├─ packages/tokens     ranglar/spacing/tipografiya → Tailwind v4 CSS var + RN `theme.ts` (bitta manba)
└─ packages/config     eslint, tsconfig.base
```
Windows eslatma: pnpm symlink uchun Developer Mode yoqiladi; Metro monorepo'ni SDK 52+ dan avtomatik taniydi (`watchFolders` qo'lda kerak emas).

---

## 2. 7 rol — ekran xaritasi

Navigatsiya: `expo-router v7`, har rol o'z route-guruhida `app/(driver)/…`, `app/(logist)/…`. Bitta akkaunt — bir nechta rol (ish standarti §01): profil ekranidagi rol-switcher `SecureStore.activeRole` ni almashtiradi, root `_layout.tsx` guruhga yo'naltiradi (VagonFlow'dagi role-gated tabs naqshi). Tab bar 4–5 tab + stack ekranlar. Umumiy ekranlar (barcha rollar): OTP kirish, rol tanlash, bildirishnomalar, profil/KYC, sozlamalar (til, PIN, batareya-wizard).

### 2.1 Fura haydovchisi (`(driver)`) — tab: Reyslar · Xarita · Darvoza · Profil
| # | Ekran | Asosiy widget |
|---|---|---|
| 1 | Reyslar ro'yxati | Bugungi reys kartasi: terminal, slot 10:00–12:00, yuk, ETA chip |
| 2 | Reys detali | «Reysni boshlash» (GPS yoqadi), navigatsiya (Yandex/Google intent), checklist (hujjat, plomba) |
| 3 | Jonli lokatsiya | Xarita + «Yo'lda» holat, batareya rejimi (Tejamkor/Aniq), uzatilgan nuqtalar soni, offline-navbat |
| 4 | Darvoza (gate) | Katta QR (order+slot+davlat raqami), slot countdown, geofence «Yaqinlashdingiz» banner |
| 5 | Foto-dalil | Kamera: yuk/plomba/tarozi cheki, watermark (vaqt, YS-raqam, koordinata) |
| 6 | Yo'l servislari | Xarita: tarozilar, kemping, ovqat, hostel (konsepsiya §07) |
| 7 | Daromad | Reys yakuni to'lovi, yoqilg'i karta balansi (F3) |
| 8 | Hujjatlar/KYC | Haydovchilik guvohnomasi, texpasport foto, «Tasdiqlangan» belgisi |

### 2.2 Logist (`(logist)`) — tab: Bosh · Terminallar · Buyurtma · Kuzatuv · Profil
| # | Ekran | Widget |
|---|---|---|
| 1 | Bosh | Aktiv buyurtmalar, «Vagoningiz ertaga keladi — slot band qiling» alert (§03) |
| 2 | Terminal katalogi + xarita | Stansiya bo'yicha filtr (ESR kodi), narx/reyting sort, bandlik % |
| 3 | Terminal pasporti | Yo'llar, kran, SVX, ish vaqti, tarif, slot mavjudligi |
| 4 | Buyurtma wizard (3 qadam) | Yo'nalish/operatsiya → yuk/vazn → terminal; narx formulasi ochiq (tarif×vazn+xizmatlar+3 %) |
| 5 | Slot tanlash | 6 ta oynali grid, band/bo'sh, bron 10 daqiqa hold |
| 6 | Buyurtma detali | Timeline: Kutilmoqda→Tasdiqlandi→Yuklanmoqda→Bajarildi, SLA taymer 30 min |
| 7 | Kuzatuv | Vagon dislokatsiyasi (ASOUP F2) + fura nuqtasi xaritada |
| 8 | Hujjatlar | GU-29/SMGS/akt PDF, «Imzolash» (ERI), QR-tekshiruv |
| 9 | TY kod va to'lovlar | Balans, rassrochka grafigi 3/6/12 oy, to'lov |
| 10 | Shahobcha xat | Konstruktor: shahobcha, vagonlar, davr → stansiya boshlig'iga xat; egasining «qarshi emasman» roziligi holati (kontekst §E) |

### 2.3 Terminal egasi (`(terminal)`) — tab: Bugun · Talabnomalar · Slotlar · Darvoza · Ko'proq
| # | Ekran | Widget |
|---|---|---|
| 1 | Bugun | Bandlik %, tushum, bugungi slotlar, SLA buzilish ogohlantirishi |
| 2 | Talabnomalar inbox | Kartada «Qabul / Rad (sabab)» — 30 daqiqalik taymer, push bilan keladi |
| 3 | Slot kalendar | Kun×oyna grid, sig'im tahriri, yopiq kunlar |
| 4 | Darvoza skaneri | Haydovchi QR'ini skanerlaydi → check-in, vagon/fura raqami, foto |
| 5 | Tariflar | Yuk turi × tarif, qo'shimcha xizmatlar narxi |
| 6 | Resurslar | Kran/pogruzchik/brigada slotga biriktirish |
| 7 | Vakansiyalar | E'lon + arizalar |
| 8 | Hisobot | Kunlik/oylik tushum, no-show, demurraj |
| 9 | Reyting/sharhlar | 1–5 yulduz, javob berish |
| 10 | E'lon berish | Bo'sh quvvat/xizmat e'loni, premium joylashuv |

### 2.4 Vagon egasi (`(wagon)`) — tab: Park · E'lonlar · So'rovlar · Daromad
1 Park (vagon ro'yxati, holat, VU-36 muddati) · 2 Vagon kartasi (dislokatsiya, tarix) · 3 Ijara e'loni yaratish/tahrir (tur, dona, narx/oy, stansiya) · 4 So'rovlar inbox (ijara so'rovi → qabul) · 5 Shartnoma (ERI) · 6 Daromad/hisobot · 7 Xarita (park joylashuvi) · 8 Profil.

### 2.5 Deklarant (`(declarant)`) — tab: Navbat · Ishlarim · Daromad · Profil
1 Navbat (yangi buyurtmalar lentasi, 2 soatlik SLA taymer) · 2 Buyurtma detali (yuk, hujjatlar, mijoz) · 3 Hujjat skan (kamera → ko'p sahifali PDF) · 4 Deklaratsiya holati (bosqichlar) · 5 Mijoz bilan xabar (buyurtma ichida) · 6 Eskrou/daromad · 7 Sertifikat verifikatsiyasi · 8 Reyting.

### 2.6 Ekspeditor (`(forwarder)`) — tab: Lenta · Takliflarim · Bitimlar · Profil
1 Ochiq buyurtmalar lentasi (ATI-uslub, yo'nalish/yuk filtri) · 2 Taklif berish (narx, muddat) · 3 Mening takliflarim · 4 Bitimlar (aktiv/yakunlangan) · 5 Tender (yirik hajm, F3) · 6 Hamkorlar (avtotashuvchi/terminal tanlash) · 7 Eskrou/to'lov · 8 KYC.

### 2.7 Lokomotiv xizmati (`(loco)`) — tab: So'rovlar · Kalendar · E'lonim · Profil
1 Manevr so'rovlari inbox (shahobcha, vagon soni, vaqt oynasi) · 2 Smena kalendari · 3 So'rov detali (qabul/rad, narx) · 4 E'lon (TEM2, soat narxi, 24/7) · 5 Loko jurnali (VagonFlow `LocoShift` bilan API orqali) · 6 Daromad · 7 Mashinist profili.

Jami ≈ 60 ekran; MVP (12 hafta) da haydovchi, logist, terminal to'liq, qolgan 4 rol «lite» (inbox + detal + e'lon + profil).

---

## 3. Haydovchi GPS-treking va geofence

**Nima uchun native kerak:** background GPS na PWA, na TMA da yo'q — haydovchi roli yagona majburiy-native rol.

**Arxitektura:**
```
src/tasks/location-task.ts   TaskManager.defineTask('YS_TRACK') — modul darajasida (VagonFlow messaging-background.ts kabi)
src/features/tracking/       startTrip(orderId) / stopTrip(); SQLite `track_points` navbati; batch upload
POST /api/mobile/track/batch { tripId, points:[{lat,lng,acc,spd,ts}] }   10 nuqta yoki 60 s
```
- `Location.startLocationUpdatesAsync('YS_TRACK', { accuracy: Balanced, timeInterval: 30000, distanceInterval: 100, deferredUpdatesInterval: 60000, foregroundService: { notificationTitle: 'YukSaroy — reys davom etmoqda', notificationBody: 'Terminalga ETA 14:20' }, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true })`.
- **Batareya:** tezlik < 3 km/soat 5 daqiqa davom etsa → `timeInterval` 300 s; terminalga 2 km qolganda `accuracy: High`, 10 s. Oddiy ikki rejim (Tejamkor/Aniq) haydovchiga ko'rinadi. Smenada kutilgan sarf: ~4–6 %/soat (Balanced), pilotda o'lchanadi.
- **Ruxsat ketma-ketligi (Play siyosati):** ilova o'rnatilganda hech narsa so'ralmaydi → «Reysni boshlash» bosilganda 1) prominent-disclosure ekrani (nima, nega, qachon) → 2) When-In-Use → 3) Android 10+/iOS «Always» ikkinchi qadam. Play Console'ga background location deklaratsiyasi + 30 soniyalik video (haydovchi reysi) tayyorlanadi; ilova tavsifida «GPS-treking — reys davomida» ochiq yoziladi (VagonFlow PLAY-STORE.md §4 Data safety bo'limi shablon).
- **Android OEM (Xiaomi/Huawei/Oppo/Vivo — O'zbekiston bozorining asosiy qismi):** `expo-device.manufacturer` bo'yicha «Batareya sozlash» wizard: Autostart yoqish, Battery saver «No restrictions», `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (`expo-intent-launcher`), MIUI «Lock app» ko'rsatmasi rasm bilan. Server tomonida watchdog: 10 daqiqa nuqta kelmasa → haydovchiga push «GPS uzildi, ilovani oching» + logistga «Signal yo'q» belgisi.
- **Ma'lum xatolar uchun choralar:** ilova yangilanganda FGS qotishi (expo#47595) — ilova ishga tushganda `isTaskRegisteredAsync` tekshirib, aktiv trip bo'lsa foreground'da qayta start; `MY_PACKAGE_REPLACED` holatida trip'ni «pauza» deb belgilab, keyingi ochilishda tiklash. Pilotda expo-location 2 hafta ichida OEM'larda qoniqarsiz bo'lsa — **alternativa:** `react-native-background-geolocation` (Transistor, pullik litsenziya, OEM-bardosh, Expo config plugin bor).
- **Geofence terminal darvozasi:** `Terminal.gate = {lat, lng, radiusM: 300}` (Prisma). Ilova: `Location.startGeofencingAsync('YS_GEOFENCE', [gate])` → ENTER → lokal «Yetib keldingiz, QR tayyorlang» + `POST /api/mobile/trip/arrived`. Geofence OEM'larda ishonchsiz — shuning uchun **haqiqat manbai darvozadagi QR check-in**, geofence faqat ETA/ogohlantirish. Server track-nuqtalardan ham geofence hisoblaydi (ikki tomonlama). iOS 20 ta region limiti — bir vaqtda faqat joriy reys terminali.

---

## 4. Offline-first, push, deep link, QR, kamera, ERI

**Offline (stansiyalarda internet zaif — konsepsiya §08):** o'qish uchun TanStack Query + `persistQueryClient` (MMKV) — terminal katalogi, buyurtmalar, slotlar 24 soat keshda; yozish uchun `expo-sqlite` + Drizzle jadvallar: `outbox(id, method, path, body, idempotencyKey, createdAt, tries)`, `track_points`, `photos_pending`. NetInfo `isConnected` true bo'lganda outbox ketma-ket yuboriladi, server `Idempotency-Key` sarlavhasi bilan takrorni yutadi; 409 (slot band bo'lib qolgan) → foydalanuvchiga «Slot band, boshqasini tanlang». Nima uchun WatermelonDB emas: ilovada 10k+ yozuv yo'q, sync-server yozish 2–3 hafta; haydovchi/terminal jurnallari kattalashsa (SaaS F3) — o'shanda.

**Push:** `push.ts` VagonFlow'dan ko'chiriladi. Kanallar (Android): `orders` (MAX — tasdiq/rad), `slots` (HIGH — slot 30 daqiqa qoldi), `trip` (DEFAULT — GPS holati), `marketing` (LOW). Backend `DeviceToken` modeli VagonFlow'dagidek (`/api/mobile/devices`). Payload `data.route` — masalan `/(logist)/order/YS-1041`. iOS: APNs FCM orqali, `content-available` faqat «vagon keldi» uchun.

**Deep link:** scheme `yuksaroy://`, universal/app links `https://yuksaroy.uz/o/YS-1041` (buyurtma), `/t/{slug}` (terminal), `/s/{slotId}`, `/l/{letterId}` (xat), `/v/{token}` (QR-tekshiruv). `assetlinks.json` + `apple-app-site-association` `apps/web/public/.well-known/`. Telegram: `t.me/yuksaroy_bot/app?startapp=o_YS1041`.

**QR skaner (hujjat tekshiruv):** `expo-camera` `CameraView` + `barcodeScannerSettings: {barcodeTypes:['qr']}` (expo-barcode-scanner eskirgan). Hujjat QR'i = qisqa imzolangan token (`/v/{jti}`), server `Document.hash`, imzolovchi, holat (amal qiladi/bekor) qaytaradi — oflaynda ham hash ko'rsatiladi, verdikt faqat onlayn. Gate QR — 60 soniyada yangilanadigan TOTP-uslub token (skrinshot bilan aldab bo'lmaydi).

**Kamera (foto-dalil):** `expo-camera` (VagonFlow `photo.ts` faqat galereya — kengaytiriladi), `expo-image-manipulator` 1600 px + 0.8 JPEG, EXIF vaqt/koordinata saqlanadi, watermark server tomonida (bitta joyda, aldash qiyin). Yuklash `presigned PUT` (MinIO/S3), oflaynda `photos_pending`.

**ERI (mobil imzo) — ikki daraja:**
1. *Oddiy elektron imzo* (oferta §01 bo'yicha): SMS/Telegram OTP + `expo-local-authentication` — slot band qilish, talabnoma tasdiqlash, shahobcha egasining «qarshi emasman» roziligi. Tez, SLA'ga mos.
2. *Kuchaytirilgan ERI (E-IMZO)*: shartnoma, stansiya boshlig'iga xat, dalolatnoma. Oqim: server hujjat hash'ini tayyorlaydi → ilova QR ko'rsatadi yoki `Linking.openURL` bilan E-IMZO (ID Karta) ilovasini ochadi → foydalanuvchi PFX/ID-karta bilan imzolaydi → PKCS7 serverga qaytadi → `Document.signatures[]`. **Tekshirish kerak (1-hafta):** E-IMZO mobil app-to-app/deep-link spetsifikatsiyasi e-imzo.uz dasturchi bo'limida — ochiq hujjat topilmadi, UNICON/ITM bilan bevosita so'rov. PFX kalitni **o'z ilovamizda saqlamaymiz** (xavfsizlik + litsenziya).
Alternativa: web'dagi E-IMZO brauzer-kengaytmasi oqimini WebView'da — mobil ilovada ishlamaydi, rad etildi.

---

## 5. Telegram Mini App (TMA)

VagonFlow tajribasi: Telegraf bot OTP yuboradi, `ClientBotSession` mijoz holatini saqlaydi — mijozlar Telegram'da «yashaydi», terminal boshqaruvchilari ham. Shuning uchun TMA — o'rnatishsiz kirish kanali, native ilova — chuqur funksiya.

| Funksiya | Native ilova | TMA | Sabab |
|---|---|---|---|
| Buyurtma holati / timeline | ✓ | ✓ | Faqat o'qish, push o'rniga bot xabari |
| Slot band qilish | ✓ | ✓ | OTP-daraja imzo yetarli |
| Terminal: talabnomani qabul/rad (30 daq SLA) | ✓ | ✓ | Boshqaruvchi Telegram'da tezroq javob beradi |
| Shahobcha xati: rozilik («qarshi emasman») | ✓ | ✓ (OTP) | Egasi ilova o'rnatmagan bo'lishi mumkin |
| Xatni ERI bilan imzolash | ✓ | ✗ | E-IMZO app-to-app TMA ichidan ishonchsiz |
| Haydovchi GPS | ✓ | ✗ | TMA faqat bir martalik `requestLocation` |
| Gate QR / kamera foto-dalil | ✓ | ✗ | Kamera bor, lekin EXIF/oflayn yo'q |
| To'lov (rassrochka) | ✓ | ✓ (web-checkout) | Payme/Click web sahifasi |
| E'lonlar/aktivlar ko'rish | ✓ | ✓ | Share flow bilan tarqaladi |

Texnika: `apps/tma` — Vite + React (Next.js SSR keraksiz), `@telegram-apps/sdk-react`, `packages/ui` komponentlari; `initData` HMAC tekshiruvi backend `POST /api/tma/auth` → oddiy JWT (mobil bilan bir xil). 2026-07-20 origin-himoya sababli TMA faqat `tma.yuksaroy.uz` dan xizmat qiladi. Bot: alohida `@yuksaroy_bot` (VagonFlow botidan ajratilgan — auditoriya boshqa), bir xil Telegraf naqsh.

---

## 6. Chiqarish va yangilanish

- **Google Play:** paket `uz.yuksaroy.app`, EAS `production` → AAB, avval Internal testing (100 tester) → Closed → Production. Background location deklaratsiyasi + video, Data safety (lokatsiya, foto, telefon), prominent disclosure. PLAY-STORE.md kit 80 % qayta ishlatiladi.
- **App Store:** iOS-RELEASE.md bo'yicha; `NSLocationAlwaysAndWhenInUseUsageDescription` matni haydovchi reysi haqida aniq; TestFlight pilot terminallar uchun.
- **Sideload APK (stansiyalar):** 2026-09-30 dan developer verification boshlanadi (hozircha 4 davlat, 2027 global) — tasdiqlanmagan APK 24 soat kutish bilan o'rnatiladi. Qaror: stansiya/terminal xodimlariga **Play Closed testing track** (email ro'yxati, avto-yangilanish, verification muammosi yo'q); APK faqat `preview` profil (EAS internal distribution link + QR) sifatida, Play Console'da tasdiqlangan shu identifikator bilan imzolangan; ADB istisnosi IT-xodim uchun. Huawei (GMS yo'q) qurilmalar bo'lsa — APK + HMS push yo'q, faqat Telegram bot xabari.
- **EAS Update:** kanallar `preview`/`production`, `runtimeVersion: { policy: 'fingerprint' }` (VagonFlow'dagi `appVersion` o'rniga — native o'zgarishni avtomatik aniqlaydi, qo'lda bump unutilmaydi), Hermes bytecode diff bilan 75 % kichik yuklama; `checkAutomatically: ON_LOAD` + ilovada «Yangilanish bor — qayta ishga tushiring» banner; foizli rollout (10 % → 100 %) va bitta buyruq bilan rollback. Ritm: JS-OTA haftada, native build oyda.
- CI: GitHub Actions → `eas build --profile preview --non-interactive` PR'da, `eas update` main'ga merge'da.

---

## 7. Papka daraxti va 12 haftalik reja

```
apps/mobile/
├─ app.config.ts            (VagonFlow naqshi: firebaseEnabled gate, EXPO_PUBLIC_API_URL)
├─ eas.json                 development / preview(apk) / production(aab, autoIncrement)
├─ app/
│  ├─ _layout.tsx           I18nProvider, QueryClient(persist), LockGate, OfflineBanner, push init
│  ├─ (auth)/login.tsx  otp.tsx  role.tsx
│  ├─ (driver)/_layout.tsx  index.tsx  trip/[id].tsx  map.tsx  gate.tsx  photo.tsx  services.tsx  earnings.tsx
│  ├─ (logist)/_layout.tsx  index.tsx  terminals/index.tsx  terminals/[id].tsx  order/new.tsx  order/[id].tsx  slots/[terminalId].tsx  track/[id].tsx  docs/index.tsx  payments.tsx  letter/new.tsx
│  ├─ (terminal)/_layout.tsx  today.tsx  requests/index.tsx  requests/[id].tsx  slots.tsx  gate-scan.tsx  tariffs.tsx  resources.tsx  vacancies.tsx  reports.tsx  reviews.tsx  ads/new.tsx
│  ├─ (wagon)/  (declarant)/  (forwarder)/  (loco)/      (har biri _layout + 4–8 ekran)
│  └─ (common)/notifications.tsx  profile.tsx  settings.tsx  battery-wizard.tsx  verify/[token].tsx
├─ src/
│  ├─ features/{orders,slots,terminals,tracking,gate,photos,docs,payments,letters}/  (hooks + api + ui)
│  ├─ tasks/location-task.ts  geofence-task.ts  messaging-background.ts
│  ├─ db/schema.ts  migrations/  outbox.ts  (drizzle + expo-sqlite)
│  ├─ lib/push.ts  storage.ts  auth-store.ts  camera.ts  esign.ts  deeplinks.ts
│  ├─ components/  (Kit: Card, Pill, SlotGrid, Timeline, QrBadge, MapView)
│  └─ theme.ts     (packages/tokens dan generatsiya)
├─ assets/  icon.png  adaptive-icon.png  splash.png  store/
└─ docs/PLAY-STORE.md  iOS-RELEASE.md  PRIVACY.html
```

| Hafta | Natija | Qabul mezoni |
|---|---|---|
| 1 | Monorepo, `packages/*`, Expo SDK 55 skeleti, OTP auth, rol-switcher, tokens | Telefon+OTP bilan kirish, rol guruhiga yo'nalish |
| 2 | Logist: terminal katalogi + xarita + pasport | ESR stansiya bo'yicha filtr, oflayn kesh |
| 3 | Logist: buyurtma wizard + slot grid + narx; push registratsiya | Slot band qilish, terminalga push keladi |
| 4 | Terminal: Bugun, inbox qabul/rad, slot kalendar, tariflar | 30 daqiqalik SLA taymer, push-dan ochiladi |
| 5 | Haydovchi: reyslar, reys detali, foreground GPS, xarita | Reys nuqtalari serverga batch ketadi |
| 6 | Background GPS + geofence + OEM batareya-wizard + Play deklaratsiya videosi | Xiaomi/Samsung'da 2 soat ekran o'chiq holda uzluksiz nuqta |
| 7 | Gate: haydovchi QR + terminal skaner check-in; foto-dalil + upload | Check-in 5 soniya, foto oflaynda navbatda |
| 8 | Offline outbox (Drizzle), idempotency, hujjatlar PDF ko'rish, QR-tekshiruv | Internet o'chiq holda buyurtma yaratilib, ulanishda sinxron |
| 9 | ERI: OTP-daraja imzo hamma joyda; E-IMZO oqimi (spetsifikatsiya olingach); shahobcha xati konstruktori | Xat PDF + rozilik + stansiyaga yuborish |
| 10 | Vagon egasi / loko / ekspeditor / deklarant «lite» (inbox, detal, e'lon, profil) | Har rol 4 ekran ishlaydi |
| 11 | TMA (`apps/tma`): holat, slot, rozilik; deep/universal links; EAS Update kanallari | `t.me/yuksaroy_bot/app` dan buyurtma ochiladi |
| 12 | Play Internal + TestFlight, Closed track stansiyalar uchun, pilot Sergeli/Toshkent-tovar | 2 terminal, 10 haydovchi, 20 logist real buyurtma |

Jamoa: 2 RN dasturchi (biri VagonFlow mobil muallifi), backend — web-jamoadan umumiy, dizayner 0.5 stavka (tokens + ikon to'plami). Xatarlar: E-IMZO mobil spetsifikatsiyasi kechiksa 9-hafta OTP-daraja bilan chiqadi; expo-location OEM'da yiqilsa 6-haftada Transistor litsenziyasiga o'tiladi (bir hafta rezerv 10-haftadan olinadi).

---

**Manbalar:** [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55) · [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56) · [RN 0.83 blog](https://reactnative.dev/blog/2025/12/10/react-native-0.83) · [Expo New Architecture guide](https://docs.expo.dev/guides/new-architecture/) · [Freezing the Legacy Architecture](https://github.com/reactwg/react-native-new-architecture/discussions/290) · [Flutter release notes](https://docs.flutter.dev/release/release-notes) · [Flutter & Dart 2026 roadmap](https://blog.flutter.dev/flutter-darts-2026-roadmap-89378f17ebbd) · [Telegram Mini Apps](https://core.telegram.org/bots/webapps) · [Bot API changelog](https://core.telegram.org/bots/api-changelog) · [TMA Location Manager](https://docs.telegram-mini-apps.com/packages/tma-js-sdk/features/location-manager) · [Android developer verification (Android Developers Blog)](https://android-developers.googleblog.com/2026/03/android-developer-verification.html) · [24-hour wait for unverified sideload](https://www.techrepublic.com/article/news-google-android-sideloading-24-hour-wait/) · [Play: background location permissions](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en) · [Play: prominent disclosure](https://support.google.com/googleplay/android-developer/answer/11150561?hl=en) · [Android FGS changes](https://developer.android.com/develop/background-work/services/fgs/changes) · [expo-location docs](https://docs.expo.dev/versions/latest/sdk/location/) · [expo/expo#47595](https://github.com/expo/expo/issues/47595) · [SDK 56 location repro](https://github.com/Dylan0115/loc-mre-56) · [Expo monorepos](https://docs.expo.dev/guides/monorepos/) · [expo-sqlite vs WatermelonDB 2026](https://www.pkgpulse.com/guides/expo-sqlite-vs-watermelondb-vs-realm-react-native-local-2026) · [E-IMZO (ID Card) — Google Play](https://play.google.com/store/apps/details?id=uz.yt.idcard.eimzo&hl=en_US) · [e-imzo.uz](https://e-imzo.uz/)
