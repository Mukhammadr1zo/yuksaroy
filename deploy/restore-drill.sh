#!/usr/bin/env bash
# Oylik tiklash mashqi: eng yangi dump restore.sh bilan vaqtinchalik konteynerda tiklanadi,
# natija Telegramga (ALERT_CHAT_ID) yoziladi. Taymer: yuksaroy-restore-drill.timer.
set -uo pipefail
ENV_FILE="${ENV_FILE:-/opt/yuksaroy/.env}"
DIR="${BACKUP_DIR:-/var/backups/yuksaroy}"
val() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r'; }
notify() {
  local t c; t="$(val BOT_TOKEN)"; c="$(val ALERT_CHAT_ID)"
  [ -n "$t" ] && [ -n "$c" ] || return 0
  curl -sS -m 20 -o /dev/null -X POST "https://api.telegram.org/bot$t/sendMessage" \
    --data-urlencode "chat_id=$c" --data-urlencode "text=$1" 2>/dev/null || true
}
DUMP="$(ls -t "$DIR"/db_*.dump 2>/dev/null | head -1)"
[ -n "$DUMP" ] || { notify "Tiklash mashqi: zaxira dump topilmadi."; exit 1; }
if LOG="$(bash "$(dirname "$0")/restore.sh" "$DUMP" 2>&1)"; then
  notify "Tiklash mashqi o'tdi: $(basename "$DUMP"). $(echo "$LOG" | grep '^buyurtma=')"
else
  notify "TIKLASH MASHQI YIQILDI: $(basename "$DUMP"). $(echo "$LOG" | tail -3)"
  exit 1
fi
