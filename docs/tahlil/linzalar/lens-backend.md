# YukSaroy — Backend arxitekturasi (Principal Backend Architect lens)

Holat: 2026-09-03. Manba: yuksaroy-context.md (konsepsiya, SLA, demo IA, stansiya-xat talabi), VagonFlow `schema.prisma` (Siding, Station, Client, Request, AuditLog, Notification), 2026 versiyalar — WebSearch (manbalar oxirida).

## 1. Arxitektura uslubi: modulli monolit + alohida worker, VagonFlow'dan ajratilgan servis

**Qaror:** bitta NestJS repozitoriysi, ichida 20 ta bounded-context moduli, ikkita process (`api` va `worker`), bitta Postgres bazasi `yuksaroy`. VagonFlow bilan **DB ulanmaydi**, faqat REST + webhook (HMAC) orqali.

| Variant | Nima uchun yo'q / ha |
|---|---|
| Mikroservislar | 3–5 kishilik jamoa, 20 terminal pilot; tarmoq-chegaralar, saga, 20 ta deploy — ish hajmini 3x oshiradi, foyda 0. Modul chegaralari kodda qat'iy bo'lsa, F4 da `payments` yoki `tracking` ni alohida servisga ko'chirish 1–2 hafta. |
| Next.js Route Handlers only (VagonFlow uslubi) | Eskrou, rassrochka jadvali, docx→pdf generatsiya, E-IMZO server, demurraj taymer, ETA — uzoq ishlaydigan va qayta uriniladigan ishlar. Route Handler'lar request-scoped; worker process baribir kerak bo'ladi, ikkita runtime paydo bo'ladi. Frontend Next.js 16 qoladi (BFF sifatida), lekin biznes-logika NestJS'da. |
| **Modulli monolit (tanlangan)** | Bitta tranzaksiya chegarasi (order + escrow + slot bir `BEGIN…COMMIT`), bitta deploy, modul-import qoidasi `eslint-plugin-boundaries` bilan tekshiriladi. |

**VagonFlow bilan munosabat:** VagonFlow — O'TY ichki tizimi (`taminot.d-railway.uz`, `prisma db push`, enum rename'lar). YukSaroy — tashqi marketpleys, PII va pul. Bitta DB qilinsa: (a) migratsiya siklari bog'lanadi, (b) VagonFlow'dagi `STATION_WORKER` roli marketpleys pul jadvallarini ko'rishi mumkin, (c) audit chegarasi yo'qoladi. Shuning uchun: **alohida servis + API + event'lar**. Event tashuvchi: Kafka emas, **Postgres outbox jadvali → BullMQ** (Redis). Nima uchun: jamoa Kafka'ni boshqarmaydi, hajm kuniga 10 ming event atrofida.

## 2. Stack (2026-09 holati, tekshirilgan)

| Qatlam | Tanlov | Versiya/asos | Alternativa |
|---|---|---|---|
| Runtime | Node.js 24 LTS | 24.12.0 LTS (nodejs.org) | Bun — Prisma 7/E-IMZO kutubxonalari bilan sinovdan o'tmagan |
| Framework | **NestJS 12** + `@nestjs/platform-fastify` | v12.0.0 chiqdi: ESM, Standard Schema (`zod` to'g'ridan `@Body`), `@nestjs/observe` | Fastify sof — DI/modul chegarasi qo'lda; Hono — ekotizim (BullMQ/Swagger modullari) kam |
| ORM | **Prisma 7** | Rust engine yo'q, sof TS/WASM, 9x tez cold start; jamoa Prisma 5.22 biladi | Drizzle 1.0 — SQL-yaqin, 7 KB; hisobotlar uchun `$queryRaw` + SQL fayllar yetadi |
| DB | Postgres 18 | 18.6 (2026-08-13): `uuidv7()`, AIO, skip-scan | 17 — VagonFlow bilan bir xil, ham bo'ladi; 18 da `uuidv7()` ID uchun tayyor |
| Navbat | BullMQ 6.2 + Valkey/Redis 8 | 6.2.0 (2026-08-21) `IQueueBackend`, Postgres backend ham bor | BullMQ Postgres backend — 2 hafta eski, pilotdan keyin; Redis baribir rate-limit, E-IMZO-server holati uchun kerak |
| Fayl | MinIO (S3 API) | O'zR ichida turishi kerak (9-bo'lim) | Cloudflare R2 — PII hujjatlar chet elda, yo'q |
| Qidiruv | Postgres FTS + `pg_trgm` (MVP) → Meilisearch 1.53 (F3) | Katalog 200 terminal, 18 428 mijoz — FTS yetadi; e'lonlar/vakansiya 100k+ bo'lganda Meili | Elasticsearch — RAM 4 GB+, ortiqcha |
| Hujjat | `docx-templates` + LibreOffice headless (pdf) + `pdf-lib` (QR) | GU-29/SMGS shablonlari .docx da mavjud | Puppeteer HTML→PDF — blanka aniqligi past |
| Validatsiya | zod 4 (Standard Schema) | frontend bilan bitta sxema paketi `@yuksaroy/contracts` | class-validator — ikki marta yozish |
| Test | Vitest + Testcontainers (Postgres) | NestJS 12 Jest'dan Vitest'ga o'tdi | — |

