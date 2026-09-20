#!/usr/bin/env bash
# Положить на машину расписание досверки платежей. Вызывается релизом: переименование сервиса в
# compose ломало крон молча — в логе копились «service "api" is not running», а платежи не
# досверялись до следующего разворота машины.
set -euo pipefail
cd "$(dirname "$0")"

IP="${1:-${ARCANA_PROD_IP:-45.80.130.166}}"
SSH_USER="${ARCANA_SSH_USER:-root}"

scp -q -o StrictHostKeyChecking=accept-new cron/arcana-sweep "$SSH_USER@$IP:/etc/cron.d/arcana-sweep"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$IP" "chmod 644 /etc/cron.d/arcana-sweep \
  && cd /srv/arcana \
  && SERVICE=\$(awk '/exec -T/ {for (i=1; i<=NF; i++) if (\$i == \"-T\") print \$(i+1)}' /etc/cron.d/arcana-sweep) \
  && docker compose ps --services | grep -qx \"\$SERVICE\" \
  || { echo \"крон зовёт сервис \$SERVICE, которого нет в compose\" >&2; exit 1; }"
echo "крон досверки обновлён на $IP"
