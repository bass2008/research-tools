#!/usr/bin/env bash
# Выложить текущее дерево на тестовый контур test.arcana-sense.ru.
#
# Образы свои, с тегом test-*: так фичу проверяют агентами до того, как она уедет на прод. База
# тоже своя, платежи идут через тестовый терминал банка, счётчик Метрики в сборку не попадает.
set -euo pipefail
cd "$(dirname "$0")/.."

scripts/assert-release-candidate.sh

SITE=https://test.arcana-sense.ru
IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
REGISTRY="${ARCANA_REGISTRY:-cr.selcloud.ru/arcana}"
TAG="test-$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || TZ=Europe/Moscow date '+-%H%M')"

# Тестовый домен закрыт Basic Auth. Берём те же локальные реквизиты, которыми bootstrap
# создаёт /etc/nginx/.htpasswd-test на сервере; пароль в репозиторий и вывод не попадает.
AUTH_ENV="${ARCANA_TEST_AUTH_ENV:-$HOME/.config/arcana/test-auth.env}"
test -r "$AUTH_ENV" || { echo "нет реквизитов Basic Auth: $AUTH_ENV" >&2; exit 1; }
. "$AUTH_ENV"
: "${TEST_BASIC_USER:?в $AUTH_ENV не задан TEST_BASIC_USER}"
: "${TEST_BASIC_PASSWORD:?в $AUTH_ENV не задан TEST_BASIC_PASSWORD}"
TEST_CURL=(curl --fail --silent --show-error --user "$TEST_BASIC_USER:$TEST_BASIC_PASSWORD")

CRAAS_ENV="${CRAAS_ENV:-$HOME/.config/arcana/craas.env}"
test -r "$CRAAS_ENV" || { echo "нет реквизитов реестра: $CRAAS_ENV" >&2; exit 1; }
set -a; . "$CRAAS_ENV"; set +a

export SITE_URL="$SITE" BUILD_COMMIT="$TAG" BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
# Та же метка машинным форматом. Заголовок `Last-Modified` сайт больше не отдаёт (Decision 8),
# метка осталась только для админской таблицы настроек.
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

ZSTD="compression=zstd,compression-level=10,force-compression=true"

echo "== сборка и отправка $TAG"
echo "$CRAAS_TOKEN" | docker login cr.selcloud.ru -u "$CRAAS_USER" --password-stdin >/dev/null
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
  --build-arg "BUILD_ISO=$BUILD_ISO" \
  --output "type=image,name=$REGISTRY/web:$TAG,$ZSTD" ../web

echo "== запуск на $IP"
scp -q -o StrictHostKeyChecking=accept-new docker-compose.test.yml "$SSH_USER@$IP:/srv/arcana/docker-compose.test.yml"
# Браузер печати тестовый контур берёт у прода, поэтому свой образ browser ему нужен только как
# запас — сервис в docker-compose.test.yml не поднимается. Чистка сразу после старта: на тесте
# откатываться незачем, а сборок в день бывает несколько, и диск машины 20 ГБ.
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "cd /srv/arcana \
  && sed -i '/^TEST_TAG=/d' .env.test 2>/dev/null || true \
  && printf 'REGISTRY=%s\nTAG=%s\n' '$REGISTRY' '$TAG' > .env.test.tag \
  && (docker network create arcana-print >/dev/null 2>&1 || true) \
  && /usr/local/bin/arcana-registry-login \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-test -f docker-compose.test.yml pull -q \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-test -f docker-compose.test.yml up -d --wait \
  && docker image prune -a -f >/dev/null"

echo "== проверка"
until "${TEST_CURL[@]}" -o /dev/null "$SITE/"; do sleep 3; done
"${TEST_CURL[@]}" "$SITE/version/current.txt"
mkdir -p ../reports/unified
git rev-parse HEAD > ../reports/unified/tested-commit.txt
echo "готово: $SITE"
