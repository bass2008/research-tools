#!/usr/bin/env bash
set -uo pipefail

# Приёмка живого сайта в node-раскладке. Возвращает 0, только если сходится всё.
#
#   ./check.sh                                  https://matritsa.webstudiolab.ru
#   BASE=http://127.0.0.1:3000 ./check.sh       локальный node без nginx и TLS
#
# Проверки, привязанные к TLS и DNS, при base на http пропускаются — это отмечается в выводе.

base="${BASE:-https://matritsa.webstudiolab.ru}"
base="${base%/}"
domain="${base#*://}"
scheme="${base%%://*}"

failures=0
skipped=0

fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

skip() {
  printf 'SKIP %s\n' "$1"
  skipped=$((skipped + 1))
}

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1"; }

header() {
  curl -sI --max-time 20 "$1" | tr -d '\r' | awk -F': ' -v k="$2" 'tolower($1)==k{print tolower($2)}'
}

printf '== %s\n' "${base}"

printf 'DNS:\n'
if [[ "${scheme}" == "https" ]] && command -v dig >/dev/null; then
  a="$(dig +short A "${domain}" | head -1)"
  printf '  A %s -> %s\n' "${domain}" "${a:-<none>}"
  [[ -n "${a}" ]] || fail "нет A-записи у ${domain}: в node-раскладке домен обязан смотреть на VM"
  cname="$(dig +short CNAME "${domain}")"
  [[ -z "${cname}" ]] || fail "у ${domain} остался CNAME (${cname}): бакет больше не владеет доменом"
else
  skip 'DNS: base не https или нет dig'
fi

printf 'TLS:\n'
if [[ "${scheme}" == "https" ]]; then
  subject="$(openssl s_client -connect "${domain}:443" -servername "${domain}" </dev/null 2>/dev/null |
    openssl x509 -noout -subject 2>/dev/null)"
  printf '  %s\n' "${subject:-unavailable}"
  grep -q "${domain}" <<<"${subject}" || fail "сертификат не про ${domain}"

  redirect="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "http://${domain}/")"
  printf '  http://%s/ -> %s\n' "${domain}" "${redirect}"
  [[ "${redirect}" == 30* ]] || fail "http не редиректит на https (получено ${redirect})"
else
  skip 'TLS: base не https'
fi

printf 'Страницы:\n'
for path in / /encyclopedia /encyclopedia/arcanum/14; do
  c="$(code "${base}${path}")"
  printf '  GET %s -> %s\n' "${path}" "${c}"
  [[ "${c}" == "200" ]] || fail "GET ${path} вернул ${c}"
done

# Контракт, п. 2: node отдаёт и /path, и /path/ — trailingSlash больше не нужен.
slash="$(code "${base}/encyclopedia/arcanum/14/")"
printf '  GET /encyclopedia/arcanum/14/ -> %s\n' "${slash}"
[[ "${slash}" == "200" || "${slash}" == 30* ]] || fail "адрес со слешем вернул ${slash}"

miss="$(code "${base}/no-such-page-$$")"
printf '  GET /no-such-page -> %s\n' "${miss}"
[[ "${miss}" == "404" ]] || fail "отсутствующая страница вернула ${miss}, ожидался 404"

printf 'BFF:\n'
health="$(curl -s --max-time 20 "${base}/api/health")"
printf '  /api/health -> %s\n' "${health:-<none>}"
grep -q '"ok":true' <<<"${health}" || fail "/api/health не отвечает ok:true"

me="$(code "${base}/api/auth/me")"
printf '  /api/auth/me без куки -> %s\n' "${me}"
[[ "${me}" == "401" ]] || fail "/api/auth/me без куки вернул ${me}, ожидался 401"

printf 'Токен недоступен из JS:\n'
html="$(curl -s --max-time 20 "${base}/")"
if grep -qi 'destiny_session' <<<"${html}"; then
  fail 'имя сессионной куки встречается в HTML: сессия обязана жить только в httpOnly-куке'
else
  printf '  в HTML главной токена и имени куки нет\n'
fi

printf 'Платные разделы не в предрендере:\n'
report_cc="$(header "${base}/report" cache-control)"
printf '  Cache-Control /report: %s\n' "${report_cc:-<none>}"
if [[ "${report_cc}" == *"no-store"* || "${report_cc}" == *"private"* ]]; then
  printf '  страница отчёта динамическая\n'
else
  fail "/report отдаётся кэшируемым (${report_cc:-<none>}): контракт требует dynamic = force-dynamic"
fi

printf 'Ассеты:\n'
asset_cc=""
asset_path=""
web_static="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/web/.next/static"
if [[ -d "${web_static}" ]]; then
  asset_path="_next/static/$(cd "${web_static}" && find . -type f | head -1 | sed 's|^\./||')"
  asset_cc="$(header "${base}/${asset_path}" cache-control)"
  printf '  Cache-Control /%s: %s\n' "${asset_path}" "${asset_cc:-<none>}"
  [[ "${asset_cc}" == *"immutable"* ]] || fail "чанк отдаётся без immutable (${asset_cc:-<none>})"
else
  skip 'ассеты: нет собранного web/.next/static, нечего сверять'
fi

printf -- '--\n'
if [[ ${failures} -gt 0 ]]; then
  printf '%d проверок не прошло, %d пропущено\n' "${failures}" "${skipped}" >&2
  exit 1
fi
printf 'всё сошлось (%d пропущено)\n' "${skipped}"
