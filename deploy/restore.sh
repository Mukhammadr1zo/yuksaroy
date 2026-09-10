#!/usr/bin/env bash
# Tiklash mashqi: zaxiradan bo'sh bazaga qaytarish va sanoqni tekshirish.
# Oyiga bir marta yuritiladi, aks holda zaxira borligi hech narsani anglatmaydi.
# Ishlatish: ./deploy/restore.sh /var/backups/yuksaroy/db_2026-09-10_0200.dump
set -euo pipefail

DUMP="${1:?dump fayl yo'lini bering}"
DB_SERVICE="${DB_SERVICE:-yuksaroy-db-1}"
PG_USER="${POSTGRES_USER:-yuksaroy}"
CHECK_DB="${CHECK_DB:-yuksaroy_restore_check}"

echo "1) sinov bazasi: $CHECK_DB"
docker exec "$DB_SERVICE" psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS $CHECK_DB;" >/dev/null
docker exec "$DB_SERVICE" psql -U "$PG_USER" -d postgres -c "CREATE DATABASE $CHECK_DB;" >/dev/null

echo "2) tiklash"
docker exec -i "$DB_SERVICE" pg_restore -U "$PG_USER" -d "$CHECK_DB" --no-owner < "$DUMP"

echo "3) sanoq (bo'sh bo'lsa zaxira yaroqsiz)"
docker exec "$DB_SERVICE" psql -U "$PG_USER" -d "$CHECK_DB" -c \
  'SELECT (SELECT count(*) FROM "Order") AS buyurtma, (SELECT count(*) FROM "Listing") AS elon, (SELECT count(*) FROM "Siding") AS shahobcha, (SELECT count(*) FROM "Terminal") AS terminal, (SELECT count(*) FROM "User") AS foydalanuvchi;'

echo "4) tozalash"
docker exec "$DB_SERVICE" psql -U "$PG_USER" -d postgres -c "DROP DATABASE $CHECK_DB;" >/dev/null
echo "tiklash mashqi muvaffaqiyatli"
