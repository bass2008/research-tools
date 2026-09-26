#!/usr/bin/env bash
# Поднять машину после пересоздания: секреты, токен реестра, сертификаты, конфиги nginx,
# пароль тестового домена.
#
# Идёт после infra/deploy-selectel.sh, который ставит пакеты, docker и временный конфиг nginx.
# Здесь всё, чего тот сделать не может: секреты в git не лежат, а сертификаты выписываются
# только на живой домен. После этого скрипта остаётся запустить релизы.
set -euo pipefail
cd "$(dirname "$0")"

IP=${IP:-45.80.130.166}
SSH_USER=${SSH_USER:-root}
EMAIL=${EMAIL:-snborodaenko@mail.ru}
SECRETS=${SECRETS:-$HOME/.config/arcana/srv-backup}
AUTH=${AUTH:-$HOME/.config/arcana/test-auth.env}
CRAAS_ENV=${CRAAS_ENV:-$HOME/.config/arcana/craas.env}

for f in .env .env.test; do
    [ -f "$SECRETS/$f" ] || { echo "нет $SECRETS/$f — без секретов машина не поднимется"; exit 1; }
done

echo "== секреты"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "mkdir -p /srv/arcana"
scp -q "$SECRETS/.env" "$SECRETS/.env.test" "$SSH_USER@$IP:/srv/arcana/"
ssh "$SSH_USER@$IP" "chmod 600 /srv/arcana/.env /srv/arcana/.env.test"

echo "== вход в реестр"
# Реестр Selectel не отдаёт токен по метаданным машины, как Yandex CR: кладём его файлом.
set -a; . "$CRAAS_ENV"; set +a
ssh "$SSH_USER@$IP" "printf 'CRAAS_USER=%s\nCRAAS_TOKEN=%s\n' '$CRAAS_USER' '$CRAAS_TOKEN' > /root/.craas \
  && chmod 600 /root/.craas"
scp -q arcana-registry-login "$SSH_USER@$IP:/usr/local/bin/arcana-registry-login"
ssh "$SSH_USER@$IP" "chmod 700 /usr/local/bin/arcana-registry-login && /usr/local/bin/arcana-registry-login"

echo "== сертификаты"
# webroot, а не плагин nginx: проверка ходит по http в каталог, конфиги при этом не правятся,
# и продление потом идёт тем же способом само, по таймеру certbot.
ssh "$SSH_USER@$IP" "mkdir -p /var/www/certbot
  certbot certificates 2>/dev/null | grep -q 'Certificate Name: arcana-sense.ru' || \
    certbot certonly --webroot -w /var/www/certbot --non-interactive --agree-tos -m '$EMAIL' \
      --cert-name arcana-sense.ru -d arcana-sense.ru -d www.arcana-sense.ru -d test.arcana-sense.ru
  certbot certificates 2>/dev/null | grep -A4 'Certificate Name: arcana-sense.com' | grep -q 'test.arcana-sense.com' || \
    certbot certonly --webroot -w /var/www/certbot --non-interactive --agree-tos -m '$EMAIL' --expand \
      --cert-name arcana-sense.com -d arcana-sense.com -d test.arcana-sense.com"

echo "== перезагрузка nginx после продления"
ssh "$SSH_USER@$IP" "mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  systemctl enable --now certbot.timer >/dev/null 2>&1 || true"

echo "== фаервол и защита ssh"
# Порты приложения слушают только localhost, наружу нужны три. fail2ban — против перебора:
# вход и так только по ключу, но в логах по три десятка попыток в сутки.
ssh "$SSH_USER@$IP" "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw fail2ban >/dev/null
  ufw default deny incoming >/dev/null && ufw default allow outgoing >/dev/null
  ufw allow 22/tcp >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  printf '[sshd]\nenabled = true\nmaxretry = 5\nfindtime = 10m\nbantime = 1h\n' > /etc/fail2ban/jail.d/sshd.local
  systemctl enable --now fail2ban >/dev/null 2>&1"

echo "== пароль тестового домена"
if [ -f "$AUTH" ]; then
    # shellcheck disable=SC1090
    . "$AUTH"
    ssh "$SSH_USER@$IP" "printf '%s:%s\n' '$TEST_BASIC_USER' \"\$(openssl passwd -apr1 '$TEST_BASIC_PASSWORD')\" \
      > /etc/nginx/.htpasswd-test && chmod 640 /etc/nginx/.htpasswd-test \
      && chown root:www-data /etc/nginx/.htpasswd-test"
else
    echo "  нет $AUTH — тестовый домен останется без пароля"
fi

echo "== конфигурация nginx"
IP="$IP" SSH_USER="$SSH_USER" ./deploy-nginx.sh

cat <<'NEXT'
== дальше вручную:
  cd ../compose && ./scripts/release-prod.sh && ./scripts/release-test.sh
NEXT
