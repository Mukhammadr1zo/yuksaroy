#!/usr/bin/env bash
# Joy bazasini (DB-IP City Lite, CC BY 4.0, litsenziya kaliti kerak emas) yuklab qo'yadi.
# Fayl nomi eski bilan bir xil (GeoLite2-City.mmdb): compose.prod.yml va GEOIP_DB o'zgarmaydi.
# API faylni soatiga bir tekshiradi, shuning uchun qayta ishga tushirish shart emas.
#
# Ishlatish:  deploy/geo-update.sh            har safar yuklaydi (oylik taymer)
#             deploy/geo-update.sh --if-missing   fayl bor va 40 kundan yangi bo'lsa tegmaydi (deploy)
set -euo pipefail

DIR="${DIR:-/opt/yuksaroy}"
OUT="$DIR/geo/GeoLite2-City.mmdb"
MIN_BYTES=$((20 * 1024 * 1024))   # DB-IP City Lite ~100+ MB; undan kichigi buzuq javob

log() { echo "geo-update: $*"; }

if [ "${1:-}" = "--if-missing" ] && [ -f "$OUT" ] && [ -z "$(find "$OUT" -mtime +40 2>/dev/null)" ]; then
  log "baza bor va yangi, tegilmadi"
  exit 0
fi

mkdir -p "$DIR/geo"
TMP_GZ="$(mktemp "$DIR/geo/.dl.XXXXXX")"
NEW="$OUT.new"
trap 'rm -f "$TMP_GZ" "$NEW"' EXIT

# Joriy oy, 404 bo'lsa oldingi oy (oyning boshida yangi fayl hali chiqmagan bo'lishi mumkin)
got=0
for ym in "$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-15) -1 month" +%Y-%m)"; do
  if curl -fsSL --retry 3 --connect-timeout 20 --max-time 600 -o "$TMP_GZ" "https://download.db-ip.com/free/dbip-city-lite-$ym.mmdb.gz"; then
    got=1; log "yuklandi: $ym"; break
  fi
done
if [ "$got" != 1 ]; then log "yuklab bo'lmadi, eskisi qoladi"; exit 1; fi

gunzip -c "$TMP_GZ" > "$NEW"
size=$(wc -c < "$NEW")
if [ "$size" -lt "$MIN_BYTES" ]; then
  log "fayl juda kichik ($size bayt), eskisi qoladi"; exit 1
fi

chmod 644 "$NEW"
# mv atomik: API eski faylni o'qiyotgan bo'lsa ham buzilmaydi
mv -f "$NEW" "$OUT"
log "yangilandi: $OUT ($size bayt)"