## 3. Domen modullari (bounded context)

| Modul | Mas'uliyat | Asosiy entitylar | Tashqi bog'liqlik |
|---|---|---|---|
| `identity` | Telefon+OTP, JWT, rollar, korxona (Organization), KYC, STIR tekshiruv, qurilma | User, Organization, Membership(role, scope), KycCheck, Session, Device | Eskiz SMS, soliq.uz/IIP STIR, OneID (F2), 18 428 reestr importi |
| `catalog` | Terminal pasporti, xizmatlar, tarif versiyalari (`valid_from`), rating agregati | Terminal, TerminalService, TariffVersion, TariffLine, StationRef (ESR), Review | VagonFlow Station (ESR kod sinxron), MinIO (foto) |
| `booking` | Slot sig'imi (terminal × kun × 2 soatlik oyna × resurs), band qilish, no-show | SlotTemplate, Slot(capacity, held, booked), Hold(ttl 10 min), Booking | Redis (hold TTL), `orders` |
| `orders` | Yuklash / tushirish / bo'sh vagon buyurtmasi, state machine, VagonFlow talabnomasi bog'i | Order(kind), OrderLine, OrderEvent, WagonRef(wagonNo), ExtraService | `booking`, `pricing`, `payments`, VagonFlow adapter |
| `pricing` | Kalkulyator: `tarif × vazn + extras + 3%`; formulani versiyalash | PriceQuote(frozen 30 min), FeeRule(platform 3%), Promo | `catalog.TariffVersion` |
| `payments` | Payme/Click/Uzum, eskrou hisob (ledger), to'lov agenti (ELS), rassrochka 3/6/12 | LedgerAccount, LedgerEntry(double-entry), PaymentIntent, Escrow, Payout, Installment, InstallmentSchedule, ElsTopUp | Payme Merchant JSON-RPC, Click Merchant API, Uzum Bank API, bank (ELS o'tkazma — qo'lda/1C eksport MVP) |
| `documents` | GU-29, SMGS, GU-12, dalolatnoma, hisob-faktura: shablon → docx → pdf, ERI, QR | DocTemplate(ver), Document(status), Signature(pkcs7, tsa), QrToken | LibreOffice, E-IMZO server, MinIO, Didox/Faktura (EDO) F3 |
| `station-letters` | Shahobcha yo'lga vagon qo'yish xati: konstruktor → egasi roziligi → stansiya → ruxsat → DSP topshirig'i | Letter, LetterWagon, Consent, Permit(no), DspTask | `documents`, `assets` (Siding), VagonFlow (Siding, Station, DispatchTask), E-IMZO |
| `assets` | Vagon/tepplovoz/shahobcha ijara-sotuv e'lonlari, bitim | Asset(kind), AssetListing(mode), Deal, Siding(mirror, railmapId) | VagonFlow Siding reestri (railmapId/registryRef), `payments` (eskrou) |
| `specialists` | Ekspeditor/deklarant profili, buyurtmaga biriktirish, vakansiyalar | SpecialistProfile, Credential, Engagement, Vacancy, Application | `identity` KYC, `payments` eskrou |
| `ty-code` | TY kod arizasi, hujjat cheklisti, holat | CodeApplication, ChecklistItem, CodeAssignment | O'TY bo'limi (F1 operator, F2 API yo'q — 8-bo'lim) |
| `tracking` | Vagon dislokatsiya, ETA, fura GPS, geofence | WagonPosition, Eta, VehicleTrack(point), Geofence | ASOUP (yo'q → operator/mijoz kiritadi), fura ilovasi GPS |
| `ads` | Pulli e'lonlar, premium joylashuv | Ad, AdPlacement, AdInvoice | `payments` |
| `reference` | Portlar, tarozilar, yo'l servislari, stansiyalar (ESR), ETSNG yuk kodlari | Port, Scale, RoadService, Station, CargoCode | xlsx import (Desktop'dagi fayllar) |
| `notifications` | Kanal-tanlash, shablon, retry, o'qilganlik | NotificationTemplate, Notification, Delivery(channel, status) | Eskiz, Telegram (Telegraf), FCM, SMTP |
| `analytics` | Terminal reyting, yuklama, oqimlar, mijoz oylik hisoboti | MaterializedView'lar, ReportJob, ReportFile | Postgres read replica, MinIO |
| `disputes` | Da'vo, dalil, arbitraj, eskroudan qoplash (3 kun SLA) | Dispute, Evidence, Ruling | `payments`, `notifications` |
| `audit` | Har o'zgarish: kim/qachon/nima; hash-chain | AuditEvent(prev_hash) | — |
| `integrations` | Adapter interfeyslari + fallback (8-bo'lim) | OutboxEvent, WebhookEndpoint, WebhookDelivery, InboundEvent(dedupe) | VagonFlow, ASOUP, E-IMZO, to'lovlar |
| `admin` | Operator kabineti, KYC tasdiqlash, moderatsiya, feature flag | AdminAction, FeatureFlag | `audit` |

Modul-import qoidasi: modul faqat boshqa modulning `public/` (service interfeysi + DTO) qismini import qiladi; entity/repo import — lint xato.

## 4. API dizayni

- Prefiks `/api/v1`, versiya URL'da (header-versiya proksi/CDN'da ko'rinmaydi). Buzuvchi o'zgarish → `/v2`, eskisi 6 oy.
- Xatolik: RFC 9457 `application/problem+json`: `{type, title, status, detail, instance, code:"ORDER_SLOT_TAKEN", errors:[{path,message}]}`.
- `Idempotency-Key` (UUID) — barcha POST'larda pul, band qilish, xat yuborish; 24 soat Redis'da javob keshi; bir xil kalit + boshqa body → 422.
- Pagination: cursor (`?cursor=…&limit=50`), javob `{data, next_cursor}`; offset faqat admin jadvallarida.
- OpenAPI 3.1 `@nestjs/swagger` dan avtomatik; `@yuksaroy/contracts` paketi zod sxemalardan; frontend `openapi-typescript` bilan tiplarni oladi.
- Optimistic lock: `If-Match: <version>` slot/tarif/xat tahririda.

**Endpointlar (65):**

| Modul | Endpointlar |
|---|---|
| identity | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `POST /auth/logout`, `GET /me`, `PATCH /me`, `GET /me/sessions`, `DELETE /me/sessions/{id}`, `POST /orgs`, `POST /orgs/{id}/kyc/stir`, `GET /orgs/{id}/members`, `POST /orgs/{id}/members`, `POST /admin/auth/totp/enable` |
| catalog | `GET /terminals` (filtr: station, service, region, sort=rating/price), `GET /terminals/{id}`, `PATCH /terminals/{id}`, `GET /terminals/{id}/tariffs`, `POST /terminals/{id}/tariffs` (yangi versiya), `GET /terminals/{id}/reviews`, `POST /orders/{id}/review` |
| booking | `GET /terminals/{id}/slots?date=`, `POST /slots/{id}/hold`, `DELETE /holds/{id}`, `POST /terminals/{id}/slot-templates` |
| orders | `POST /orders`, `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/submit`, `POST /orders/{id}/confirm`, `POST /orders/{id}/reject`, `POST /orders/{id}/cancel`, `POST /orders/{id}/events` (terminal: arrived/weighed/loaded/done), `GET /orders/{id}/timeline`, `POST /orders/{id}/extras` |
| pricing | `POST /quotes`, `GET /quotes/{id}` |
| payments | `POST /payments/intents`, `GET /payments/intents/{id}`, `POST /payments/webhooks/payme` (JSON-RPC), `POST /payments/webhooks/click`, `POST /payments/webhooks/uzum`, `GET /wallet`, `GET /wallet/entries`, `POST /escrow/{orderId}/release`, `POST /installments/apply`, `GET /installments/{id}/schedule`, `POST /els/topups`, `GET /payouts` |
| documents | `POST /documents` (type, orderId), `GET /documents/{id}`, `GET /documents/{id}/file`, `POST /documents/{id}/sign` (pkcs7), `GET /verify/{qrToken}` (public), `GET /document-types` |
| station-letters | `POST /letters`, `PATCH /letters/{id}`, `POST /letters/{id}/preview` (pdf), `POST /letters/{id}/request-consent`, `POST /letters/{id}/consent` (shahobcha egasi), `POST /letters/{id}/submit`, `POST /letters/{id}/decide` (stansiya: permit_no/reject), `GET /letters/{id}/permit.pdf`, `GET /station/letters` (stansiya kabineti), `POST /letters/{id}/dsp-ack` |
| assets | `GET /assets`, `POST /assets`, `GET /assets/{id}`, `GET /sidings/map` (GeoJSON), `POST /assets/{id}/deals` |
| specialists | `GET /specialists`, `POST /orders/{id}/engagements`, `GET /vacancies`, `POST /vacancies`, `POST /vacancies/{id}/apply` |
| ty-code | `POST /ty-code/applications`, `GET /ty-code/applications/{id}`, `POST /ty-code/applications/{id}/documents` |
| tracking | `GET /wagons/{no}/position`, `POST /tracking/positions` (fura ilovasi, batch), `GET /orders/{id}/eta` |
| ads | `POST /ads`, `GET /ads`, `POST /ads/{id}/promote` |
| notifications | `GET /notifications`, `POST /notifications/{id}/read`, `POST /devices` (FCM token) |
| analytics | `GET /analytics/terminals/{id}/load`, `GET /analytics/ranking`, `POST /reports` |
| disputes | `POST /disputes`, `POST /disputes/{id}/evidence`, `POST /disputes/{id}/ruling` |
| integrations | `POST /webhooks/vagonflow` (inbound), `GET /admin/outbox` |

**Webhook'lar (chiquvchi, terminal SaaS va 1C mijozlar uchun):** `order.confirmed`, `order.completed`, `slot.released`, `payment.captured`, `escrow.released`, `document.signed`, `letter.permitted`, `dispute.opened`. Format: `{id, type, occurred_at, data}`; `X-YS-Signature: sha256=HMAC(secret, timestamp.body)`; 3 urinish (1m/10m/1h); 5 xato ketma-ket → endpoint `paused`.

**VagonFlow integratsiya kontrakti (F1→F3):**

| Yo'nalish | Endpoint | Auth | Payload / event |
|---|---|---|---|
| YS → VF | `POST /api/integrations/yuksaroy/requests` (VF'da yangi route) | mTLS yoki `Authorization: Bearer <service-jwt>` (RS256, `aud: vagonflow`) | `{externalRef: orderId, stationEcp, clientInn, businessDate, requiredWagons, wagonType, ownership, cargoType, direction, destinationStationEcp}` → `{vfRequestId}` |
| VF → YS | `POST /api/v1/webhooks/vagonflow` | HMAC-SHA256, `X-VF-Event-Id` (dedupe, `InboundEvent` unique) | `request.status_changed {vfRequestId, status: PENDING/APPROVED/REJECTED/ACTIVE/DELIVERED, lifecycleStage, providedWagons}`, `wagon.assigned {wagonNo}`, `wagon.placed_for_loading {at}`, `dispatch.done` |
| YS ← VF | `GET /api/integrations/yuksaroy/stations`, `/sidings?stationEcp=` | service-jwt | Siding: `id, railmapId, name, ownerName, lengthM, capacityWagons, occupiedWagons, contractState, usageType, locoType` — YS `assets.Siding` ko'zgusi, kunlik sinxron |
| YS → VF | `POST /api/integrations/yuksaroy/dispatch-tasks` | service-jwt | Letter permit → DSP topshirig'i: `{stationEcp, sidingId, wagonNos[], periodFrom, periodTo, permitNo, letterPdfUrl}` |

Xaritalash: YS `Order.vfRequestId`, VF `Request.externalRef` (yangi ustun, nullable). VagonFlow tarafida 3 ta route + 1 ustun — minimal o'zgarish.

## 5. Auth

- **Kirish:** `+998` telefon + 6 xonali OTP (Eskiz), 5 daqiqa, 3 urinish, IP+telefon bo'yicha 5/soat. Reestrdagi 18 338 STIR'li mijoz — birinchi kirishda `Organization` avto-yaratiladi, STIR tasdiqlash so'raladi.
- **Token:** access JWT 15 daqiqa (RS256, `jose`), refresh 30 kun — `Session` jadvalida hash, rotation (eski refresh qayta ishlatilsa — butun oila bekor). Claims: `sub, org, roles[], scopes[], sv` (session version — VagonFlow'dagi `terminalRegVersion` g'oyasi: stansiya "qurilmalarni bekor qilish" bossa `sv++`).
- **RBAC:** rollar `SHIPPER, LOGIST, FORWARDER, DECLARANT, TERMINAL_OWNER, TERMINAL_STAFF, WAGON_OWNER, SIDING_OWNER, CARRIER, DRIVER, LOCO_SERVICE, STATION_DS, STATION_DSP, PLATFORM_OPERATOR, ARBITER, ADMIN`. Bitta User → ko'p `Membership(orgId, role)`.
- **ABAC (scope):** `Membership.scope = {stationEcp?[], terminalId?[], orgId}`; CASL qoidalari: `STATION_DS` faqat `letter.stationEcp ∈ scope.stationEcp`; `TERMINAL_STAFF` faqat o'z `terminalId` buyurtmalari; `SIDING_OWNER` faqat o'z `Siding.ownerOrgId`. Bo'sh scope = hech narsa (fail-closed, VagonFlow CONSIGNEE qoidasi).
- **Qurilma/sessiya:** `GET /me/sessions` (device, IP, last_seen), bittalab yoki hammasini o'chirish; yangi qurilmadan kirish → SMS xabar.
- **Admin 2FA:** `PLATFORM_OPERATOR/ARBITER/ADMIN` — TOTP majburiy (`otplib`), pul/eskrou amallari uchun qo'shimcha step-up (TOTP qayta, 5 daqiqa).
- **Servis-to-servis:** VagonFlow ↔ YS — RS256 service-jwt, `aud`, 5 daqiqalik, JWKS `/.well-known/jwks.json`.

## 6. State machine'lar

**Order** (`orders.kind ∈ LOAD | UNLOAD | EMPTY_WAGON`):

| Dan | Hodisa | Ga | Yon ta'sir |
|---|---|---|---|
| DRAFT | submit (quote + hold) | PENDING_TERMINAL | terminalga push, 30 min taymer |
| PENDING_TERMINAL | terminal confirm | CONFIRMED | hold→booking, `PaymentIntent` (eskrou) yaratish, VF talabnoma (LOAD/EMPTY) |
| PENDING_TERMINAL | reject / 30 min timeout | REJECTED | hold bo'shatiladi, reyting −, mijozga alternativ terminal |
| CONFIRMED | payment captured | PAID_ESCROW | — |
| PAID_ESCROW | wagon arrived (VF webhook yoki qo'lda) | IN_PROGRESS | demurraj taymer start |
| IN_PROGRESS | loaded/unloaded + weighed | COMPLETED_BY_TERMINAL | dalolatnoma avto, 48 soat mijoz tasdiq taymeri |
| COMPLETED_BY_TERMINAL | mijoz accept / 48 soat sukut | COMPLETED | eskrou release, 3% komissiya ledger, review so'rovi |
| COMPLETED_BY_TERMINAL | mijoz dispute | DISPUTED | eskrou muzlaydi |
| DISPUTED | ruling | COMPLETED / REFUNDED | ledger yozuvlari |
| DRAFT/PENDING/CONFIRMED | cancel | CANCELLED | CONFIRMED'dan keyin slot-fee ushlanadi |

**Slot:** `OPEN → HELD (10 min TTL) → BOOKED → ARRIVED → DONE`; `HELD → OPEN` (TTL), `BOOKED → NO_SHOW` (slot oxiri + 60 min, `arrived` yo'q) → slot-fee ushlanadi, terminal reytingiga ta'sir qilmaydi.

**Payment / Escrow:**

| Dan | Hodisa | Ga |
|---|---|---|
| INTENT_CREATED | provayder `CheckPerformTransaction` OK | AUTHORIZED |
| AUTHORIZED | `PerformTransaction` | CAPTURED_ESCROW (ledger: mijoz → eskrou) |
| CAPTURED_ESCROW | order COMPLETED | RELEASED (eskrou → terminal 97%, platforma 3%) |
| CAPTURED_ESCROW | dispute ruling refund | REFUNDED (`CancelTransaction`) |
| CAPTURED_ESCROW | partial ruling | PARTIAL (ikki yozuv) |
| RELEASED | payout bank/1C eksport | PAID_OUT |

Rassrochka: `Installment: APPLIED → APPROVED(limit) → DISBURSED (platforma ELS'ga to'ladi) → ACTIVE → CLOSED | OVERDUE (7 kun) → LIMIT_BLOCKED (30 kun)`. Jadval `InstallmentSchedule(n, due_date, amount, paid_at)`; ustama 3/6/12 oy → 4/8/14 % `FeeRule` da, koddan tashqarida.

**Letter / Permit (shahobcha yo'lga vagon qo'yish xati):**

| Dan | Hodisa | Ga | Kim |
|---|---|---|---|
| DRAFT | konstruktor to'ldirildi (siding, org, STIR, yuk, vagonlar[], davr) | READY | mijoz |
| READY | request-consent | AWAITING_OWNER | tizim → shahobcha egasiga push/SMS/Telegram |
| AWAITING_OWNER | consent (ERI yoki OTP) | OWNER_CONSENTED | SIDING_OWNER |
| AWAITING_OWNER | decline / 48 soat | OWNER_DECLINED | egasi / taymer |
| OWNER_CONSENTED | mijoz ERI bilan imzolaydi, submit | SUBMITTED_TO_STATION | mijoz; pdf + QR generatsiya, stansiya kabinetiga |
| SUBMITTED_TO_STATION | DS `decide(permit)` | PERMITTED | STATION_DS; `permitNo = "{ESR}-{YYYY}-{seq}"`, VF DispatchTask |
| SUBMITTED_TO_STATION | DS reject (sabab) / 3 ish kuni | RETURNED / ESCALATED | DS / taymer → PLATFORM_OPERATOR |
| PERMITTED | DSP `dsp-ack` | IN_EFFECT | STATION_DSP |
| IN_EFFECT | `periodTo` o'tdi | EXPIRED | taymer |
| PERMITTED / IN_EFFECT | revoke | REVOKED | DS |

**Dispute:** `OPENED → EVIDENCE (72 soat) → UNDER_REVIEW → RULED(full/partial/none) → CLOSED`; `RULED → APPEALED` (1 marta) → `CLOSED`.

## 7. Fon ishlari (BullMQ)

| Queue | Job | Trigger | Retry/cheklov |
|---|---|---|---|
| `booking` | `hold.expire` | delayed 10 min | Redis TTL + job, ikkalasi ham |
| `booking` | `slot.remind` | slot − 24h, − 2h (mijoz, terminal) | 3 |
| `booking` | `slot.noShowCheck` | slot end + 60 min | 3 |
| `orders` | `terminal.confirmTimeout` | submit + 30 min | 1 |
| `orders` | `order.autoAccept` | completed_by_terminal + 48h | 1 |
| `orders` | `demurrage.tick` | cron `*/15 * * * *`, IN_PROGRESS uchun soat hisoblash, chegara → xabar | — |
| `tracking` | `eta.recompute` | position kirdi / cron 30 min | — |
| `payments` | `payment.reconcile` | cron `0 */1 * * *` — provayder `GetStatement` bilan solishtirish | 5 |
| `payments` | `installment.due` | cron `0 9 * * *` — 3 kun oldin eslatma, muddat, overdue, limit blok | — |
| `payments` | `payout.batch` | cron `0 6 * * 1-5` — RELEASED → bank fayli (1C/ELS) | — |
| `documents` | `doc.render` | document yaratildi | 3, concurrency 2 (LibreOffice) |
| `documents` | `doc.tsa` | sign qabul qilindi → `/frontend/timestamp/pkcs7` | 5 |
| `letters` | `letter.ownerTimeout`, `letter.stationTimeout`, `letter.expire` | delayed | 1 |
| `notify` | `notify.send` | har event; kanal fallback push → Telegram → SMS | 5, exp backoff |
| `integrations` | `outbox.relay` | cron 5 s, `OutboxEvent WHERE sent_at IS NULL` | at-least-once |
| `integrations` | `webhook.deliver` | outbox | 3, keyin `paused` |
| `integrations` | `vf.sidingSync` | cron `0 3 * * *` | 3 |
| `analytics` | `report.monthly` | cron `0 5 1 * *`, `REFRESH MATERIALIZED VIEW CONCURRENTLY` | 2 |
| `identity` | `kyc.stirRefresh` | cron haftalik | 3 |

`worker` process alohida `main.worker.ts`; bitta queue-per-modul; `QueueScheduler` o'rniga BullMQ 6 delayed job'lari.

## 8. Integratsiya adapterlari (interfeys + fallback)

| Tizim | 2026 real holat (manba) | Interfeys | Fallback |
|---|---|---|---|
| ASOUP / O'TY dislokatsiya | Ochiq API yo'q; EBRD €38.4 mln kredit UTY dasturiy ta'minotiga (2026-06) — kelajakda | `WagonLocationProvider.get(wagonNo): {stationEcp, at, source}` | `ManualLocationProvider` (operator/mijoz kiritadi, VF `wagon.placed_for_loading` webhook), `source: MANUAL/VAGONFLOW/ASOUP` |
| E-IMZO | E-IMZO-SERVER (Java, `vpn.e-imzo.uz:3443`), `/frontend/challenge`, `/backend/auth`, `/backend/pkcs7/verify/attached`, `/frontend/timestamp/pkcs7`, mobil ID-card deeplink (qo0p/e-imzo-doc) | `SignatureVerifier.verifyAttached(pkcs7): {ok, subject{tin, cn}, tsa}` | `OtpConsentProvider` — ERI yo'q kichik mijoz uchun SMS-OTP rozilik (huquqiy kuchi past, `Signature.level = OTP`), ERI keyin qo'shiladi |
| Payme | Merchant API JSON-RPC 2.0: `CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction, GetStatement` | `PaymentProvider.createIntent/refund/statement` | 3 provayder — biri yiqilsa boshqasi; oflayn: bank o'tkazma + operator `manual.capture` |
| Click | Shop API (Prepare/Complete) + Merchant API | ↑ | ↑ |
| Uzum Bank | developer.uzumbank.uz: kartadan to'lov, refund, status, fiskalizatsiya | ↑ | ↑ |
| Eskiz SMS | `notify.eskiz.uz`, token (30 kun), 50 so'm/SMS | `SmsProvider.send(phone, text, templateId)` | Play Mobile ikkinchi provayder; SMS o'tmasa Telegram |
| Telegram | Telegraf (VagonFlow'da bor) | `ChatProvider.send(chatId, msg, buttons)` | push/SMS |
| FCM | firebase-admin (VagonFlow `DeviceToken`) | `PushProvider.send(tokens[], payload)` | Telegram |
| soliq.uz STIR | Ochiq REST API yo'q; my.gov.uz `search-tin` foydalanuvchi uchun; korxona ma'lumoti — IIP (idoralararo integratsiya platformasi) shartnoma orqali | `CompanyRegistry.lookup(stir): {name, address, status}` | Reestr importi (18 338 STIR) + operator tasdig'i; STIR checksum lokal |
| OneID (`id.egov.uz`) | OAuth2 (`authorization_code`), JSHSHIR qaytaradi | `IdentityProvider` | Telefon+OTP asosiy, OneID F2 ixtiyoriy |
| 1C / EDO (Didox, Faktura) | Hisob-faktura EDO orqali (ЭТТН/ЭСФ amaliyoti) | `EdoProvider.sendInvoice` | xlsx/xml eksport, `GET /reports` |

Har adapter `integrations/<name>/` ichida: `*.provider.ts` (interfeys), `*.adapter.ts`, `*.fake.ts` (test/pilot), `*.health.ts`; `INTEGRATION_MODE=fake|live` env.

## 9. Xavfsizlik

- **Qonun:** "Shaxsga doir ma'lumotlar to'g'risida" ЗРУ-547 (2019), lokalizatsiya 2021-04-16; 2026-03-27 o'zgarish — ko'p PII chetda saqlanishi mumkin, biometrik va telekom ma'lumot O'zR'da qoladi (kun.uz, Dentons). Baza reestrga ro'yxatdan o'tkaziladi (Davlat personallashtirish markazi, 15 kun). **Qaror:** Postgres + MinIO + Redis O'zR data-markazida (UzCloud/ahost), backup ham O'zR; CDN faqat statik. Pasport skanlari — alohida bucket, `aes-256` SSE, 30 kun keyin faqat KYC natijasi qoladi.
- **OWASP:** zod validatsiya chegarada; Prisma parametrlangan; `helmet`; CORS oq ro'yxat; CSRF — cookie-refresh uchun `SameSite=Strict` + double-submit; SSRF — webhook URL'lar faqat https, private IP taqiq; fayl yuklash — MIME sniff, 20 MB, ClamAV (F2).
- **PII minimallashtirish:** telefon/STIR jadvalda `pgcrypto pgp_sym_encrypt` emas — indekslash kerak; o'rniga: shifrlangan disk + alohida `pii` sxema, `SELECT` huquqi faqat `app` roliga, loglarda maskalash (`+99890***0101`).
- **Audit-log:** `AuditEvent(id uuidv7, at, actor_id, actor_role, org_id, action, entity, entity_id, before jsonb, after jsonb, ip, ua, prev_hash, hash)`; `hash = sha256(prev_hash || row)`; jadval `INSERT`-only (trigger UPDATE/DELETE taqiqlaydi); oylik `pg_partman` partition; 5 yil saqlash.
- **Rate limit:** `@nestjs/throttler` + Redis: OTP 5/soat/telefon, umumiy 600/min/IP, webhook 60/min/endpoint, quote 60/min/user.
- **Sirlar:** `.env` prod'da yo'q — Docker secrets / `sops` + age; JWT kalitlari 90 kunda rotatsiya (`kid`); Payme/Click kalitlari faqat `payments` moduliga inject.
- **Pul yaxlitligi:** double-entry ledger, `SUM(debit)=SUM(credit)` constraint tekshiruvi kunlik; summalar `bigint` tiyin/so'm, `float` taqiq.

## 10. Papka daraxti va modul skeleti

```
yuksaroy/
├─ apps/
│  ├─ api/                      # NestJS 12 (Fastify)
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ main.worker.ts      # BullMQ worker entry
│  │  │  ├─ app.module.ts
│  │  │  ├─ common/
│  │  │  │  ├─ problem-json.filter.ts
│  │  │  │  ├─ idempotency.interceptor.ts
│  │  │  │  ├─ cursor-pagination.ts
│  │  │  │  ├─ money.ts          # bigint so'm helpers
│  │  │  │  └─ abac/ (casl.ability.ts, policies.guard.ts)
│  │  │  ├─ infra/
│  │  │  │  ├─ prisma/ (prisma.service.ts, tx.decorator.ts)
│  │  │  │  ├─ redis/
│  │  │  │  ├─ bullmq/ (queues.ts, worker.factory.ts)
│  │  │  │  ├─ storage/ (s3.service.ts)
│  │  │  │  ├─ outbox/ (outbox.service.ts, relay.job.ts)
│  │  │  │  └─ telemetry/ (otel.ts, logger.ts, metrics.ts)
│  │  │  └─ modules/
│  │  │     ├─ identity/
│  │  │     ├─ catalog/
│  │  │     ├─ booking/
│  │  │     ├─ orders/
│  │  │     ├─ pricing/
│  │  │     ├─ payments/
│  │  │     │  ├─ providers/ (payme/, click/, uzum/)
│  │  │     │  ├─ ledger/
│  │  │     │  ├─ escrow/
│  │  │     │  └─ installments/
│  │  │     ├─ documents/
│  │  │     │  ├─ templates/ (gu29.docx, smgs.docx, gu12.docx, akt.docx, invoice.docx, letter-station.docx)
│  │  │     │  ├─ render/ (docx.renderer.ts, pdf.converter.ts, qr.ts)
│  │  │     │  └─ signing/ (eimzo.client.ts, verifier.ts)
│  │  │     ├─ station-letters/          # ↓ skelet quyida
│  │  │     ├─ assets/
│  │  │     ├─ specialists/
│  │  │     ├─ ty-code/
│  │  │     ├─ tracking/
│  │  │     ├─ ads/
│  │  │     ├─ reference/
│  │  │     ├─ notifications/ (channels/: sms.eskiz.ts, telegram.ts, fcm.ts, email.ts)
│  │  │     ├─ analytics/ (sql/*.sql, views.migration.ts)
│  │  │     ├─ disputes/
│  │  │     ├─ audit/
│  │  │     ├─ integrations/ (vagonflow/, asoup/, stir/, oneid/, edo/, webhooks/)
│  │  │     └─ admin/
│  │  ├─ prisma/ (schema/ *.prisma per-module, migrations/)
│  │  ├─ test/ (e2e/, testcontainers.setup.ts)
│  │  └─ Dockerfile
│  ├─ web/                      # Next.js 16 + React 19 (BFF, SSR)
│  ├─ bot/                      # Telegraf (VagonFlow'dan ko'chma)
│  └─ mobile/                   # Expo (F2)
├─ packages/
│  ├─ contracts/                # zod sxemalar + OpenAPI-dan tiplar
│  ├─ ui/                       # dizayn-tizim
│  └─ config/ (eslint-boundaries, tsconfig)
├─ infra/
│  ├─ docker-compose.yml        # postgres18, valkey, minio, eimzo-server, libreoffice, api, worker, web, bot, nginx
│  ├─ nginx/
│  ├─ otel-collector.yaml
│  └─ backup/ (pgbackrest.conf)
├─ docs/ (adr/, openapi.json, state-machines.md)
└─ turbo.json · pnpm-workspace.yaml
```

**`station-letters` moduli fayl ro'yxati:**

```
station-letters/
├─ station-letters.module.ts
├─ public/ (station-letters.api.ts — interfeys, letter.dto.ts, events.ts: LetterPermitted, LetterRevoked)
├─ http/
│  ├─ letters.controller.ts         # POST/PATCH /letters, preview, request-consent, submit
│  ├─ consent.controller.ts         # POST /letters/{id}/consent (SIDING_OWNER)
│  ├─ station.controller.ts         # GET /station/letters, POST decide, dsp-ack (STATION_DS/DSP)
│  └─ schemas.ts                    # zod: CreateLetter{sidingId, orgId, cargoCode, wagonNos[], periodFrom, periodTo}
├─ domain/
│  ├─ letter.state.ts               # 6-bo'lim jadvali kod holida (xstate emas — oddiy Map<from, Map<event,to>>)
│  ├─ letter.entity.ts
│  ├─ permit-number.ts              # "{ESR}-{YYYY}-{seq}", seq — Postgres sequence per station
│  └─ wagon-no.validator.ts         # 8 xonali + nazorat raqami
├─ app/
│  ├─ create-letter.usecase.ts
│  ├─ request-consent.usecase.ts
│  ├─ give-consent.usecase.ts       # ERI pkcs7 → documents.verifier, yoki OTP
│  ├─ submit-letter.usecase.ts      # pdf render + QR + stansiya inbox
│  ├─ decide.usecase.ts             # permit → outbox: LetterPermitted → VF DispatchTask
│  └─ expire-letter.usecase.ts
├─ infra/
│  ├─ letter.repository.ts
│  └─ letter.jobs.ts                # ownerTimeout, stationTimeout, expire
└─ __tests__/ (letter.state.test.ts, submit-letter.e2e.test.ts)
```

## 11. Kuzatuv

- **OpenTelemetry:** `@nestjs/observe` (NestJS 12 o'rnatilgan) + `@opentelemetry/sdk-node`, Fastify/Prisma/BullMQ/ioredis instrumentatsiyasi; `traceparent` VagonFlow'ga ham uzatiladi (VF Next.js'da `@vercel/otel`). Collector → Grafana Tempo (trace), Loki (log), Prometheus (metrika); hammasi `infra/docker-compose.yml` da, O'zR serverida.
- **Loglar:** `pino` JSON, `req_id`, `org_id`, `user_id` (hashed), PII maskalash; 30 kun Loki, audit — Postgres (9-bo'lim).
- **Metrikalar (RED + biznes):** `http_request_duration_seconds{route,status}`, `bullmq_job_duration{queue}`, `bullmq_failed_total`, `outbox_lag_seconds`, `orders_by_state`, `slot_hold_conversion_ratio`, `terminal_confirm_seconds` (SLA 30 min), `payment_webhook_lag`, `escrow_balance_sum`, `letter_station_decision_seconds` (SLA 3 kun), `eimzo_verify_errors_total`.
- **Alert (Grafana):** p95 API > 800 ms 5 min; `bullmq_failed_total` > 10/5 min; `outbox_lag_seconds` > 60; Payme/Click webhook 0 ta 2 soat ish vaqtida; ledger balans tekshiruvi xato → PagerDuty/Telegram darhol; `escrow` release'siz 72 soat; disk MinIO 80 %.
- **Health:** `GET /health/live`, `/health/ready` (Postgres, Redis, MinIO, E-IMZO-server ping, VF `/api/health`).

## Manbalar

- NestJS 12: https://trilon.io/blog/nestjs-12-is-now-available , https://github.com/nestjs/nest/releases/tag/v12.0.0 , https://www.infoq.com/news/2026/04/nestjs-12-roadmap-esm/
- Node.js 24 LTS: https://nodejs.org/en/blog/release/v24.12.0
- Prisma 7 vs Drizzle: https://makerkit.dev/blog/tutorials/drizzle-vs-prisma , https://techsy.io/en/blog/prisma-vs-drizzle-orm
- Postgres 18.6: https://www.postgresql.org/docs/release/18.0/ , https://www.postgresql.org/docs/current/release-18-6.html
- BullMQ 6.2.0: https://docs.bullmq.io/changelog
- Meilisearch 1.53.1: https://github.com/meilisearch/meilisearch/releases
- Payme Merchant API: https://developer.help.paycom.uz/metody-merchant-api/ ; Click: https://docs.click.uz/en/ ; Uzum: https://developer.uzumbank.uz/en/
- E-IMZO: https://github.com/qo0p/e-imzo-doc
- Eskiz SMS: https://documenter.getpostman.com/view/663428/TVK5eMco
- OneID: https://id.egov.uz/oz ; STIR: https://my.gov.uz/uz/service/67
- O'TY raqamlashtirish (EBRD, 2026-06): https://www.ebrd.com/home/news-and-events/news/2026/ebrd-supports-digital-transformation-of-uzbekistan-railways.html
- Shaxsiy ma'lumotlar qonuni: https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems , https://www.dentons.com/en/insights/articles/2026/march/31/uzbekistan-dismantles-strict-data-localization-regime , https://www.legal500.com/developments/thought-leadership/personal-data-compliance-in-uzbekistan/
