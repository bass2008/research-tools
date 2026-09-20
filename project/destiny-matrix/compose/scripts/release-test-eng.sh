#!/usr/bin/env bash
# Выложить текущее дерево на английский тестовый контур test.arcana-sense.com.
#
# От release-test.sh отличается ровно тремя вещами: язык сборки (en вшивается в образ web),
# витрина без оплаты (кассы за пределами России нет) и свой compose-проект со своей базой.
# Образы помечены test-en-*, чтобы их нельзя было спутать с русскими.
set -euo pipefail
cd "$(dirname "$0")/.."

# Тест выкладывается и из грязного дерева: его смысл — быстро посмотреть правку живьём, а
# коммит делается перед прод-релизом. Незакоммиченное видно по тегу: к нему дописывается время
# сборки, поэтому образ из рабочего дерева нельзя спутать с образом коммита.
if [ -n "$(git status --porcelain -- . ../../tools/seo)" ]; then
  echo "== дерево не чистое: образ будет помечен временем сборки"
fi

# Юнит-тесты того языка, который собираем: красные тесты сборки не выкладываются.
scripts/assert-unit-tests.sh en

SITE=https://test.arcana-sense.com
IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
REGISTRY="${ARCANA_REGISTRY:-cr.selcloud.ru/arcana}"
TAG="test-en-$(git rev-parse --short HEAD)$(git diff --quiet HEAD -- .. || TZ=Europe/Moscow date '+-%H%M')"

# Домен закрыт тем же Basic Auth, что и русский тест: файл паролей на машине один.
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
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

ZSTD="compression=zstd,compression-level=10,force-compression=true"

echo "== сборка и отправка $TAG"
echo "$CRAAS_TOKEN" | docker login cr.selcloud.ru -u "$CRAAS_USER" --password-stdin >/dev/null
docker buildx build --push -f api.Dockerfile \
  --output "type=image,name=$REGISTRY/api:$TAG,$ZSTD" ..
# Язык вшивается в сборку: 5 544 страницы печатаются заранее и сменить язык на запрос не могут.
docker buildx build --push -f web.Dockerfile \
  --build-arg "NEXT_PUBLIC_SITE_URL=$SITE" \
  --build-arg "NEXT_PUBLIC_SITE_LANG=en" \
  --build-arg "NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT=1" \
  --build-arg "BUILD_COMMIT=$BUILD_COMMIT" \
  --build-arg "BUILD_BRANCH=$BUILD_BRANCH" \
  --build-arg "BUILD_TIME=$BUILD_TIME" \
  --build-arg "BUILD_ISO=$BUILD_ISO" \
  --output "type=image,name=$REGISTRY/web:$TAG,$ZSTD" ../web

echo "== запуск на $IP"
scp -q -o StrictHostKeyChecking=accept-new docker-compose.test-en.yml "$SSH_USER@$IP:/srv/arcana/docker-compose.test-en.yml"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "cd /srv/arcana \
  && printf 'REGISTRY=%s\nTAG=%s\n' '$REGISTRY' '$TAG' > .env.test-en.tag \
  && (docker network create arcana-print >/dev/null 2>&1 || true) \
  && /usr/local/bin/arcana-registry-login \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-test-en -f docker-compose.test-en.yml pull -q \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-test-en -f docker-compose.test-en.yml up -d --wait \
  && docker image prune -a -f >/dev/null"

echo "== проверка"
until "${TEST_CURL[@]}" -o /dev/null "$SITE/"; do sleep 3; done
"${TEST_CURL[@]}" "$SITE/version/current.txt"
# Язык и витрина — то, ради чего контур существует: если сборка приехала русской, это видно сразу.
"${TEST_CURL[@]}" "$SITE/" | grep -q '<html lang="en"' || { echo "!! страница не на английском" >&2; exit 1; }
mkdir -p ../reports/unified
# Свидетельство для прод-релиза пишется только из чистого дерева: выкладка правок, которых нет
# в коммите, ничего не говорит о самом коммите, а прод сверяет именно его.
if [ -n "$(git status --porcelain -- . ../../tools/seo)" ]; then
  echo "== дерево не чистое: свидетельство для прода не обновлено"
else
  git rev-parse HEAD > ../reports/unified/tested-commit-en.txt
fi
echo "готово: $SITE"
