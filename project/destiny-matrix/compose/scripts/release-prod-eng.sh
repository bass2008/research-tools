#!/usr/bin/env bash
# Задеплоить английскую версию на боевой домен arcana-sense.com.
#
# От release-test-eng.sh отличается доменом, отсутствием Basic Auth и тем, что требует
# доказательства выкладки на английский тест: `reports/unified/tested-commit-en.txt` его пишет
# release-test-eng.sh. От release-prod.sh — языком сборки и открытой витриной: кассы за
# пределами России нет (docs/foreign-acquiring.md).
set -euo pipefail
cd "$(dirname "$0")/.."

scripts/assert-release-candidate.sh

# Юнит-тесты того языка, который собираем: красные тесты сборки не выкладываются.
scripts/assert-unit-tests.sh en
# Свидетельство теста у английского контура своё: русский `tested-commit.txt` про другой сайт.
TESTED="${UNIFIED_TESTED_COMMIT_EN:-$PWD/../reports/unified/tested-commit-en.txt}"
test -s "$TESTED" || { echo "prod-en запрещён: нет evidence выкладки на test.arcana-sense.com" >&2; exit 1; }
test "$(tr -d '[:space:]' < "$TESTED")" = "$(git rev-parse HEAD)" || {
  echo "prod-en запрещён: на английском тесте проходил другой commit" >&2
  exit 1
}

SITE=https://arcana-sense.com
IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
REGISTRY="${ARCANA_REGISTRY:-cr.selcloud.ru/arcana}"
TAG="prod-en-$(git rev-parse --short HEAD)"

CRAAS_ENV="${CRAAS_ENV:-$HOME/.config/arcana/craas.env}"
test -r "$CRAAS_ENV" || { echo "нет реквизитов реестра: $CRAAS_ENV" >&2; exit 1; }
set -a; . "$CRAAS_ENV"; set +a

export SITE_URL="$SITE" BUILD_COMMIT="$TAG" BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
export BUILD_TIME="$(TZ=Europe/Moscow date '+%Y-%m-%d %H:%M МСК')"
export BUILD_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Коды подтверждения владения сайтом. У `.com` они свои: Search Console проверяет каждый домен
# отдельно, и русский код здесь не подойдёт.
[ -f ~/.config/arcana/seo-en.env ] && { set -a; . ~/.config/arcana/seo-en.env; set +a; }

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
  --build-arg "NEXT_PUBLIC_METRIKA_ID=${METRIKA_ID_EN:-112840069}" \
  --build-arg "NEXT_PUBLIC_GOOGLE_VERIFICATION=${GOOGLE_VERIFICATION_EN:-}" \
  --build-arg "BUILD_COMMIT=$BUILD_COMMIT" \
  --build-arg "BUILD_BRANCH=$BUILD_BRANCH" \
  --build-arg "BUILD_TIME=$BUILD_TIME" \
  --build-arg "BUILD_ISO=$BUILD_ISO" \
  --output "type=image,name=$REGISTRY/web:$TAG,$ZSTD" ../web

echo "== запуск на $IP"
scp -q -o StrictHostKeyChecking=accept-new docker-compose.prod-en.yml "$SSH_USER@$IP:/srv/arcana/docker-compose.prod-en.yml"
scp -q -o StrictHostKeyChecking=accept-new ../infra/prune-images.sh "$SSH_USER@$IP:/usr/local/bin/arcana-prune-images"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "chmod 755 /usr/local/bin/arcana-prune-images"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "cd /srv/arcana \
  && printf 'REGISTRY=%s\nTAG=%s\n' '$REGISTRY' '$TAG' > .env.prod-en.tag \
  && /usr/local/bin/arcana-prune-images remember arcana-prod-en \
  && (docker network create arcana-print >/dev/null 2>&1 || true) \
  && /usr/local/bin/arcana-registry-login \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-prod-en -f docker-compose.prod-en.yml pull -q \
  && REGISTRY='$REGISTRY' TAG='$TAG' docker compose -p arcana-prod-en -f docker-compose.prod-en.yml up -d --wait --remove-orphans \
  && /usr/local/bin/arcana-prune-images prune"

echo "== проверка"
until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
# Язык и витрина — то, ради чего контур существует: русская сборка или страница оплаты здесь
# видны сразу.
curl -s "$SITE/" | grep -q '<html lang="en"' || { echo "!! страница не на английском" >&2; exit 1; }
curl -s -o /dev/null -w '%{http_code}' "$SITE/pay" | grep -q 404 || { echo "!! /pay отвечает: витрина обещает оплату, которой нет" >&2; exit 1; }
# Сайт обязан быть открыт для обхода: на боевом адресе своего языка robots.ts печатает запреты
# по разделам, а не «Disallow: /».
# Смотреть только секцию `User-Agent: *`: `Disallow: /` ниже стоит у GPTBot и прочих сборщиков
# текста намеренно, и поиск по всему файлу принимал это за закрытый сайт.
curl -s "$SITE/robots.txt" \
  | awk 'BEGIN{IGNORECASE=1} /^User-?Agent:[[:space:]]*\*/{on=1;next} /^User-?Agent:/{on=0} on' \
  | grep -q '^Disallow: /$' && { echo "!! robots закрывает весь сайт" >&2; exit 1; }
echo "готово: $SITE"
