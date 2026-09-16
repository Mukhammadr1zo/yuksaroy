# Deploy: bitta VPS, Docker Compose, Caddy

Bir domen, bitta server. Web va API bitta origin ostida: brauzer `/api/v1/...` ga murojaat qiladi, Caddy uni NestJS ga uzatadi, shuning uchun httpOnly cookie ishlaydi.

## Nima kerak

- VPS: 2 vCPU, 4 GB RAM, 60 GB SSD (Postgres, obrazlar va zaxira uchun yetadi).
- Domen va DNS A yozuvi serverga qaratilgan.
- Prod uchun alohida Telegram bot (@BotFather). Dev bot bilan bitta token ishlatilsa Telegram 409 beradi va OTP to'xtaydi.

## Birinchi o'rnatish

```bash
# 1) Docker
curl -fsSL https://get.docker.com | sh

# 2) Kod
git clone <repo> /opt/yuksaroy && cd /opt/yuksaroy

# 3) Sirlar
cp deploy/.env.prod.example .env
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # INTERNAL_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD (DATABASE_URL ichida ham yangilang)
nano .env && chmod 600 .env && chown root:root .env

# 4) Ko'tarish (birinchi build ~5 daqiqa)
docker compose -f deploy/compose.prod.yml --env-file .env up -d --build

# 5) Ma'lumot (faqat birinchi marta): stansiyalar, shahobcha yo'llar reestri
docker compose -f deploy/compose.prod.yml exec api node ../../node_modules/tsx/dist/cli.mjs prisma/seed/seed.ts
```

Migratsiyalar API konteyneri ishga tushganda avtomatik qo'llanadi (`prisma migrate deploy`).

## Tekshirish

```bash
curl -sS https://yuksaroy.uz/v1/health          # {"ok":true}
curl -sSI https://yuksaroy.uz | head -5          # 200 va HSTS sarlavhasi
docker compose -f deploy/compose.prod.yml ps     # hammasi healthy yoki running
```

Bot: Telegramda `/start` yuboring, kod so'rovi kelishi kerak. Menyu tugmasi uchun bir marta:

```bash
docker compose -f deploy/compose.prod.yml exec bot node ../../apps/bot/scripts/setup-profile.mjs
```

## Yangilanish

Odatdagi yo'l: GitHub da **Actions > Deploy > Run workflow**. Obrazlar runnerda
quriladi va GHCR ga qo'yiladi, server faqat tortib oladi. Serverda qurilmasligining
sababi: bu yerda yana 24 ta begona konteyner ishlaydi va Next qurilishi xotirani
yeb, ularni yiqitishi mumkin.

Serverda git talab qilinmaydi va `/opt/yuksaroy` git klon emas. Workflow runnerdagi
`deploy` papkasini serverga ko'chiradi, xolos. Ilova kodi butunlay obraz ichida
keladi, migratsiyalar ham. Shu sababli serverga yopiq repoga kirish huquqi kerak emas.
Eski `deploy` papkasining nusxasi har safar `~/ys-deploy-bak-*.tgz` ga olinadi.

Obraz aynan o'sha commit tegi bilan ko'tariladi (`IMAGE_TAG`), ya'ni kod va obraz
hech qachon ajralib qolmaydi.

Qo'lda qurish faqat zaxira yo'l sifatida qoladi. Buning uchun serverda repo kodi
bo'lishi kerak, ya'ni avval uni o'zingiz ko'chirasiz:

```bash
IMAGE_TAG=latest docker compose -f deploy/compose.prod.yml --env-file .env up -d --build
docker image prune -f
```

Web va API alohida konteyner: faqat bittasi o'zgargan bo'lsa `--build web` yoki `--build api` yetadi.

## Zaxira va tiklash

```bash
# Kunlik (cron: 0 2 * * *)
BACKUP_DIR=/var/backups/yuksaroy RCLONE_REMOTE=b2:yuksaroy-backup /opt/yuksaroy/deploy/backup.sh

# Oyiga bir marta mashq: zaxira haqiqatan tiklanadimi
/opt/yuksaroy/deploy/restore.sh /var/backups/yuksaroy/db_<sana>.dump
```

Zaxirasiz tiklab bo'lmaydigan narsalar: hujjat raqamlari ketma-ketligi (`doc_sequences`), buyurtmalar, e'lonlar, 1382 shahobcha yo'l va yuklangan fotolar.

## Nima qayerda

| Narsa | Joy |
|---|---|
| Kod | `/opt/yuksaroy` |
| Sirlar | `/opt/yuksaroy/.env` (chmod 600) |
| Baza | docker volume `yuksaroy_pgdata` |
| Yuklangan fayllar | docker volume `yuksaroy_uploads` |
| TLS sertifikatlar | docker volume `yuksaroy_caddy_data` |
| Loglar | `docker compose logs -f api` va Caddy access log volume ichida |

## Xatolik holatlari

- **Sayt ochilmayapti, sertifikat yo'q**: DNS A yozuvi serverga qaraganini va 80/443 ochiqligini tekshiring (`docker compose logs caddy`).
- **API 500, `P1001`**: baza ko'tarilmagan (`docker compose ps db`), yoki `DATABASE_URL` da host `db` emas.
- **Bot javob bermaydi**: `docker compose logs bot`. `Wrong HTTP URL` bo'lsa `WEB_URL` ommaviy https emas. `409` bo'lsa bitta token ikki joyda ishlayapti.
- **Kirish kodi noto'g'ri deydi**: `JWT_SECRET` almashtirilgan (OTP kodlari shu bilan xeshlanadi). Foydalanuvchi yangi kod so'rasin.
