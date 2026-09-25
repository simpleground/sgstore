#!/usr/bin/env bash
# Update aplikasi di VPS setelah ada perubahan di GitHub.
# Pemakaian:  sudo -u sgstore bash /var/www/sgstore/deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> git pull";           git pull --ff-only
echo "==> npm ci";             npm ci
echo "==> migrasi database";   npm run db:migrate
echo "==> build";              npm run build
echo "==> restart";            pm2 reload ecosystem.config.cjs --update-env
pm2 save
echo "Selesai. Cek: curl -s http://127.0.0.1:3000/api/health"
