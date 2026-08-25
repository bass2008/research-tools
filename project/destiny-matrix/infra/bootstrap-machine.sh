#!/usr/bin/env bash
# Поднять машину после пересоздания: секреты, сертификаты, конфиги nginx, пароль тестового домена.
#
# Всё, что cloud-init сделать не может: секреты в git не лежат, а сертификаты выписываются только
# на живой домен. После этого скрипта остаётся запустить релизы (compose/scripts/release-*.sh).
set -euo pipefail
cd "$(dirname "$0")"

IP=${IP:-84.201.157.100}
EMAIL=${EMAIL:-snborodaenko@mail.ru}
SECRETS=${SECRETS:-$HOME/.config/arcana/srv-backup}
AUTH=${AUTH:-$HOME/.config/arcana/test-auth.env}

for f in .env .env.test; do
    [ -f "$SECRETS/$f" ] || { echo "нет $SECRETS/$f — без секретов машина не поднимется"; exit 1; }
done

echo "== ждём, пока cloud-init закончит"
until ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "ubuntu@$IP" \
      "cloud-init status --wait >/dev/null 2>&1 || test -x /usr/local/bin/arcana-registry-login" 2>/dev/null; do
    sleep 10
done

echo "== секреты"
ssh "ubuntu@$IP" "sudo mkdir -p /srv/arcana && sudo chown ubuntu:ubuntu /srv/arcana"
scp -q "$SECRETS/.env" "$SECRETS/.env.test" "ubuntu@$IP:/srv/arcana/"
ssh "ubuntu@$IP" "chmod 600 /srv/arcana/.env /srv/arcana/.env.test"

echo "== сертификаты"
# Плагин nginx сам проверяет владение домена по 80 порту и правит конфиг; наши конфиги ниже
# перезапишут его правки, пути к сертификатам в них уже те же.
ssh "ubuntu@$IP" "sudo certbot certificates 2>/dev/null | grep -q arcana-sense.ru || \
  sudo certbot --nginx --non-interactive --agree-tos -m '$EMAIL' --redirect \
    -d arcana-sense.ru -d www.arcana-sense.ru"
ssh "ubuntu@$IP" "sudo certbot certificates 2>/dev/null | grep -q test.arcana-sense.ru || \
  sudo certbot --nginx --non-interactive --agree-tos -m '$EMAIL' --redirect -d test.arcana-sense.ru"

echo "== пароль тестового домена"
if [ -f "$AUTH" ]; then
    # shellcheck disable=SC1090
    . "$AUTH"
    ssh "ubuntu@$IP" "printf '%s:%s\n' '$TEST_BASIC_USER' \"\$(openssl passwd -apr1 '$TEST_BASIC_PASSWORD')\" \
      | sudo tee /etc/nginx/.htpasswd-test >/dev/null && sudo chmod 640 /etc/nginx/.htpasswd-test \
      && sudo chown root:www-data /etc/nginx/.htpasswd-test"
else
    echo "  нет $AUTH — тестовый домен останется без пароля"
fi

echo "== конфигурация nginx"
IP="$IP" ./deploy-nginx.sh

cat <<'NEXT'
== дальше вручную:
  cd ../compose && ./scripts/release-prod.sh && ./scripts/release-test.sh
NEXT
