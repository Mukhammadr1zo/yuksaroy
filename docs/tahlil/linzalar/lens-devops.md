# YukSaroy — DevOps, xavfsizlik, infratuzilma va jamoa (lens: devops)

Rol: Platform/DevOps Lead + Security Lead + Delivery Manager. Sana: 2026-09-03. Boshlang'ich nuqta — VagonFlow (uzty-taminot) prod: 1 ta VPS, docker-compose (db + backup + app + bot + client-bot), nginx, 1 GB disk, `pg_dump` → Telegram zaxira, GitHub Actions `appleboy/ssh-action` orqali deploy. YukSaroy bu asosdan boshlanadi, lekin marketpleys (pul, ERI, 18 428 mijoz PII, stansiya/terminal integratsiyasi) uchun bu yetarli emas.

---

## 1. Hosting: O'zbekiston DC/klaud variantlari

### 1.1 Huquqiy chegara (2026 holati)

- 2026-03-26 da «Shaxsiy ma'lumotlar to'g'risida»gi qonunga o'zgartirish (O'RQ-1125) kiritildi: **majburiy lokalizatsiya faqat biometrik, genetik va telekom-operator foydalanuvchilari ma'lumotlariga** qoldi; qolgan PII ni chet elda saqlash «adekvat himoya» ro'yxati (Vazirlar Mahkamasi hali tasdiqlamagan), standart shartnoma bandlari yoki xalqaro standartlar sharti bilan mumkin (Legal500, Times of Central Asia, Kun.uz).
- Kiberxavfsizlik qonuni (O'RQ-764) + 3573-son Nizom (14.11.2024): davlat organlari, **muhim axborot infratuzilmasi (MAI) obyektlari** — transport shu ro'yxatda — va moliya tashkilotlari majburiy kiberxavfsizlik ekspertizasidan o'tadi: ishlayotgan tizim 2 yilda 1 marta, veb-sayt yilda 1 marta, ekspertiza 30 ish kuni, natija — «xulosa». Boshqa sub'ektlar ixtiyoriy.
- YukSaroy o'zi MAI emas, lekin F2/F3 da O'TY tizimlariga (ASOUP, kod balansi) ulanadi → ulanish momentida O'TY tomoni ekspertiza xulosasini so'raydi. Shuning uchun **qaror: barcha muhitlar O'zbekiston DC da**. Nima uchun: (a) huquqiy noaniqlikni (adekvatlik ro'yxati yo'q) yopadi, (b) TAS-IX/UZ-IX orqali ~2–5 ms latency, stansiyalarda internet zaif, (c) O'TY bilan shartnomada «ma'lumotlar respublikada» talabi deyarli aniq. Alternativa (Hetzner/AWS eu-central) 2–3 barobar arzon, lekin O'TY integratsiyasi va davlat homiysi bilan muzokarada yo'qotish narxi undan katta.

### 1.2 Provayderlar solishtiruvi (2026-09, VAT bilan, oyiga)

| Provayder | Tekshirilgan konfiguratsiya | Narx | SLA / DC | Qo'shimcha xizmat |
|---|---|---|---|---|
| **UzCloud (Uzinfocom)** | Standard 4 vCPU/8 GB/40 GB SSD | 516 000 so'm | 99,95 %, 5 ta Tier III DC, 4 hudud | Managed K8s (control plane 500 k single / 1,5 mln HA 99,9 %), worker 4 vCPU/8 GB/100 GB = 636 k; S3 (3× replikatsiya, AWS API) 45 k dan; DBaaS PostgreSQL ~779 k; backup 700/2 000/3 300 so'm/GB (HDD/SSD/NVMe) |
| **Uztelecom Cloud** | PAYG: vCPU 85 000, RAM 12 000/GB, SSD 2 000/GB, NVMe 3 300/GB, IPv4 50 000 | 4 vCPU/8 GB/80 GB NVMe ≈ 750 000 so'm | 100 Mbit internet + TAS-IX kiritilgan, 24/7 | Managed K8s/S3 e'lon qilinmagan |
| Eskiz.uz | VPS 4: 4 vCPU/8 GB/120 GB NVMe | 380 000 so'm | SLA ko'rsatilmagan, 30 Mbit internet | backup +20 % |
| aHost.uz | VDS Cloud 200: 4 vCPU/4 GB/200 GB SSD | 590 000 so'm | litsenziyali, TAS-IX 100 Mbit | — |

Beeline UZ + DataVolt TAS-1 (IT Park, 6 MW, 2026-12) hali sotuvda yo'q — 2027 uchun kuzatiladi; Selectel UZ narxini UZS da e'lon qilmaydi.

**Tanlov: UzCloud.** Nima uchun: bitta shartnomada VPS + Managed K8s + S3 + DBaaS + SLA raqami (99,95 %) va 5 DC (≥300 km) — DR uchun ikkinchi hudud. Alternativa: Uztelecom PAYG — narx yaqin, lekin S3/K8s yo'q; Eskiz — 30–40 % arzon, lekin SLA/DC sertifikati yo'q → faqat dev.

### 1.3 VagonFlow VPS dan farqi

| | VagonFlow hozir | YukSaroy F1 | YukSaroy F2 |
|---|---|---|---|
| Serverlar | 1 VPS, 1 GB disk (log rotatsiya shu sababdan) | prod: 8 vCPU/16 GB/80 GB NVMe + 100 GB SSD data-disk; stage: 4/8/40 | prod: Managed K8s 3 worker + DBaaS; stage o'zgarmaydi |
| DB | konteynerdagi Postgres 17 | konteynerdagi Postgres 17 + WAL arxiv S3 ga | UzCloud DBaaS PostgreSQL (failover, backup) |
| Fayllar | named volume `uploadsdata` | to'g'ridan-to'g'ri UzCloud S3 (`@aws-sdk/client-s3`) | shu + ikkinchi hudud replikatsiya |
| Zaxira | `pg_dump` → Telegram, 7 kun | pgBackRest PITR, 30 kun | shu + standby |
| Deploy | ssh + `docker compose up` | shu (skript standartlashtiriladi) | ArgoCD/Helm |
| Kuzatuv | /api/health | Grafana + Loki + Prometheus + Uptime Kuma | + Tempo (trace) |

Oylik infra xarajati F1: prod 1 136 k + data-disk 200 k + stage 516 k + monitoring VM 258 k + S3/backup ~150 k + 2 IPv4 100 k ≈ **2,4 mln so'm** (~$200). F2 (K8s HA + DBaaS): ≈ 1,5 mln + 3×636 k + 779 k + 516 k + 258 k + 300 k ≈ **5,3 mln so'm** (~$440).

---

## 2. Muhitlar, Compose → k3s/k8s mezoni, IaC, sirlar

### 2.1 Muhitlar

| Muhit | Qayerda | DB | Kim deploy qiladi | Maqsad |
|---|---|---|---|---|
| `dev` | har dasturchi laptopi, `docker compose -f compose.dev.yml` (Postgres + MinIO + Mailpit) | lokal, `prisma migrate dev` + seed (10 terminal, 50 mijoz, 200 buyurtma) | — | funksiya ishlab chiqish |
| `stage` | UzCloud Standard, `stage.yuksaroy.uz` | prod dan anonimlashtirilgan dump (telefon/STIR maskalangan) | GitHub Actions, `main` ga merge bo'lganda avtomatik | QA, Playwright, terminallar bilan demo |
| `prod` | UzCloud Business, `app.yuksaroy.uz` | haqiqiy | GitHub Actions, `v*` teg bosilganda + 1 ta qo'lda approval (GitHub Environment `production`) | mijozlar |

PR-preview muhitlari F1 da **yo'q** (ponytail: 6 kishilik jamoada stage yetadi; jamoa 10+ bo'lsa yoki kuniga 5+ PR bo'lsa qo'shiladi).

### 2.2 Compose → k3s/k8s o'tish mezoni (aniq raqamlar)

Compose da qolamiz, toki quyidagilardan **kamida 2 tasi** bajarilmaguncha:

1. DAU > 2 000 yoki p95 API latency > 500 ms — VM 16 vCPU ga kengaytirilganda ham.
2. Deploy haftasiga > 10 (compose `up` ~30 s downtime beradi; 40 deploy × 30 s = 20 min — 99,5 % ga sig'adi, 99,9 % ga sig'maydi).
3. Fon ishchilari (SMS, ETA, PDF/ERI, ASOUP polling) > 3 va alohida masshtab kerak.
4. O'TY shartnomasi HA (ikki zona) talab qildi.

O'tish: **to'g'ridan-to'g'ri UzCloud Managed K8s**, k3s bosqichisiz. Nima uchun: o'z k3s = etcd/upgrade/backup yuki 0,5 FTE; managed HA control plane 1,5 mln so'm/oy — 0,1 FTE narxi. Alternativa: Docker Swarm — sodda, lekin Helm/ArgoCD/HPA yo'q, baribir K8s ga o'tiladi.

### 2.3 IaC

- **Ansible** (F1): 3 ta playbook — `base.yml` (ufw, fail2ban, unattended-upgrades, docker, node_exporter), `app.yml` (compose fayllar, nginx conf, certbot), `monitoring.yml`. Inventory: `stage`, `prod`, `mon`. Nima uchun Ansible: UzCloud uchun ochiq Terraform provayder tasdiqlanmagan (tekshirish kerak: OpenStack API bo'lsa `terraform-provider-openstack` ishlaydi) — VM yaratish 3 ta bo'lsa, qo'lda yaratib, holatini Ansible bilan idempotent qilish yetarli.
- **Terraform** (F2, K8s bilan): faqat provayder API bo'lsa; bo'lmasa Helm + ArgoCD `app-of-apps` klaster ichini boshqaradi, VM lar qo'lda.

### 2.4 Sirlar

- `infra/secrets/*.enc.yaml` — **SOPS + age**; kalitlar: 1 ta jamoa kaliti (tech lead + DevOps), 1 ta CI kaliti (GitHub secret `SOPS_AGE_KEY`). Deploy skripti serverda `sops -d` qilib `.env` yozadi (`chmod 600`, git da yo'q).
- GitHub Environments: `staging` (auto), `production` (required reviewer: tech lead). Sirlar: `SSH_KEY`, `SOPS_AGE_KEY`, `SENTRY_DSN` yo'q (Grafana ishlatamiz).
- Vault — **F1 da yo'q** (ponytail: 2 muhit × ~25 sir uchun Vault serverini boqish ortiqcha; K8s ga o'tganda External Secrets Operator + Vault yoki SOPS-operator).
- Rotatsiya: JWT secret, DB parol, S3 kalit — 90 kun; ERI/VPN kalitlari — shartnoma muddati; rotatsiya skripti `scripts/rotate-secret.sh` + `AuditLog` ga yozuv.

---

## 3. CI/CD — GitHub Actions

Monorepo (pnpm + Turborepo): `apps/web` (Next.js), `apps/bot` (Telegraf), `apps/mobile` (Expo), `packages/db` (Prisma), `packages/ui`, `packages/config`, `infra/` (ansible, compose, nginx).

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push: { branches: [main], tags: ['v*'] }
concurrency: { group: ${{ github.ref }}, cancel-in-progress: true }

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: ci, POSTGRES_DB: yuksaroy_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:ci@localhost:5432/yuksaroy_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck            # eslint + tsc --noEmit, cache bilan
      - run: pnpm --filter @yuksaroy/db prisma migrate deploy   # migratsiya qaytmasligini tekshiradi
      - run: pnpm turbo test -- --coverage        # vitest; threshold 70% lines
      - run: pnpm audit --audit-level=high        # supply-chain darvoza
      - run: pnpm turbo build
      - uses: actions/upload-artifact@v4
        with: { name: web-standalone, path: apps/web/.next/standalone }

  e2e:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f infra/compose.ci.yml up -d --wait   # web+db+minio seed bilan
      - run: pnpm --filter e2e exec playwright test --project=chromium
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: apps/e2e/playwright-report }

  image:
    needs: e2e
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions: { packages: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/yuksaroy/web:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: aquasecurity/trivy-action@0.28.0
        with: { image-ref: ghcr.io/yuksaroy/web:${{ github.sha }}, severity: CRITICAL,HIGH, exit-code: 1 }

  deploy-stage:
    needs: image
    if: github.ref == 'refs/heads/main'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.STAGE_HOST }}
          key: ${{ secrets.SSH_KEY }}
          script: /opt/yuksaroy/deploy.sh ${{ github.sha }}   # sops -d → .env; compose pull; migrate deploy; up -d; smoke

  deploy-prod:
    needs: image
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production            # required reviewer: tech lead
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.2.0
        with: { host: ${{ secrets.PROD_HOST }}, key: ${{ secrets.SSH_KEY }}, script: /opt/yuksaroy/deploy.sh ${{ github.ref_name }} }
      - name: smoke
        run: |
          curl -fsS https://app.yuksaroy.uz/api/health | grep '"db":"ok"'
          curl -fsS -o /dev/null -w '%{http_code}' https://app.yuksaroy.uz/terminals | grep 200
