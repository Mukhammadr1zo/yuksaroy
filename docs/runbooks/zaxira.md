# Zaxira: shifrlangan tashqi nusxa va tiklash mashqi

Egasi qarori 2026-11-02: bitta diskdagi zaxira zaxira emas. Har kuni zaxiradan keyin baza dumpi (va 45 MB dan kichik bo'lsa yuklangan fayllar arxivi) parol bilan shifrlanib, shaxsiy Telegram chatiga yuboriladi. Yuklangan fayllarda pasport va dalillar bor, shuning uchun ular ham shifrlanadi.

## Bir martalik sozlash (egasi)

1. Telegramda faqat o'zingiz a'zo bo'lgan shaxsiy chat yoki yopiq guruh oching, botni unga qo'shing. Chat raqamini oling (guruh uchun `-100...` bilan boshlanadi).
2. Uzun parol yarating va uni parol menejeriga saqlang. Parol yo'qolsa nusxalarni ochib bo'lmaydi.
   ```bash
   openssl rand -base64 32
   ```
3. Serverga kirib, `.env` ga ikki qator qo'shing. Sirlar GitHub secrets orqali emas, serverdagi `.env` da turadi (deploy.yml uni sirlardan yozmaydi):
   ```bash
   cd /opt/yuksaroy
   printf '\n%s\n%s\n' 'BACKUP_CHAT_ID=<chat raqami>' 'BACKUP_PASSPHRASE=<parol>' >> .env
   chmod 600 .env
   ```
   Qiymatlarni qo'shtirnoqsiz yozing (parol qo'shtirnoq bilan shifrlanib qoladi).
   Ikkalasidan biri yo'q bo'lsa tashqi nusxa jim o'tkazib yuboriladi (jurnalda bir qator).
4. Tekshirish: `systemctl start yuksaroy-backup.service`, so'ng chatda `db_....dump.enc` fayli paydo bo'lishi kerak. Fayl 45 MB dan katta bo'lsa u yuborilmaydi, `ALERT_CHAT_ID` ga ogohlantirish keladi.

Deployda olinadigan zaxira Telegramga yuborilmaydi (`OFFSITE=0`), faqat kunlik taymer yuboradi.

## Nusxani ochish va tiklash

Telegramdan `.enc` faylni yuklab oling, so'ng:

```bash
export BACKUP_PASSPHRASE='<parol>'
# ochish
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
  -in db_2026-11-02_2138.dump.enc -out db.dump
# yuklangan fayllar arxivi ham xuddi shunday: uploads_....tgz.enc -> uploads.tgz

# sinash: vaqtinchalik konteynerda (ishlayotgan bazaga tegmaydi)
/opt/yuksaroy/deploy/restore.sh db.dump
# yoki .enc faylning o'zini bering, BACKUP_PASSPHRASE o'zgaruvchisi bilan ochiladi
```

Haqiqiy tiklash (baza yo'qolganda): avval `api`, `web`, `bot` ni to'xtating (`docker compose ... stop api web bot`), so'ng `docker exec -i yuksaroy-db-1 pg_restore -U yuksaroy -d yuksaroy --no-owner --clean --if-exists < db.dump`. Fayllar: `docker run --rm -v yuksaroy_uploads:/data -v "$PWD":/b alpine tar xzf /b/uploads.tgz -C /data`.

## Oylik tiklash mashqi (bir marta o'rnatiladi)

Har oyning 1-kuni 22:30 UTC da eng yangi dump vaqtinchalik `postgres:17-bookworm` konteynerida tiklanadi, natija `ALERT_CHAT_ID` ga yoziladi. O'rnatish ikki buyruq:

```bash
cp /opt/yuksaroy/deploy/systemd/yuksaroy-restore-drill.{service,timer} /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now yuksaroy-restore-drill.timer
```

Darhol sinash: `systemctl start yuksaroy-restore-drill.service && journalctl -u yuksaroy-restore-drill.service -n 20`.

## Sog'liq tekshiruvi ogohlantirishlari

`healthcheck.sh` har 5 daqiqada tekshiradi va har hodisa uchun bir marta yozadi: eng yangi dump 26 soatdan eski yoki oldingisining yarmidan kichik; bot konteyneri ishlamayapti; botning `RestartCount` oshdi. Zaxira skripti o'zi yiqilsa ham xabar yuboradi.

## Loglar (journald)

api, web va bot loglari journald ga yoziladi va konteyner qayta yaratilganda ham saqlanadi. Ko'rish: `journalctl CONTAINER_NAME=yuksaroy-api-1 -n 100`. Qayta yuklashdan keyin ham qolishi uchun bir marta: `mkdir -p /var/log/journal && systemctl restart systemd-journald`.
