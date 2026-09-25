#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Simple Ground — instalasi pertama di VPS Ubuntu 22.04/24.04 atau Debian 12.
#
#  Pemakaian (sebagai root):
#    curl -fsSL https://raw.githubusercontent.com/simpleground/sgstore/main/deploy/setup-vps.sh -o setup-vps.sh
#    sudo bash setup-vps.sh simpleground.online https://github.com/simpleground/sgstore.git
#
#  Repo privat? Pakai URL dengan token:
#    https://<USERNAME>:<GITHUB_TOKEN>@github.com/simpleground/sgstore.git
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-}"
REPO="${2:-https://github.com/simpleground/sgstore.git}"
APP_USER="sgstore"
APP_DIR="/var/www/sgstore"
DB_NAME="sgstore"
DB_USER="sgstore"

if [[ $EUID -ne 0 ]]; then echo "Jalankan dengan sudo/root."; exit 1; fi
if [[ -z "$DOMAIN" ]]; then echo "Pemakaian: sudo bash setup-vps.sh DOMAIN [REPO_URL]"; exit 1; fi

step() { echo; echo "==> $*"; }

step "Update sistem & install paket dasar"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg nginx postgresql ufw certbot python3-certbot-nginx openssl

step "Install Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1)" != "v22" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v
npm install -g pm2@latest

step "Buat user aplikasi '$APP_USER'"
id "$APP_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$APP_USER"

step "Siapkan database PostgreSQL"
systemctl enable --now postgresql
DB_PASS="$(openssl rand -hex 16)"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
else
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

step "Ambil kode dari GitHub"
if [[ -d "$APP_DIR/.git" ]]; then
  sudo -H -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  mkdir -p "$APP_DIR"
  chown "$APP_USER:$APP_USER" "$APP_DIR"
  sudo -H -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi

step "Buat file .env"
ENV_FILE="$APP_DIR/.env"
ADMIN_PASS="$(openssl rand -hex 8)"
if [[ -f "$ENV_FILE" ]]; then
  # Keep existing settings, only refresh the database password we just set.
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME#" "$ENV_FILE"
  ADMIN_PASS="$(grep -E '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
  # Older .env files have no encryption key yet: add one (never replace an existing one).
  if ! grep -qE '^APP_ENCRYPTION_KEY=.{32,}' "$ENV_FILE"; then
    sed -i '/^APP_ENCRYPTION_KEY=/d' "$ENV_FILE"
    echo "APP_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
  fi
else
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  sed -i \
    -e "s#^SITE_URL=.*#SITE_URL=https://$DOMAIN#" \
    -e "s#^DATABASE_URL=.*#DATABASE_URL=postgres://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME#" \
    -e "s#^ADMIN_EMAIL=.*#ADMIN_EMAIL=admin@$DOMAIN#" \
    -e "s#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=$ADMIN_PASS#" \
    -e "s#^APP_ENCRYPTION_KEY=.*#APP_ENCRYPTION_KEY=$(openssl rand -hex 32)#" \
    -e "s#^STORAGE_LOCAL_DIR=.*#STORAGE_LOCAL_DIR=$APP_DIR/storage#" \
    -e "s#^MIDTRANS_IS_PRODUCTION=.*#MIDTRANS_IS_PRODUCTION=true#" \
    -e "s#^BITESHIP_MODE=.*#BITESHIP_MODE=#" \
    "$ENV_FILE"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

step "Install dependency, migrasi database, build"
cd "$APP_DIR"
sudo -H -u "$APP_USER" npm ci
sudo -H -u "$APP_USER" npm run db:migrate
sudo -H -u "$APP_USER" npm run build

step "Jalankan aplikasi dengan PM2 (auto-start saat reboot)"
sudo -H -u "$APP_USER" pm2 startOrReload ecosystem.config.cjs --update-env
sudo -H -u "$APP_USER" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

step "Konfigurasi Nginx"
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$APP_DIR/deploy/nginx-sgstore.conf" > /etc/nginx/sites-available/sgstore
ln -sf /etc/nginx/sites-available/sgstore /etc/nginx/sites-enabled/sgstore
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

step "Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo
echo "────────────────────────────────────────────────────────────"
echo " Selesai! Langkah berikutnya:"
echo "  1. Arahkan DNS domain $DOMAIN (A record) ke IP VPS ini."
echo "  2. Aktifkan HTTPS:  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Lengkapi kunci Midtrans/Biteship di $ENV_FILE lalu:"
echo "       sudo -u $APP_USER bash -c 'cd $APP_DIR && npm run build && pm2 reload sgstore'"
ADMIN_MAIL="$(grep -E '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-)"
echo "  4. Buka https://$DOMAIN/admin/login  ->  email: $ADMIN_MAIL  password: $ADMIN_PASS"
echo "────────────────────────────────────────────────────────────"
