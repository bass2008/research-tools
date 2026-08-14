#!/usr/bin/env bash
set -euo pipefail

# Приёмка бакета ассетов. Страницы здесь не лежат — их отдаёт node на VM, для сайта целиком
# есть ../../check.sh.
#   BUCKET=matritsa.webstudiolab.ru ./check.sh

bucket="${BUCKET:-matritsa.webstudiolab.ru}"
base="${ASSET_BASE:-https://storage.yandexcloud.net/${bucket}}"
failures=0

fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

header() {
  curl -sI --max-time 20 "$1" | tr -d '\r' | awk -F': ' -v k="$2" 'tolower($1)==k{print $2}'
}

printf 'Ассеты доступны анонимно:\n'
web_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/web"
asset=""
if [[ -d "${web_dir}/.next/static" ]]; then
  asset="$(cd "${web_dir}/.next/static" && find . -type f | head -1)"
  asset="_next/static/${asset#./}"
fi
asset="${ASSET_KEY:-${asset}}"
if [[ -z "${asset}" ]]; then
  fail "не знаю, какой объект проверять: нет ни ASSET_KEY, ни собранного web/.next/static"
else
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${base}/${asset}")"
  printf '  GET /%s -> %s\n' "${asset}" "${code}"
  [[ "${code}" == "200" ]] || fail "GET /${asset} вернул ${code}"

  cc="$(header "${base}/${asset}" cache-control)"
  printf '  Cache-Control: %s\n' "${cc:-<none>}"
  [[ "${cc}" == *"immutable"* ]] || fail "чанки должны быть immutable, получено '${cc:-<none>}'"
fi

printf 'Листинг закрыт:\n'
listing="$(curl -s --max-time 20 "https://storage.yandexcloud.net/${bucket}?list-type=2" | head -c 200)"
grep -q 'AccessDenied' <<<"${listing}" || fail "анонимный листинг не запрещён"
printf '  denied\n'

if [[ ${failures} -gt 0 ]]; then
  printf '%d check(s) failed\n' "${failures}" >&2
  exit 1
fi
printf 'all checks passed\n'
