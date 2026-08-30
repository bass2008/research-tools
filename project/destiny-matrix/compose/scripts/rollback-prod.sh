#!/usr/bin/env bash
# Вернуть ровно tag, сохранённый release-prod.sh перед последним переключением.
# По умолчанию только показывает цель; применение требует APPLY=1.
set -euo pipefail

IP="${ARCANA_PROD_IP:-84.201.157.100}"
SITE="${SITE_URL:-https://arcana-sense.ru}"

echo "== сохранённый предыдущий релиз"
ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" \
  "test -s /srv/arcana/.env.previous.tag && cat /srv/arcana/.env.previous.tag"

if [ "${APPLY:-0}" != "1" ]; then
  echo "сухой прогон. Применить: APPLY=1 scripts/rollback-prod.sh"
  exit 0
fi

ssh -o StrictHostKeyChecking=accept-new "ubuntu@$IP" "set -e
  cd /srv/arcana
  test -s .env.previous.tag
  cp .env .env.failed-\$(date +%Y%m%d-%H%M%S)
  sed -i '/^TAG=/d;/^REGISTRY=/d;/^BUILD_COMMIT=/d' .env
  cat .env.previous.tag >> .env
  /usr/local/bin/arcana-registry-login
  docker compose pull -q
  sudo systemctl restart arcana"

until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
echo "откат готов: $SITE"
