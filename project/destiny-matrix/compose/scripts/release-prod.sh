#!/usr/bin/env bash
# Задеплоить последнюю версию на прод: собрать, отправить в реестр, поднять на машине.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE=https://arcana-sense.ru
IP=84.201.157.100
REGISTRY=cr.yandex/crp68mnbmb6e88p35jsq
# грязное дерево — тег со временем: иначе pull на машине не видит разницы
TAG="$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || TZ=Europe/Moscow date '+-dirty%H%M')"

export SITE_URL="$SITE" BUILD_COMMIT="$TAG" BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"

# Коды подтверждения владения сайтом для Вебмастера и Search Console. Лежат вне репозитория,
# как ключи банка; без файла собирается без метатегов.
[ -f ~/.config/arcana/seo.env ] && { set -a; . ~/.config/arcana/seo.env; set +a; }

# zstd вместо gzip: тяжёлый слой 30 МБ против 191. force-compression обязателен —
# иначе слои из кеша останутся gzip
ZSTD="compression=zstd,compression-level=10,force-compression=true"

echo "== сборка и отправка $TAG"
yc container registry configure-docker >/dev/null
docker buildx build --push -f api.Dockerfile \
  --output "type=image,name=$REGISTRY/api:$TAG,$ZSTD" ..
docker buildx build --push -f browser.Dockerfile \
  --output "type=image,name=$REGISTRY/browser:$TAG,$ZSTD" .
docker buildx build --push -f web.Dockerfile \
  --build-arg "NEXT_PUBLIC_SITE_URL=$SITE" \
  --build-arg "NEXT_PUBLIC_METRIKA_ID=${METRIKA_ID:-111856670}" \
  --build-arg "NEXT_PUBLIC_YANDEX_VERIFICATION=${YANDEX_VERIFICATION:-}" \
  --build-arg "NEXT_PUBLIC_GOOGLE_VERIFICATION=${GOOGLE_VERIFICATION:-}" \
  --build-arg "BUILD_COMMIT=$BUILD_COMMIT" \
  --build-arg "BUILD_BRANCH=$BUILD_BRANCH" \
  --build-arg "BUILD_TIME=$BUILD_TIME" \
  --output "type=image,name=$REGISTRY/web:$TAG,$ZSTD" ../web

echo "== запуск на $IP"
# На машину едет только база: без override там нет ни сборки, ни dev-секретов.
# Всё, кроме systemctl, делает ubuntu: он в группе docker, а .env принадлежит ему. Через sudo
# логин и pull расходились — токен писался в ~ubuntu, а читался из /root.
scp -q -o StrictHostKeyChecking=accept-new docker-compose.yml "ubuntu@$IP:/srv/arcana/docker-compose.yml"
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" "cd /srv/arcana \
  && sed -i '/^TAG=/d;/^REGISTRY=/d;/^BUILD_COMMIT=/d' .env \
  && printf 'REGISTRY=%s\nTAG=%s\nBUILD_COMMIT=%s\n' '$REGISTRY' '$TAG' '$TAG' >> .env \
  && (docker network create arcana-print >/dev/null 2>&1 || true) \
  && /usr/local/bin/arcana-registry-login \
  && docker compose pull -q && sudo systemctl restart arcana \
  && docker image prune -a -f --filter until=24h >/dev/null"
# Диск машины 20 ГБ, каждый релиз добавляет ~2,7 ГБ образов: без чистки он заполнился на 100 %
# и следующий релиз упал на «no space left on device». Чистим после перезапуска, чтобы удалялись
# только образы, которые уже никем не заняты.

echo "== проверка"
until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
echo "готово: $SITE"
