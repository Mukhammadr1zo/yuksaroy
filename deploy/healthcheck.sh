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

# .env dagi qiymatlar (faqat kerakli ikkitasi, qolganini muhitga chiqarmaymiz)
val() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r'; }
TOKEN="$(val BOT_TOKEN)"
CHAT="$(val ALERT_CHAT_ID)"

notify() {
  [ -n "$TOKEN" ] && [ -n "$CHAT" ] || { echo "ogohlantirish sozlanmagan (BOT_TOKEN/ALERT_CHAT_ID)"; return 0; }
  curl -sS -m 20 -o /dev/null -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
    --data-urlencode "chat_id=$CHAT" --data-urlencode "text=$1" || true
}

code() { local c; c="$(curl -sS -k -o /dev/null -m 15 -w '%{http_code}' "$1" 2>/dev/null)"; echo "${c:-000}"; }

WEB="$(code "$BASE/")"
API="$(code "$BASE/v1/health")"

prev="$(cat "$STATE" 2>/dev/null || echo ok)"
n="$(cat "$FAILS" 2>/dev/null || echo 0)"

if [ "$WEB" = 200 ] && [ "$API" = 200 ]; then
  echo 0 > "$FAILS"
  if [ "$prev" = fail ]; then
    notify "✅ yuksaroy.uz qayta ishlayapti."
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
  echo fail > "$STATE"
fi
