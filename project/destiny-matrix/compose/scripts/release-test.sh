#!/usr/bin/env bash
# Выложить текущее дерево на тестовый контур test.arcana-sense.ru.
#
# Образы свои, с тегом test-*: так фичу проверяют агентами до того, как она уедет на прод. База
# тоже своя, платежи идут через тестовый терминал банка, счётчик Метрики в сборку не попадает.
set -euo pipefail
cd "$(dirname "$0")/.."

scripts/assert-release-candidate.sh

SITE=https://test.arcana-sense.ru
IP=84.201.157.100
REGISTRY=cr.yandex/crp68mnbmb6e88p35jsq
TAG="test-$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || TZ=Europe/Moscow date '+-%H%M')"

export SITE_URL="$SITE" BUILD_COMMIT="$TAG" BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"

ZSTD="compression=zstd,compression-level=10,force-compression=true"

echo "== сборка и отправка $TAG"
yc container registry configure-docker >/dev/null
docker buildx build --push -f api.Dockerfile \
  --output "type=image,name=$REGISTRY/api:$TAG,$ZSTD" ..
docker buildx build --push -f browser.Dockerfile \
  --output "type=image,name=$REGISTRY/browser:$TAG,$ZSTD" .
# NEXT_PUBLIC_METRIKA_ID не передаём намеренно: тестовые визиты не должны попадать в статистику
docker buildx build --push -f web.Dockerfile \
  --build-arg "NEXT_PUBLIC_SITE_URL=$SITE" \
  --build-arg "BUILD_COMMIT=$BUILD_COMMIT" \
  --build-arg "BUILD_BRANCH=$BUILD_BRANCH" \
  --build-arg "BUILD_TIME=$BUILD_TIME" \
  --output "type=image,name=$REGISTRY/web:$TAG,$ZSTD" ../web

echo "== запуск на $IP"
scp -q -o StrictHostKeyChecking=accept-new docker-compose.test.yml "ubuntu@$IP:/srv/arcana/docker-compose.test.yml"
# Браузер печати тестовый контур берёт у прода, поэтому свой образ browser ему нужен только как
# запас — сервис в docker-compose.test.yml не поднимается. Чистка сразу после старта: на тесте
# откатываться незачем, а сборок в день бывает несколько, и диск машины 20 ГБ.
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" "cd /srv/arcana \
  && sed -i '/^TEST_TAG=/d' .env.test 2>/dev/null || true \
  && printf 'REGISTRY=%s\nTAG=%s\n' '$REGISTRY' '$TAG' > .env.test.tag \
  && (docker network create arcana-print >/dev/null 2>&1 || true) \
  && /usr/local/bin/arcana-registry-login \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-test -f docker-compose.test.yml pull -q \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-test -f docker-compose.test.yml up -d --wait \
  && docker image prune -a -f >/dev/null"

echo "== проверка"
until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
mkdir -p ../reports/unified
git rev-parse HEAD > ../reports/unified/tested-commit.txt
echo "готово: $SITE"
