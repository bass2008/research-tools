#!/usr/bin/env bash
# Поднять копию прода на машине Selectel. Повторяет то, что в Yandex Cloud делает cloud-init
# (terraform/server/cloud-init.yaml.tftpl), но под здешние условия: пользователь root, вход в
# реестр по паролю вместо IAM-токена из метаданных, TLS пока нет — домен ещё смотрит на Яндекс.
set -euo pipefail
cd "$(dirname "$0")"

IP="${1:?укажи адрес машины}"
TAG="${TAG:-b3112b6}"
APP=/srv/arcana
SWAP_MB="${SWAP_MB:-2048}"
SECRETS="${SECRETS:-$HOME/.config/arcana/srv-backup}"

set -a
. "$HOME/.config/arcana/craas.env"
. "$HOME/.config/arcana/r2.env"
set +a

echo "== пакеты и swap на $IP"
ssh -o StrictHostKeyChecking=accept-new "root@$IP" "bash -s" <<EOS
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx docker.io docker-compose-v2 jq curl python3-certbot-nginx >/dev/null
swapon --show | grep -q /swapfile || {
  fallocate -l ${SWAP_MB}M /swapfile && chmod 600 /swapfile && mkswap -q /swapfile
  swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
}
mkdir -p $APP/static $APP/static-test /var/www/certbot/.well-known/acme-challenge
docker network create arcana-print >/dev/null 2>&1 || true
systemctl enable --now docker >/dev/null 2>&1
EOS

echo "== вход в реестр"
ssh "root@$IP" "echo '$CRAAS_TOKEN' | docker login cr.selcloud.ru -u '$CRAAS_USER' --password-stdin >/dev/null && echo '  ок'"

echo "== раскладка и секреты"
scp -q ../compose/docker-compose.yml "root@$IP:$APP/docker-compose.yml"
scp -q "$SECRETS/.env" "root@$IP:$APP/.env"
ssh "root@$IP" "bash -s" <<EOS
set -e
cd $APP
chmod 600 .env
sed -i '/^REGISTRY=/d;/^TAG=/d;/^REGISTRY_ID=/d;/^SITE_URL=/d;/^SESSION_COOKIE_SECURE=/d;/^MONITORING_FOLDER=/d' .env
cat >> .env <<'ENV'
REGISTRY=cr.selcloud.ru/arcana
TAG=$TAG
BUILD_COMMIT=$TAG
# домен пока смотрит на Яндекс: ходим по адресу, кука secure по http не дойдёт
SITE_URL=http://$IP
SESSION_COOKIE_SECURE=0
# метрики машины уезжали в Yandex Cloud по токену из метаданных, здесь их нет
MONITORING_FOLDER=
ENV
EOS

echo "== служба и nginx"
ssh "root@$IP" "bash -s" <<'EOS'
set -e
cat > /etc/systemd/system/arcana.service <<'UNIT'
[Unit]
Description=Arcana Sense (docker compose)
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/arcana
ExecStart=/usr/bin/docker compose up -d --wait
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/nginx/conf.d/arcana-tuning.conf <<'TUNE'
server_tokens off;
client_max_body_size 2m;
gzip_vary on;
gzip_proxied any;
gzip_min_length 1024;
gzip_types text/plain text/css application/javascript application/json image/svg+xml application/xml;
TUNE

cat > /etc/nginx/sites-available/arcana.conf <<'SITE'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Проверка владения доменом при выпуске и продлении сертификата идёт по http.
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        access_log off;
    }

    location /_next/static/ {
        alias /srv/arcana/static/;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 200s;
    }
}
SITE

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/arcana.conf /etc/nginx/sites-enabled/arcana.conf
nginx -t >/dev/null && systemctl enable --now nginx >/dev/null 2>&1 && systemctl reload nginx
systemctl daemon-reload && systemctl enable arcana >/dev/null 2>&1
EOS

echo "== расписание досверки"
./apply-cron.sh "$IP"

echo "== образы и запуск"
ssh "root@$IP" "cd $APP && docker compose pull -q && systemctl restart arcana && sleep 5 && docker compose ps --format '  {{.Name}} {{.State}}'"

echo "== проверка"
for i in $(seq 1 30); do
    curl -sf -o /dev/null "http://$IP/" && break
    sleep 3
done
echo "  главная: $(curl -s -o /dev/null -w '%{http_code}' "http://$IP/")"
echo "  версия:  $(curl -s "http://$IP/version/current.txt" | tr '\n' ' ')"
echo "готово: http://$IP"
