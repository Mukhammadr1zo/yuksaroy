#!/usr/bin/env bash
# Tiklash mashqi: zaxirani BO'SH, vaqtinchalik postgres konteyneriga qaytarib sanoqni tekshiradi.
# Ishlayotgan bazaga hech qachon tegmaydi (2026-11-02: avval u ichida sinov bazasi ochilardi).
# Oyiga bir marta yuritiladi (yuksaroy-restore-drill.timer), aks holda zaxira borligi hech narsani anglatmaydi.
# Ishlatish: ./deploy/restore.sh /var/backups/yuksaroy/db_2026-09-10_0200.dump
#   .enc fayl bo'lsa BACKUP_PASSPHRASE muhit o'zgaruvchisi bilan avval ochiladi.
set -euo pipefail

DUMP="${1:?dump fayl manzilini bering}"
IMAGE="${PG_IMAGE:-postgres:17-bookworm}"
NAME="ys-restore-drill-$$"
TMP="$(mktemp -d)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

if [[ "$DUMP" == *.enc ]]; then
  : "${BACKUP_PASSPHRASE:?.enc ochish uchun BACKUP_PASSPHRASE kerak}"
  export BACKUP_PASSPHRASE
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$DUMP" -out "$TMP/db.dump"
  DUMP="$TMP/db.dump"
fi

echo "1) vaqtinchalik konteyner: $NAME"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=drill "$IMAGE" >/dev/null
# TCP orqali kutamiz: postgres image avval faqat unix soketli vaqtinchalik server ishga tushiradi
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break
  sleep 2
done
docker exec "$NAME" pg_isready -h 127.0.0.1 -U postgres >/dev/null
docker exec "$NAME" psql -U postgres -c 'CREATE DATABASE restore_check;' >/dev/null

echo "2) tiklash"
docker cp "$DUMP" "$NAME:/tmp/db.dump"
docker exec "$NAME" pg_restore -U postgres -d restore_check --no-owner /tmp/db.dump

echo "3) sanoq (terminal 0 bo'lsa zaxira yaroqsiz)"
OUT="$(docker exec "$NAME" psql -U postgres -d restore_check -At -F ' ' -c \
  'SELECT (SELECT count(*) FROM "Order"), (SELECT count(*) FROM "Listing"), (SELECT count(*) FROM "Terminal"), (SELECT count(*) FROM "User");')"
read -r ORDERS LISTINGS TERMINALS USERS <<<"$OUT"
echo "buyurtma=$ORDERS elon=$LISTINGS terminal=$TERMINALS foydalanuvchi=$USERS"
[ "${TERMINALS:-0}" -gt 0 ] || { echo "terminal jadvali bo'sh: zaxira yaroqsiz"; exit 1; }

echo "tiklash mashqi muvaffaqiyatli"
