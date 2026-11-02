#!/usr/bin/env bash
# Sayt tirikmi: nginx, TLS va konteynerlar zanjirini to'liq tekshiradi (localhost porti emas,
# haqiqiy ommaviy manzil). Ikki marta ketma-ket yiqilsa Telegramga bir marta xabar ketadi,
# tiklanganda yana bir marta. Har tekshiruvda emas: aks holda xabar oqimi foydasiz bo'lib qoladi.
#
# Sozlamalar /opt/yuksaroy/.env dan: BOT_TOKEN va ALERT_CHAT_ID.
# systemd taymeri har 5 daqiqada chaqiradi.
set -uo pipefail

ENV_FILE="${ENV_FILE:-/opt/yuksaroy/.env}"
BASE="${BASE_URL:-https://yuksaroy.uz}"
STATE_DIR="${STATE_DIR:-/var/lib/yuksaroy}"
THRESHOLD="${THRESHOLD:-2}"

mkdir -p "$STATE_DIR"
STATE="$STATE_DIR/health.state"
FAILS="$STATE_DIR/health.fails"
# Uzilish yozuvi: faqat holat almashganda bitta qator. Shartlardagi "ishlamagan kunlar
# obuna muddatiga qo'shiladi" va'dasini hisoblash uchun boshqa manba yo'q edi.
LOG="$STATE_DIR/outages.log"

# .env dagi qiymatlar (faqat kerakli ikkitasi, qolganini muhitga chiqarmaymiz)
val() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r'; }
TOKEN="$(val BOT_TOKEN)"
CHAT="$(val ALERT_CHAT_ID)"

notify() {
  [ -n "$TOKEN" ] && [ -n "$CHAT" ] || { echo "ogohlantirish sozlanmagan (BOT_TOKEN/ALERT_CHAT_ID)"; return 0; }
  curl -sS -m 20 -o /dev/null -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
    --data-urlencode "chat_id=$CHAT" --data-urlencode "text=$1" || true
}

# --- Zaxira va bot tekshiruvlari (2026-11-02). Har hodisa uchun BIR marta xabar:
# holat $STATE_DIR/alert.<kalit> faylida, muammo hal bo'lganda fayl o'chadi.
BACKUP_DIR="${BACKUP_DIR:-/var/backups/yuksaroy}"
BOT_CONTAINER="${BOT_CONTAINER:-yuksaroy-bot-1}"
incident() { # incident <kalit> <id> <matn>: id o'zgarmaguncha qayta yozmaydi
  local f="$STATE_DIR/alert.$1"
  [ "$(cat "$f" 2>/dev/null)" = "$2" ] && return 0
  notify "$3"; echo "$2" > "$f"
}
resolved() { rm -f "$STATE_DIR/alert.$1"; }

# 1) eng yangi dump 26 soatdan eski yoki oldingisining yarmidan kichik
mapfile -t DUMPS < <(ls -t "$BACKUP_DIR"/db_*.dump 2>/dev/null | head -2)
if [ "${#DUMPS[@]}" -eq 0 ]; then
  incident backup none "Zaxira topilmadi: $BACKUP_DIR da db_*.dump yo'q."
elif [ -n "$(find "${DUMPS[0]}" -mmin +1560)" ]; then
  incident backup "${DUMPS[0]}" "Zaxira eskirgan: eng yangisi $(basename "${DUMPS[0]}"), 26 soatdan oldin."
elif [ "${#DUMPS[@]}" -eq 2 ] && [ "$(( $(stat -c %s "${DUMPS[0]}") * 2 ))" -lt "$(stat -c %s "${DUMPS[1]}")" ]; then
  incident backup "${DUMPS[0]}" "Zaxira shubhali: $(basename "${DUMPS[0]}") oldingisining yarmidan kichik."
else
  resolved backup
fi

# 2) bot konteyneri ishlayaptimi, 3) qayta ishga tushishlar soni oshdimi
if command -v docker >/dev/null 2>&1; then
  running="$(docker inspect -f '{{.State.Running}}' "$BOT_CONTAINER" 2>/dev/null || echo missing)"
  if [ "$running" = true ]; then
    resolved bot
    rc="$(docker inspect -f '{{.RestartCount}}' "$BOT_CONTAINER" 2>/dev/null || echo 0)"
    last="$(cat "$STATE_DIR/bot.restarts" 2>/dev/null || echo "$rc")"
    # Qayta ishga tushish aylanishida har 5 daqiqada yozmaslik uchun kuniga bir marta
    [ "$rc" -gt "$last" ] && incident botrestart "$(date +%F)" "Bot qayta ishga tushdi (RestartCount $last dan $rc ga). docker logs $BOT_CONTAINER"
    echo "$rc" > "$STATE_DIR/bot.restarts"
  else
    incident bot "$running" "Bot konteyneri ishlamayapti ($BOT_CONTAINER: $running)."
  fi
fi

code() { local c; c="$(curl -sS -k -o /dev/null -m 15 -w '%{http_code}' "$1" 2>/dev/null)"; echo "${c:-000}"; }

WEB="$(code "$BASE/")"
API="$(code "$BASE/v1/health")"

prev="$(cat "$STATE" 2>/dev/null || echo ok)"
n="$(cat "$FAILS" 2>/dev/null || echo 0)"

if [ "$WEB" = 200 ] && [ "$API" = 200 ]; then
  echo 0 > "$FAILS"
  if [ "$prev" = fail ]; then
    notify "✅ yuksaroy.uz qayta ishlayapti."
    echo "$(date -u +%FT%TZ) tiklandi" >> "$LOG"
  fi
  echo ok > "$STATE"
  exit 0
fi

n=$((n + 1))
echo "$n" > "$FAILS"
echo "tekshiruv muvaffaqiyatsiz ($n/$THRESHOLD): web=$WEB api=$API"

# Bir martalik uzilish (masalan konteyner qayta ishga tushishi) xabar qilinmaydi
if [ "$n" -ge "$THRESHOLD" ] && [ "$prev" != fail ]; then
  notify "🔴 yuksaroy.uz javob bermayapti.
web: $WEB
api: $API
Server: 89.39.94.99"
  echo "$(date -u +%FT%TZ) yiqildi web=$WEB api=$API" >> "$LOG"
  echo fail > "$STATE"
fi
