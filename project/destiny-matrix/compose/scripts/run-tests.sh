#!/usr/bin/env bash
# Все тесты подряд: контрактные api, компонентные фронта, браузерные сценарии.
set -euo pipefail
cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
LOGS=/tmp/arcana; mkdir -p "$LOGS"
failed=()

step() { printf '\n== %s\n' "$1"; }

step "контрактные тесты api"
"$PY" -m pytest api -q || failed+=("api")

step "компонентные тесты фронта"
(cd web && npm test -- --run) || failed+=("web")

step "стенд для браузерных сценариев"
# мок-оплата, чтобы не ходить в банк; письма в лог, чтобы не писать людям
for env in ~/.config/arcana/reports.env ~/.config/arcana/smtp.env; do
  if [ -f "$env" ]; then set -a; . "$env"; set +a; fi
done
export PAYMENT_PROVIDER=mock MAIL_TO_LOG=1
(cd compose && docker compose up -d --build --wait) >"$LOGS/tests-stand.log" 2>&1 \
  || { tail -20 "$LOGS/tests-stand.log"; echo "стенд не поднялся"; exit 1; }

step "браузерные сценарии"
(cd e2e && "$PY" -m pytest . -q) || failed+=("e2e")

step "приёмка собранного фронта"
(cd web && npm run check) || failed+=("check")

printf '\n'
if [ ${#failed[@]} -eq 0 ]; then
  echo "всё зелёное. Банковский сценарий на живом терминале — отдельно:"
  echo "  cd e2e && SSL_CERT_FILE=~/.config/arcana/ca-bundle.pem $PY -m pytest -m bank -q"
else
  echo "упало: ${failed[*]}"
  exit 1
fi
