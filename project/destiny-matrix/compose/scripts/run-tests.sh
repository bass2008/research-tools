#!/usr/bin/env bash
# Все тесты подряд: контрактные api, компонентные фронта, браузерные сценарии.
set -euo pipefail
cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
LOGS=/tmp/arcana; mkdir -p "$LOGS"
failed=()

step() { printf '\n== %s\n' "$1"; }

# вывод каждого набора остаётся в файле: плавающее падение иначе теряется вместе с прокруткой
step "контрактные тесты api"
"$PY" -m pytest api -q 2>&1 | tee "$LOGS/tests-api.log" | tail -3
grep -q "failed" "$LOGS/tests-api.log" && failed+=("api")

step "компонентные тесты фронта"
(cd web && npm test -- --run) 2>&1 | tee "$LOGS/tests-web.log" | tail -3
grep -qE "FAIL|failed" "$LOGS/tests-web.log" && failed+=("web")

step "стенд для браузерных сценариев"
# мок-оплата, чтобы не ходить в банк; письма в лог, чтобы не писать людям
for env in ~/.config/arcana/reports.env ~/.config/arcana/smtp.env; do
  if [ -f "$env" ]; then set -a; . "$env"; set +a; fi
done
export PAYMENT_PROVIDER=mock MAIL_TO_LOG=1
(cd compose && docker network create arcana-print >/dev/null 2>&1; docker compose up -d --build --wait) >"$LOGS/tests-stand.log" 2>&1 \
  || { tail -20 "$LOGS/tests-stand.log"; echo "стенд не поднялся"; exit 1; }

step "браузерные сценарии"
(cd e2e && "$PY" -m pytest . -q) 2>&1 | tee "$LOGS/tests-e2e.log" | tail -4
if grep -q "failed" "$LOGS/tests-e2e.log"; then
  failed+=("e2e")
  echo "-- что упало:"; grep -E "^FAILED|AssertionError" "$LOGS/tests-e2e.log" | head -5
fi

step "приёмка собранного фронта"
(cd web && npm run check) || failed+=("check")

printf '\n'
if [ ${#failed[@]} -eq 0 ]; then
  echo "всё зелёное. Банковский сценарий на живом терминале — отдельно:"
  echo "  cd e2e && SSL_CERT_FILE=~/.config/arcana/ca-bundle.pem $PY -m pytest -m bank -q"
else
  echo "упало: ${failed[*]} (полные логи в $LOGS/tests-*.log)"
  exit 1
fi
