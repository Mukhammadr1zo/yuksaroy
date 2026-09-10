#!/usr/bin/env bash
# Kunlik zaxira: Postgres dump + yuklangan fayllar. Cron yoki systemd timer bilan 02:00 da.
# Ishlatish: BACKUP_DIR=/var/backups/yuksaroy RCLONE_REMOTE=b2:yuksaroy-backup ./deploy/backup.sh
set -euo pipefail

DIR="${BACKUP_DIR:-/var/backups/yuksaroy}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y-%m-%d_%H%M)"
DB_SERVICE="${DB_SERVICE:-yuksaroy-db-1}"
PG_USER="${POSTGRES_USER:-yuksaroy}"
PG_DB="${POSTGRES_DB:-yuksaroy}"
UPLOADS_VOLUME="${UPLOADS_VOLUME:-yuksaroy_uploads}"

mkdir -p "$DIR"

# 1) Baza: custom format (pg_restore uchun eng qulay)
docker exec "$DB_SERVICE" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$DIR/db_$STAMP.dump"

# 2) Yuklangan fayllar (e'lon fotolari): volume ni tar qilamiz
docker run --rm -v "$UPLOADS_VOLUME":/data -v "$DIR":/backup alpine \
  tar czf "/backup/uploads_$STAMP.tgz" -C /data .

# 3) Tashqi nusxa (ixtiyoriy, lekin bitta disk yetarli emas)
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$DIR/db_$STAMP.dump" "$RCLONE_REMOTE"
  rclone copy "$DIR/uploads_$STAMP.tgz" "$RCLONE_REMOTE"
fi

# 4) Eskilarini tozalash
find "$DIR" -name 'db_*.dump' -mtime "+$KEEP_DAYS" -delete
find "$DIR" -name 'uploads_*.tgz' -mtime "+$KEEP_DAYS" -delete

echo "zaxira tayyor: $DIR/db_$STAMP.dump ($(du -h "$DIR/db_$STAMP.dump" | cut -f1)), uploads_$STAMP.tgz"