```

`deploy.sh` (VagonFlow dan farqi — image serverda build qilinmaydi, GHCR dan `pull`; 1 GB diskdagi build-timeout muammosi yo'qoladi): `sops -d` → `compose pull` → `compose run --rm web pnpm prisma migrate deploy` → `compose up -d --wait` → `curl /api/health` → xato bo'lsa `.last_good` tegiga qaytish + Telegram alert. Migratsiya faqat **expand → migrate → contract** — rollback kodni qaytaradi, DB ni emas.

---

## 4. Kuzatuv, SLO/SLA, alert

**Tanlov: Grafana + Prometheus + Loki + Tempo (OSS, `mon` VM da docker compose) + OpenTelemetry SDK + Uptime Kuma.** Nima uchun Sentry SaaS emas: stack-trace/breadcrumb ichida telefon, STIR, vagon raqami ketadi — Sentry serverlari chet elda; self-hosted Sentry ≥ 8 GB RAM va 10+ konteyner — 1 DevOps uchun og'ir. Alternativa: GlitchTip (self-hosted, 3 konteyner) — F2 da frontend xatolari uchun qo'shish mumkin.

- Ilova: `@vercel/otel` (Next.js instrumentation.ts) → OTel Collector → Tempo (trace), Prometheus (`/metrics`: http latency histogram, `order_created_total`, `slot_booked_total`, `sms_sent_total`, `eri_verify_fail_total`), Loki (pino JSON log, `docker` driver → promtail).
- Host: node_exporter, cAdvisor, postgres_exporter (connection, replication lag, dead tuples).
- Tashqi: Uptime Kuma (`/api/health` 60 s, TLS muddati, domen), Telegram kanalga.

SLO (oylik, prod):

| SLI | Maqsad | Error budget |
|---|---|---|
| Availability (`/api/health` + `/terminals` 2xx) | 99,5 % | 3 soat 39 min |
| API p95 latency (`/api/orders`, `/api/slots`) | < 400 ms | 5 % so'rov |
| SMS OTP yetkazish 60 s ichida | 98 % | — |
| Terminalga push/xat yetkazish 30 s | 99 % | — |

Alert (Grafana → Telegram; F2 da qo'ng'iroq): 5xx > 2 % / 5 min (page), disk > 80 % warn / > 90 % page, WAL arxiv 15 min uzilsa (page), sertifikat < 14 kun; error budget 50 % sarflansa — reliz muzlatiladi.

---

## 5. Backup / DR

| Ob'ekt | Vosita | Chastota | Saqlash | RPO | RTO |
|---|---|---|---|---|---|
| Postgres | **pgBackRest** → UzCloud S3 (`yuksaroy-pgbackrest`), `archive_mode=on`, WAL har 60 s yoki 16 MB | full: har kun 02:00 Toshkent; diff: har 6 soat; WAL uzluksiz | 30 kun PITR, oylik full 12 oy | **≤ 1 min** | F1: 60 min (yangi VM + restore); F2 (DBaaS failover): 5 min |
| Fayllar (hujjat PDF, foto, ERI PKCS7) | UzCloud S3 versioning + `aws s3 sync` ikkinchi hudud bucket ga har 15 min | uzluksiz | 90 kun versiya | 15 min | 30 min |
| Konfiguratsiya/sirlar | git (SOPS) | har commit | doimiy | 0 | 10 min |
| Grafana dashboard/alert | provisioning YAML git da | — | — | 0 | 15 min |

MinIO: **F1 da kerak emas** — UzCloud S3 (3× replikatsiya) to'g'ridan-to'g'ri ishlatiladi; MinIO faqat dev compose da (S3 API mos). Nima uchun: MinIO replikatsiyasini boqish = yana bir stateful xizmat 1 GB-disk-tipidagi muammolar bilan.

DR mashqi: har oy 1-juma, stage da `pgbackrest restore --type=time` tasodifiy vaqtga, `orders` soni solishtiriladi, natija `docs/runbooks/dr-drill.md` ga yoziladi. Restore hech qachon sinalmagan zaxira — zaxira emas (VagonFlow Telegram dump ham shu testdan o'tishi kerak).

---

## 6. Xavfsizlik

### 6.1 STRIDE threat model — 10 asosiy tahdid

| # | Tahdid | STRIDE | Ta'sir | Nazorat |
|---|---|---|---|---|
| 1 | OTP brute-force / SMS-bombing (`/api/auth/otp`) | S, D | akkaunt egallash, SMS byudjeti | Redis rate-limit: telefon 3/10 min, IP 20/soat; 6 raqam, 5 min TTL, 5 xato → 30 min blok; CAPTCHA (hCaptcha self-check) 3-urinishdan |
| 2 | JWT o'g'irlash (XSS orqali) | S | begona buyurtma/to'lov | `httpOnly; Secure; SameSite=Lax` cookie, 15 min access + 7 kun refresh rotatsiya (jose), CSP `default-src 'self'`, nonce |
| 3 | Narx/tarif kalkulyatsiyasini klientda o'zgartirish | T | komissiya yo'qotish | narx **faqat serverda** `calcQuote()` da; klientdan faqat `terminalId, cargoTypeId, weight, extras[]` keladi; quote 15 min imzolangan (`hmac`) |
| 4 | IDOR: `/api/orders/{id}` boshqa mijoz buyurtmasi | I | 18 428 mijoz PII | har so'rovda `where: {id, clientId: session.clientId}`; Prisma client extension `forTenant()`; test: har endpoint uchun 403 sinovi |
| 5 | ERI roziligi soxtalashtirish (shahobcha egasi «qarshi emasman») / replay | R, S | stansiyaga soxta xat | PKCS7 attached, `e-imzo-server /backend/pkcs7/verify/attached` (OCSP + zanjir), hujjat hash + `documentId` + `nonce` imzolanadi, timestamp `/frontend/timestamp/pkcs7`, ikki marta ishlatish taqiq (`signature_nonce` unique) |
| 6 | Mijozlar bazasi (STIR, telefon) eksporti — insayder | I | reputatsiya, 46-2 modda jarimasi | `base` ekrani faqat `ADMIN`, sahifalash 50, eksport CSV faqat 2 kishi + audit yozuvi + 4 ko'zli tasdiq; DB da telefon shifrlangan |
| 7 | Zararli fayl yuklash (foto-dalil, hujjat) | T, E | server egallash, boshqa mijozga zarar | MIME + magic-bytes tekshiruv, 10 MB limit, S3 ga to'g'ridan-to'g'ri presigned PUT, ClamAV skan (fon ishchi), `Content-Disposition: attachment`, alohida domen `files.yuksaroy.uz` |
| 8 | Slot band qilish poygasi / DoS | D, T | ikki mijoz bitta slot | `SELECT ... FOR UPDATE` + `UNIQUE(terminalId, date, slot)`; nginx `limit_req 10r/s` burst 20; CrowdSec |
| 9 | Rol ko'tarish: terminal xodimi → boshqa terminal / stansiya | E | tasdiqlash soxtalashtirish | RBAC + ABAC: `role` + `terminalId/stationId` claim, middleware `assertScope()`; rol o'zgarishi faqat ADMIN + audit |
| 10 | Supply chain: npm paket / CI sir sizishi | T, I | butun tizim | `pnpm audit`, Renovate haftalik, `lockfile` majburiy, Trivy image skan, GitHub secret faqat Environment darajasida, `permissions: {}` default, OIDC |
| 11 | To'lov webhook (Payme/Click/Uzum) soxtalashtirish | S, T | buyurtma «to'langan» bo'lib qoladi | webhook imzo/HMAC tekshiruv, idempotency key, summa serverdagi quote bilan solishtiriladi, IP allowlist |

### 6.2 OWASP ASVS L2 nazorat ro'yxati (YukSaroy uchun moslangan)

- **V2 Auth**: telefon + OTP; yuridik shaxs uchun ERI challenge-response (`/frontend/challenge` → `/backend/auth`); parol bo'lsa argon2id; limit (6.1 #1).
- **V3 Sessiya**: refresh rotatsiya + reuse-detection → barcha sessiyalar bekor; profil sahifasida sessiyalar ro'yxati.
- **V4 Ruxsat**: deny-by-default; har route `requireRole([...])`; ob'ekt darajasida `clientId/terminalId` filtr; admin amallar 2 kishi.
- **V5 Validatsiya**: barcha input `zod` (server actions ham); vagon raqami 8 raqam + kontrol raqam; STIR 9 raqam.
- **V6 Kripto**: TLS 1.2/1.3, HSTS 1 yil; PII ustunlar AES-256-GCM (6.4); `crypto.randomBytes`.
- **V7 Log/Audit**: pino JSON, PII maskalangan (`+9989****01`); `AuditLog` append-only, `prevHash` zanjir, 3 yil.
- **V8 Ma'lumot**: `docs/security/pii-register.md` (ro'yxat + saqlash muddati), PII sahifalarda `Cache-Control: no-store`, eksport auditi.
- **V9 Aloqa**: TAS-IX ichida ham TLS; SMS provayder HTTPS + token; O'TY API mTLS (F2).
- **V10/V14 Konfig**: CSP, X-Frame-Options DENY, Referrer-Policy (`next.config` headers), debug endpoint yo'q, Trivy.
- **V12 Fayllar**: 6.1 #7. **V13 API**: JSON only, CORS faqat `app.yuksaroy.uz` + mobil, har endpoint rate-limit.

### 6.3 WAF / rate-limit

Cloudflare **ishlatilmaydi** — TLS chet elda tugaydi, bu «ma'lumot respublikada» tamoyilini buzadi. O'rniga: nginx (`limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s`, `limit_conn 20`), **CrowdSec** (OSS, jamoaviy qora ro'yxat, nginx bouncer), fail2ban ssh, ufw (22 faqat ofis IP + WireGuard, 80/443 ochiq). Ilova ichida Redis (`ioredis`) bilan `@upstash/ratelimit` o'rniga 20 qatorli sliding-window (ponytail: kutubxona kerak emas).

### 6.4 PII shifrlash

Postgres ustun darajasida, ilova tomonda (`packages/db/src/crypto.ts`, AES-256-GCM, kalit `PII_KEY` SOPS da, `keyVersion` ustuni rotatsiya uchun): `Client.phone` (qidiruv uchun alohida `phoneHash` SHA-256+pepper), `Client.passport/pinfl`, `BankAccount`, ERI sertifikat seriyasi. STIR shifrlanmaydi (ochiq reestr ma'lumoti). Prisma `$extends` orqali `create/update/findMany` da avtomatik shifrlash/ochish. DB dump (pgBackRest) qo'shimcha `--repo1-cipher-type=aes-256-cbc` bilan. Nima uchun pgcrypto emas: kalit SQL log/`pg_stat_statements` ga tushadi.

### 6.5 Audit

Har mutatsiya → `AuditLog{actorId, role, action, entity, entityId, before, after, ip, ua, ts, prevHash}`; o'chirish yo'q (soft-delete). Ish standarti talabi «ким, қачон, нима қилди» aynan shu jadvaldan: buyurtma sahifasida timeline. Kunlik `audit_chain_check` cron — zanjir uzilsa page.

### 6.6 Pentest rejasi

| Bosqich | Qachon | Kim | Nima |
|---|---|---|---|
| Avtomatik | har PR | CI | `pnpm audit`, Trivy, semgrep (OWASP ruleset), OWASP ZAP baseline stage ga (nightly) |
| Ichki | F1 oxiri (16-hafta) | tech lead + DevOps, 3 kun | ASVS L2 chek-list, IDOR/rol testlari Playwright bilan |
| Tashqi pentest #1 | F2 to'lovdan oldin (22-hafta) | mustaqil kompaniya (Toshkent: CyberOps/Uzinfocom/DSEC tipidagi — 3 taklif olinadi), $4–8 k | black-box + gray-box web/API/mobil, hisobot, 2 hafta retest |
| Kiberxavfsizlik ekspertizasi (3573-Nizom) | O'TY API ulanishidan oldin (F3) | Kiberxavfsizlik markazi, 30 ish kuni | «xulosa» — O'TY shartnomasiga ilova; veb-sayt uchun yiliga 1 marta |
| Bug bounty | F3 | jamoa | Telegram kanal orqali, 500 k – 5 mln so'm |

### 6.7 ERI (E-IMZO) kalitlari bilan ishlash

- **Foydalanuvchi kaliti hech qachon serverga kelmaydi.** Imzo klientda: `E-IMZO.exe` (WebSocket `127.0.0.1:64646`) + `e-imzo.js` → `create_pkcs7()`; mobilda E-IMZO ID (ID-karta NFC, deeplink, `SiteID`). Server PKCS7 ni **`e-imzo-server`** (JRE 1.8, `vpn.e-imzo.uz:3443` VPN kalit, shartnoma) orqali `/backend/pkcs7/verify/attached` da tekshiradi va `/frontend/timestamp/pkcs7` bilan vaqt tamg'asi qo'shadi — sertifikat muddati tugasa ham imzo haqiqiy qoladi.
- e-imzo-server alohida konteyner, faqat `web` dan ichki tarmoqda (`ports` yo'q); `/backend/*` tashqariga chiqmaydi.
- Platformaning **o'z** imzosi (stansiyaga xat, dalolatnoma): yuridik shaxs ERI si USB-token/ID-kartada, alohida `signer` xizmati (`sign_jobs` navbati, 2 kishi ruxsati); `.pfx` S3/git da **hech qachon** yo'q.
- Saqlash: PKCS7 attached S3 `documents/` (versioning) + `Document{hash, signerPinfl, signerSerial, validFrom, validTo, tsaTime}`; `verify.yuksaroy.uz/{id}` QR-sahifasi hashni qayta hisoblaydi.
- Xat oqimi: mijoz to'ldiradi → shahobcha egasi «rozilik» imzolaydi (PKCS7 #1) → mijoz xatni imzolaydi (PKCS7 #2) → stansiya kabineti → ruxsat raqami (F1: tugma; F2: ERI).

---

## 7. Jamoa va byudjet

### 7.1 Toshkent bozori (2026-08/09 e'lonlari, yalpi)

Manbalar: UzDev Jobs (24.08.2026): Senior DevOps 18 mln+ (Frame Media), Middle DevOps 13 mln+ (Webase), Flutter middle 10–17 mln (Autoguide), Vue middle 10–12 mln, Senior QA $3 000 gacha (ADM Global), Laravel middle $1 000–2 000; hh.uz: Senior Backend $2 400+ gross (AGAR), Senior Go 30–50 mln (arxiv), Senior UX/UI 25 mln dan; Flexa: IT sektori o'rtacha 17,41 mln (~$1 450), dasturlash 22,23 mln; kurs ~12 000 so'm/$. State of Dev 2025 (206 respondent): 36 % chet el kompaniyasida — senior narxini yuqoriga tortadi.

### 7.2 Rollar va 6 oylik xarajat (so'm, yalpi, oyiga)

| Rol | FTE | Oylik | 6 oy | Izoh |
|---|---|---|---|---|
| PM / Product owner | 1 | 20 mln | 120 mln | foydalanuvchi o'zi bo'lishi mumkin → 0 |
| Tech lead (fullstack, Next.js/Prisma) | 1 | 35 mln | 210 mln | arxitektura, code review, prod deploy tasdig'i |
| Frontend senior (3D/video-hero, design system) | 1 | 25 mln | 150 mln | |
| Frontend middle | 1 | 15 mln | 90 mln | |
| Backend senior (Prisma, to'lov, ERI) | 1 | 25 mln | 150 mln | |
| Backend middle (bot, ishchilar, integratsiya) | 1 | 15 mln | 90 mln | |
| Mobile (Expo/React Native — FE bilan kod ulashadi) | 1 (F2 dan, 3 oy) | 17 mln | 51 mln | Flutter alternativa: alohida kod bazasi, +1 kishi |
| UI/UX + motion dizayner | 1 (4 oy) | 18 mln | 72 mln | logo, video-banner, Figma kit |
| QA (manual + Playwright) | 1 (F1 dan, 5 oy) | 12 mln | 60 mln | |
| DevOps / SecOps | 0,5 | 18 mln × 0,5 | 54 mln | F0 da 1 oy full |
| Domen-ekspert (temir yo'l, terminal) | 0,5 | 10 mln × 0,5 | 30 mln | foydalanuvchi tarmog'idan |
| **Jamoa jami** | ~9 | **~190 mln** | **~1 077 mln** | |
| Infra (UzCloud stage+prod+mon+S3) | | 2,4 → 5,3 mln | 22 mln | |
| Servislar (GitHub Team 12×$4, Figma 2×$15, SMS 50 k ta × 80 so'm, domen, E-IMZO shartnoma) | | ~4 mln | 24 mln | |
| Tashqi pentest | | | 70 mln | $5–6 k |
| Kiberxavfsizlik ekspertizasi (rezerv) | | | 30 mln | narx so'rov bilan |
| Rezerv 10 % | | | 122 mln | |
| **Jami 6 oy** | | | **≈ 1,35 mlrd so'm (~$112 k)** | |

Soliq: IT Park rezidentligi (jismoniy shaxslar daromad solig'i 7,5 % va ijtimoiy soliq imtiyozi — buxgalter bilan tekshirish) — yuqoridagi raqamlar yalpi. Alternativa: 2 senior o'rniga 1 senior + 2 middle — oyiga 10 mln tejaladi, lekin ERI/to'lov qismi senior talab qiladi; tejash o'rni — mobile ni F2 oxiriga surish (−51 mln).

### 7.3 Sprint rejasi F0–F2 (2 haftalik sprintlar, 26 hafta)

| Hafta | Sprint | Natija (Definition of Done bilan) | Milestone |
|---|---|---|---|
| 1–2 | S0 | Monorepo skeleton, CI (lint/typecheck/test/build) yashil, dev compose, Ansible `base.yml` stage VM, domen + TLS, Figma design tokens, logo 3 variant | **M0: «Hello prod»** — `stage.yuksaroy.uz` /health |
| 3–4 | S1 | Prisma sxema v1 (Terminal, Siding→VagonFlow import, Client 18 428 import skripti, Order, Slot, Tariff), seed, auth (telefon+OTP), RBAC | 5 terminal pasporti raqamlashtirildi (domen-ekspert) |
| 5–6 | S2 | Katalog + xarita (railmap JSON), terminal kartasi, narx kalkulyatori (server `calcQuote`), video-hero + 3D landing | **M1: F0 yakuni** — memorandum 3–5 terminal, demo landing |
| 7–8 | S3 | Buyurtma 8-qadam oqimi, slot band qilish (`FOR UPDATE`), terminal kabineti «talabnomalar» + 30 min SLA taymer, Telegram bot xabar | |
| 9–10 | S4 | «Mening buyurtmalarim», kuzatuv statuslari, SMS (Eskiz), push (FCM — VagonFlow dan), audit log + timeline | prod VM Ansible bilan, pgBackRest, Grafana |
| 11–12 | S5 | Aktivlar bozori (vagon/teplovoz/shahobcha), shahobcha xaritasi, **stansiyaga xat konstruktori** (PDF/DOCX, ERI siz — F1) | tashqi 10 mijoz bilan UAT |
| 13–14 | S6 | Reyting, admin analitika (recharts), mijozlar bazasi segmentatsiya, aktivatsiya SMS to'lqini #1 (500 mijoz) | |
| 15–16 | S7 | Playwright 25 sinov, ichki pentest, ASVS chek-list, load test (k6: 200 RPS), DR mashqi #1, `v1.0.0` | **M2: F1 MVP prod** (Toshkent tuguni) |
| 17–18 | S8 | E-IMZO integratsiya (challenge auth, PKCS7 verify, timestamp), xat konstruktori ERI bilan, `Document` QR-tekshiruv | E-IMZO shartnoma imzolangan (F0 da boshlanadi!) |
| 19–20 | S9 | To'lov (Payme/Click/Uzum) + webhook, eskrou holatlari, hisob-faktura/dalolatnoma PDF, komissiya hisobi | |
| 21–22 | S10 | Terminal SaaS kabineti (tariflar, slot jadvali, vakansiya), Expo mobil ilova alfa (katalog, buyurtma, push) | **tashqi pentest** |
| 23–24 | S11 | Pentest tuzatishlari, mobil beta (TestFlight/Internal testing), ТЙ kod arizasi (yarim-avto), rassrochka jadvali | |
| 25–26 | S12 | Managed K8s ga o'tish (agar 2.2 mezon ishlasa) yoki compose da qoladi, DBaaS migratsiya, `v2.0.0`, DR mashqi #2 | **M3: F2 prod** — to'lov + hujjat + mobil |

---

## 8. Sifat darvozalari

### 8.1 Definition of Done (har user story)

1. PR ≤ 400 qator, tavsifda «nima / nima uchun / qanday sinaldi» + UI bo'lsa gif.
2. CI yashil; yangi mantiq uchun ≥1 vitest (pul/ruxsat/slot uchun majburiy).
3. Prisma migratsiya expand-only, `migrate deploy` CI da o'tgan.
4. Yangi endpoint uchun «boshqa mijoz → 403» sinovi.
5. i18n uz/oz/ru kalitlari, hardcoded matn yo'q; loglar PII siz; tashqi chaqiriq — timeout + retry + metrika.
6. Stage da QA chek-list o'tdi; kritik oqim (auth, buyurtma, slot, to'lov) Playwright da.
7. Runbook/`.env.example`/SOPS yangilangan.
8. Landing: Lighthouse mobil ≥ 85, video-hero `preload=metadata`, 3D faqat `prefers-reduced-motion: no-preference` da.

### 8.2 Kod-review qoidalari

- Trunk-based: `main` himoyalangan, branch `feat/YS-123-slot-lock`, squash-merge, Conventional Commits (`feat(order): ...`), changelog avtomatik (`release-please`).
- 1 approve majburiy; `packages/db/prisma`, `apps/web/src/lib/auth`, `apps/web/src/lib/payments`, `infra/**` uchun CODEOWNERS = tech lead (2-approve).
- Review SLA: 4 ish soati; 24 soatdan oshsa standup da ko'tariladi.
- Reviewer chek-listi: (a) ruxsat filtri bormi, (b) narx/summa serverda hisoblanganmi, (c) tranzaksiya/lock, (d) test o'zgartirilgan mantiqni buzsa yiqiladimi, (e) o'chirish mumkin bo'lgan kod bormi (ponytail).
- AI-yordamchi (Claude Code) PR lari ham shu qoidada; `ponytail:` izohlar oylik `debt` ro'yxatiga yig'iladi.

### 8.3 Monorepo boshqaruvi

```
yuksaroy/
├─ apps/
│  ├─ web/        Next.js 16 (App Router, server actions, /api)
│  ├─ bot/        Telegraf (VagonFlow bot arxitekturasi qayta ishlatiladi)
│  ├─ mobile/     Expo (React Native), packages/ui ni ulashadi
│  └─ e2e/        Playwright
├─ packages/
│  ├─ db/         Prisma schema + client + crypto.ts + seed
│  ├─ ui/         design tokens, komponentlar (Radix + Tailwind v4)
│  ├─ domain/     calcQuote, slot qoidalari, vagon raqami tekshiruvi — toza TS, 100% test
│  └─ config/     eslint, tsconfig, tailwind preset
├─ infra/
│  ├─ ansible/    base.yml app.yml monitoring.yml inventory/
│  ├─ compose/    compose.dev.yml compose.ci.yml compose.prod.yml
│  ├─ nginx/      app.conf (limit_req, headers)
│  ├─ secrets/    *.enc.yaml (SOPS+age)
│  └─ grafana/    dashboards/ alerts/ (provisioning)
├─ docs/
│  ├─ adr/        0001-uzcloud.md 0002-no-cloudflare.md 0003-compose-until.md ...
│  ├─ runbooks/   deploy.md rollback.md dr-drill.md incident.md rotate-secret.md
│  └─ security/   threat-model.md pii-register.md asvs-checklist.md
├─ turbo.json  pnpm-workspace.yaml  .github/workflows/ci.yml  CODEOWNERS
```

Qoidalar: `pnpm` + Turborepo cache, `syncpack` bilan bitta versiya siyosati, Renovate haftalik, `apps/*` bir-birini import qilmaydi (faqat `packages/*`), har ADR 1 sahifa («qaror / nima uchun / alternativa / oqibat»).

Nima uchun alohida monorepo (alternativa — VagonFlow ichida modul): boshqa yuridik shaxs, boshqa foydalanuvchi bazasi, boshqa reliz ritmi; VagonFlow bilan faqat **API** (`Siding`, `Request`, `/api/mobile/lifecycle`) — sxema bo'lishilsa O'TY ichki tizimi tashqi marketpleys xavfsizlik perimetriga chiqib qoladi.

---

## Manbalar

- UzCloud VPS/K8s/S3/DBaaS narxlari: https://uzcloud.uz/en/solutions/vps-vds , https://uzcloud.uz/en/cloud/k8s , https://uzcloud.uz/en/cloud/s3 , https://uzcloud.uz/en/cloud/dbaas
- Uztelecom Cloud PAYG: https://uztelecom.uz/uz/biznesga/bulutli-xizmatlar/virtual-dedicated-server/
- Eskiz VPS: https://eskiz.uz/en/vps ; aHost VDS: https://www.ahost.uz/
- Beeline UZ + DataVolt TAS-1: https://www.veon.com/newsroom/press-releases/beeline-uzbekistan-and-datavolt-partner-to-advance-central-asias-digital-infrastructure ; IT Park/Selectel: https://www.it-park.uz/en/itpark/news/selectel-resident-of-it-park-has-updated-its-cloud-platform-in-uzbekistan
- Shaxsiy ma'lumotlar lokalizatsiyasi 2026: https://www.legal500.com/developments/thought-leadership/legislative-updates-in-the-field-of-artificial-intelligence-and-personal-data-regulation-uzbekistan/ , https://timesca.com/uzbekistan-eases-data-localization-rules-to-support-global-payment-platforms/ , https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems , https://www.dlapiperdataprotection.com/index.html?t=law&c=UZ
- Kiberxavfsizlik: O'RQ-764 https://lex.uz/docs/-5960604 ; 3573-Nizom (ekspertiza) https://www.lex.uz/uz/docs/-7222910 ; 3574-Nizom (sertifikatlash) https://lex.uz/uz/docs/-7223533 ; PF-38 (10.03.2026 strategiya) https://lex.uz/uz/docs/-8079286
- E-IMZO integratsiya: https://github.com/qo0p/e-imzo-doc
- Maoshlar: https://t.me/s/uzdev_jobs , https://tashkent.hh.uz/vacancy/132534232 , https://flexa.jobs/guides/average-salaries-in-uzbekistan , https://stateofdev.uz/
