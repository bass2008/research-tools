#!/usr/bin/env bash
# Задеплоить последнюю версию на прод: собрать, отправить в реестр, поднять на машине.
set -euo pipefail
cd "$(dirname "$0")/.."

REQUIRE_TEST_EVIDENCE=1 scripts/assert-release-candidate.sh

# Юнит-тесты того языка, который собираем: красные тесты сборки не выкладываются.
scripts/assert-unit-tests.sh ru

SITE=https://arcana-sense.ru
IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
REGISTRY="${ARCANA_REGISTRY:-cr.selcloud.ru/arcana}"
TAG="$(git rev-parse --short HEAD)"

# Реестр Selectel не выдаёт токен по метаданным машины, как это делал Yandex CR: пароль лежит
# в файле вне репозитория и им же логинится машина.
CRAAS_ENV="${CRAAS_ENV:-$HOME/.config/arcana/craas.env}"
test -r "$CRAAS_ENV" || { echo "нет реквизитов реестра: $CRAAS_ENV" >&2; exit 1; }
set -a; . "$CRAAS_ENV"; set +a

export SITE_URL="$SITE" BUILD_COMMIT="$TAG" BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
# Та же метка машинным форматом. Заголовок `Last-Modified` сайт больше не отдаёт (Decision 8),
# метка осталась только для админской таблицы настроек.
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Коды подтверждения владения сайтом для Вебмастера и Search Console. Лежат вне репозитория,
# как ключи банка; без файла собирается без метатегов.
[ -f ~/.config/arcana/seo.env ] && { set -a; . ~/.config/arcana/seo.env; set +a; }

# zstd вместо gzip: тяжёлый слой 30 МБ против 191. force-compression обязателен —
# иначе слои из кеша останутся gzip
ZSTD="compression=zstd,compression-level=10,force-compression=true"

echo "== сборка и отправка $TAG"
echo "$CRAAS_TOKEN" | docker login cr.selcloud.ru -u "$CRAAS_USER" --password-stdin >/dev/null
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
  --build-arg "BUILD_ISO=$BUILD_ISO" \
  --output "type=image,name=$REGISTRY/web:$TAG,$ZSTD" ../web

# Язык развёртки и режим витрины обязательны в compose-файле, а в `.env` на машине их не было:
# любой вызов `docker compose` там падал на интерполяции. Дописываем до снимка — он тоже compose.
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "cd /srv/arcana \
  && sed -i '/^SITE_LANG=/d;/^ALL_FREE_WITHOUT_PAYMENT=/d' .env \
  && printf 'SITE_LANG=ru\nALL_FREE_WITHOUT_PAYMENT=0\n' >> .env"

echo "== диагностический снимок и проверенная копия БД"
# Оба действия read-only относительно рабочей базы. Счета, callback и права продолжают
# обслуживаться текущими контейнерами, пока новые образы уже лежат в registry.
mkdir -p ../reports/unified
scripts/release-snapshot.sh | tee "../reports/unified/prod-before-$TAG.json"
scripts/backup.sh

echo "== запуск на $IP"
# На машину едет только база: без override там нет ни сборки, ни dev-секретов.
scp -q -o StrictHostKeyChecking=accept-new docker-compose.yml "$SSH_USER@$IP:/srv/arcana/docker-compose.yml"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "cd /srv/arcana \
  && (grep -E '^(REGISTRY|TAG|BUILD_COMMIT)=' .env > .env.rollback.candidate 2>/dev/null || true) \
  && sed -i '/^TAG=/d;/^REGISTRY=/d;/^BUILD_COMMIT=/d;/^SITE_LANG=/d;/^ALL_FREE_WITHOUT_PAYMENT=/d' .env \
  && printf 'REGISTRY=%s\nTAG=%s\nBUILD_COMMIT=%s\nSITE_LANG=ru\nALL_FREE_WITHOUT_PAYMENT=0\n' '$REGISTRY' '$TAG' '$TAG' >> .env \
  && (docker network create arcana-print >/dev/null 2>&1 || true) \
  && /usr/local/bin/arcana-registry-login \
  && docker compose pull -q && systemctl restart arcana \
  && mv -f .env.rollback.candidate .env.previous.tag \
  && docker image prune -a -f --filter until=24h >/dev/null"
# Тег для отката переносится только после удачного перезапуска. Пока он писался сразу, упавшая
# попытка релиза затирала им же настоящую работавшую версию: после двух заходов в файле лежал
# тег сегодняшней сборки, и откат по нему вернул бы тот же код.
# Диск машины 20 ГБ, каждый релиз добавляет ~2,7 ГБ образов: без чистки он заполнился на 100 %
# и следующий релиз упал на «no space left on device». Чистим после перезапуска, чтобы удалялись
# только образы, которые уже никем не заняты.

echo "== проверка"
until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
scripts/release-snapshot.sh | tee "../reports/unified/prod-after-$TAG.json"
echo "готово: $SITE"
