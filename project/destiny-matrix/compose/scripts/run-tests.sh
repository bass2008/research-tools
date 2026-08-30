#!/usr/bin/env bash
# Полный локальный gate единого релиза: метод, контент/SEO, API, сборка, commerce и PDF.
# Никаких release-, git-, registry- или production-команд этот файл не вызывает.
set -uo pipefail
cd "$(dirname "$0")/../.."

PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
LOGS="${ARCANA_TEST_LOGS:-/tmp/arcana}"
ARTIFACTS="${UNIFIED_RELEASE_ARTIFACT_DIR:-$PWD/reports/unified}"
mkdir -p "$LOGS" "$ARTIFACTS"
failed=()

step() { printf '\n== %s\n' "$1"; }

# Вызов живёт в условии, поэтому `set -e` не нужен и следующий gate всё равно даст свой
# диагноз. Код команды сохраняется благодаря pipefail, полный вывод — в логе.
run_logged() {
  local key="$1" title="$2" log="$3"
  shift 3
  step "$title"
  if "$@" 2>&1 | tee "$log" | tail -6; then
    return 0
  fi
  failed+=("$key")
  echo "ПРОВАЛ: $key (полный лог: $log)"
  return 0
}

run_logged engine "контракт метода, engine и generated-artifacts" \
  "$LOGS/tests-engine.log" "$PY" -m pytest engine content -q
run_logged seo-source "воспроизводимость таксономии, семантики и URL registry" \
  "$LOGS/tests-seo-source.log" "$PY" ../../tools/seo/prepare-unified-release.py --check
run_logged article-source "схема исходников статей и ordered-хвостов" \
  "$LOGS/tests-article-source.log" "$PY" ../../tools/seo/build-content.py --check
run_logged content "целостность редакционного корпуса" \
  "$LOGS/tests-content.log" "$PY" -m content.validate
run_logged validator "self-test валидатора контента" \
  "$LOGS/tests-content-selftest.log" "$PY" -m content.selftest
run_logged api "контрактные тесты API и платежей" \
  "$LOGS/tests-api.log" "$PY" -m pytest api -q
if [ "${SKIP_NPM_AUDIT:-0}" = "1" ]; then
  step "аудит npm-зависимостей"
  echo "ПРОПУЩЕНО: SKIP_NPM_AUDIT=1 — явное решение владельца только для этого релиза"
else
  run_logged audit "аудит npm-зависимостей" \
    "$LOGS/tests-npm-audit.log" npm --prefix web audit
fi
run_logged web "unit, golden и полный TypeScript parity" \
  "$LOGS/tests-web.log" npm --prefix web test -- --run
run_logged types "TypeScript typecheck" \
  "$LOGS/tests-types.log" npm --prefix web run typecheck
run_logged build "production-сборка Next" \
  "$LOGS/tests-build.log" npm --prefix web run build

# На сломанном исходном gate нельзя проверять старый Docker image: он даст ложную зелень.
if [ ${#failed[@]} -ne 0 ]; then
  printf '\nИсходный preflight упал: %s\n' "${failed[*]}"
  exit 1
fi

step "локальный стенд для браузерных сценариев"
for env in ~/.config/arcana/reports.env ~/.config/arcana/smtp.env; do
  if [ -f "$env" ]; then set -a; . "$env"; set +a; fi
done
export PAYMENT_PROVIDER=mock MAIL_TO_LOG=1 UNIFIED_RELEASE_ARTIFACT_DIR="$ARTIFACTS"
docker network inspect arcana-print >/dev/null 2>&1 || docker network create arcana-print >/dev/null
if (cd compose && docker compose up -d --build --wait) >"$LOGS/tests-stand.log" 2>&1; then
  docker compose -f compose/docker-compose.yml ps
else
  failed+=("stand")
  tail -30 "$LOGS/tests-stand.log"
fi

if [ ${#failed[@]} -eq 0 ]; then
  run_logged e2e "браузер, mock-payment, callback, refund и PDF" \
    "$LOGS/tests-e2e.log" "$PY" -m pytest e2e -q
  run_logged check "приёмка собранного фронта" \
    "$LOGS/tests-check.log" npm --prefix web run check
fi

if [ ${#failed[@]} -eq 0 ]; then
  run_logged manifest "manifest единого release candidate" \
    "$LOGS/tests-manifest.log" "$PY" compose/scripts/release-manifest.py \
    --output "$ARTIFACTS/release-manifest.json" --preflight passed
fi

if [ -f "$ARTIFACTS/31-03-1993-report.pdf" ]; then
  (cd "$ARTIFACTS" && sha256sum \
    31-03-1993-landing.png 31-03-1993-report.png 31-03-1993-report.pdf > manifest.sha256)
fi

printf '\n'
if [ ${#failed[@]} -eq 0 ]; then
  echo "ЛОКАЛЬНЫЙ PREFLIGHT ЗЕЛЁНЫЙ"
  echo "Эталонные файлы: $ARTIFACTS"
  echo "Не выполнено намеренно: release test/prod, git commit/push, живой банк и prod smoke."
  echo "Тестовый терминал банка запускается отдельно только с явной авторизацией:"
  echo "  cd e2e && SSL_CERT_FILE=~/.config/arcana/ca-bundle.pem $PY -m pytest -m bank -q"
else
  echo "УПАЛО: ${failed[*]} (полные логи в $LOGS/tests-*.log)"
  exit 1
fi
