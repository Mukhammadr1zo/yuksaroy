#!/usr/bin/env bash
# Shifrlangan tashqi nusxa: zaxira fayllari parol bilan shifrlanib, shaxsiy Telegram chatiga
# yuboriladi. Bitta diskdagi zaxira zaxira emas (disk o'lsa u ham ketadi). 2026-11-02 egasi qarori.
# Ishlatish: offsite.sh [db_fayl] [uploads_fayl]  (bermasa eng yangilari olinadi)
# Sozlamalar /opt/yuksaroy/.env dan: BOT_TOKEN, BACKUP_CHAT_ID, BACKUP_PASSPHRASE, ALERT_CHAT_ID.
# Bu skript hech qachon zaxirani yiqitmaydi: xato bo'lsa ALERT_CHAT_ID ga xabar beradi va 0 qaytaradi.
set -uo pipefail

ENV_FILE="${ENV_FILE:-/opt/yuksaroy/.env}"
DIR="${BACKUP_DIR:-/var/backups/yuksaroy}"
# Telegram Bot API fayl chegarasi 50 MB; shifrlash bir necha bayt qo'shadi, 45 MB xavfsiz zaxira
MAX_BYTES="${OFFSITE_MAX_BYTES:-47185920}"

val() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r'; }
TOKEN="$(val BOT_TOKEN)"
CHAT="$(val BACKUP_CHAT_ID)"
ALERT="$(val ALERT_CHAT_ID)"
# Parol faqat muhit orqali (-pass env:) o'tadi: buyruq qatorida ko'rinmaydi, hech qayerga chop etilmaydi
BACKUP_PASS="$(val BACKUP_PASSPHRASE)"
export BACKUP_PASS

if [ -z "$TOKEN" ] || [ -z "$CHAT" ] || [ -z "$BACKUP_PASS" ]; then
  echo "tashqi nusxa sozlanmagan (BACKUP_CHAT_ID/BACKUP_PASSPHRASE), o'tkazib yuborildi"
  exit 0
fi

alert() {
  [ -n "$ALERT" ] || return 0
  curl -sS -m 20 -o /dev/null -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
    --data-urlencode "chat_id=$ALERT" --data-urlencode "text=$1" 2>/dev/null || true
}

DB="${1:-$(ls -t "$DIR"/db_*.dump 2>/dev/null | head -1)}"
UP="${2:-$(ls -t "$DIR"/uploads_*.tgz 2>/dev/null | head -1)}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

send() { # send <fayl>
  local src="$1" name out
  name="$(basename "$src")"
  [ -f "$src" ] || { alert "Tashqi nusxa: $name topilmadi."; return; }
  if [ "$(stat -c %s "$src")" -gt "$MAX_BYTES" ]; then
    alert "Tashqi nusxa o'tkazib yuborildi: $name 45 MB dan katta ($(du -h "$src" | cut -f1)). Boshqa joyga olish kerak."
    return
  fi
  out="$TMP/$name.enc"
  if ! openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASS -in "$src" -out "$out" 2>/dev/null; then
    alert "Tashqi nusxa: $name shifrlanmadi."
    return
  fi
  if curl -sS -m 600 -X POST "https://api.telegram.org/bot$TOKEN/sendDocument" \
       -F "chat_id=$CHAT" -F "caption=$name.enc" -F "document=@$out" 2>/dev/null | grep -q '"ok":true'; then
    echo "tashqi nusxa yuborildi: $name.enc"
  else
    alert "Tashqi nusxa yuborilmadi: $name (Telegram rad etdi yoki aloqa yo'q)."
  fi
  rm -f "$out"
}

[ -n "$DB" ] && send "$DB"
[ -n "$UP" ] && send "$UP"
exit 0
