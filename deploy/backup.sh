#!/usr/bin/env bash
# Backup database + foto produk. Simpan 14 hari terakhir.
# Pemakaian:  sudo -u sgstore bash /var/www/sgstore/deploy/backup.sh
# Otomatis tiap malam (crontab -e sebagai user sgstore):
#   30 2 * * * bash /var/www/sgstore/deploy/backup.sh >> /home/sgstore/backup.log 2>&1
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | cut -d= -f2-)"
pg_dump --no-owner --format=custom "$DATABASE_URL" > "$BACKUP_DIR/db-$STAMP.dump"
if [[ -d "$APP_DIR/storage" ]]; then tar -czf "$BACKUP_DIR/storage-$STAMP.tar.gz" -C "$APP_DIR" storage; fi
find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "Backup selesai: $BACKUP_DIR (*-$STAMP.*)"
# Pulihkan database:  pg_restore --clean --no-owner -d "$DATABASE_URL" db-XXXX.dump
