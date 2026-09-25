#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Tambah domain sendiri untuk sebuah toko di VPS (Nginx + sertifikat SSL).
#
#  Urutan:
#    1. Tambahkan domain toko di panel /platform.
#    2. Arahkan DNS domain (A record @ dan www) ke IP VPS, tunggu sampai aktif.
#    3. sudo bash /var/www/sgstore/deploy/add-domain.sh tokoanda.com
#
#  Skrip ini membuat server block Nginx untuk domain tersebut (proxy ke
#  aplikasi yang sama) lalu meminta sertifikat Let's Encrypt lewat Certbot.
#  Aplikasi memilih toko dari nama domain, jadi tidak perlu restart aplikasi.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="$(echo "${1:-}" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')"
if [[ $EUID -ne 0 ]]; then echo "Jalankan dengan sudo/root."; exit 1; fi
if [[ ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "Pemakaian: sudo bash add-domain.sh tokoanda.com"; exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONF="/etc/nginx/sites-available/sgstore-$DOMAIN"

echo "==> Nginx untuk $DOMAIN dan www.$DOMAIN"
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$APP_DIR/deploy/nginx-sgstore.conf" > "$CONF"
ln -sf "$CONF" "/etc/nginx/sites-enabled/sgstore-$DOMAIN"
nginx -t
systemctl reload nginx

echo "==> Sertifikat SSL (Certbot)"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect

echo
echo "Selesai: https://$DOMAIN"
echo "Jangan lupa:"
echo "  - Google Cloud Console → Authorized JavaScript origins: tambahkan https://$DOMAIN (login Google)."
echo "  - Bila toko memakai Midtrans: Payment Notification URL = https://$DOMAIN/api/payments/midtrans/notification"
