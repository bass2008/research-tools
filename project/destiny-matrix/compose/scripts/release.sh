#!/usr/bin/env bash
# Задеплоить последнюю версию на прод: собрать, отправить в реестр, поднять на машине.
set -euo pipefail
cd "$(dirname "$0")/.."

VM=arcana-app
SITE=https://arcana-sense.ru
IP="$(yc compute instance get --name $VM --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')"
REGISTRY="cr.yandex/$(yc container registry get --name arcana --format json | jq -r .id)"
# из грязного дерева тег дополняем временем: иначе два релиза подряд имеют один тег и pull
# на машине не видит разницы
TAG="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || TZ=Europe/Moscow date '+-dirty%H%M')"

export SITE_URL="$SITE" BUILD_COMMIT="$TAG" BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"

echo "== сборка $TAG"
docker compose build

echo "== отправка в реестр"
yc container registry configure-docker >/dev/null
for svc in api web; do
  docker tag "arcana-$svc:latest" "$REGISTRY/$svc:$TAG"
  docker push -q "$REGISTRY/$svc:$TAG"
done

echo "== запуск на $IP"
scp -q -o StrictHostKeyChecking=accept-new compose.server.yml "ubuntu@$IP:/srv/arcana/docker-compose.yml"
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" "cd /srv/arcana \
  && sudo sed -i '/^TAG=/d;/^REGISTRY=/d' .env \
  && printf 'REGISTRY=%s\nTAG=%s\n' '$REGISTRY' '$TAG' | sudo tee -a .env >/dev/null \
  && /usr/local/bin/arcana-registry-login \
  && sudo docker compose pull -q && sudo systemctl restart arcana"

echo "== проверка"
until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
echo "готово: $SITE"
