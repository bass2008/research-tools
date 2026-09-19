#!/usr/bin/env bash
# Вернуть ровно tag, сохранённый release-prod.sh перед последним переключением.
# По умолчанию только показывает цель; применение требует APPLY=1.
set -euo pipefail

IP="${ARCANA_PROD_IP:-45.80.130.166}"
SSH_USER="${ARCANA_SSH_USER:-root}"
SITE="${SITE_URL:-https://arcana-sense.ru}"

echo "== сохранённый предыдущий релиз"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" \
  "cat /srv/arcana/.env.previous.tag 2>/dev/null" | grep . \
  || { echo "откатываться не на что: /srv/arcana/.env.previous.tag пуст (машина ещё не видела релиза)"; exit 1; }

if [ "${APPLY:-0}" != "1" ]; then
  echo "сухой прогон. Применить: APPLY=1 scripts/rollback-prod.sh"
  exit 0
fi

ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "set -e
  cd /srv/arcana
  test -s .env.previous.tag
  cp .env .env.failed-\$(date +%Y%m%d-%H%M%S)
  sed -i '/^TAG=/d;/^REGISTRY=/d;/^BUILD_COMMIT=/d' .env
  cat .env.previous.tag >> .env
  /usr/local/bin/arcana-registry-login
  docker compose pull -q
  systemctl restart arcana"

until curl -sf -o /dev/null "$SITE/"; do sleep 3; done
curl -s "$SITE/version/current.txt"
echo "откат готов: $SITE"
