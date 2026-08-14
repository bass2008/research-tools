#!/usr/bin/env bash
set -euo pipefail

# Релиз matritsa на VM: собрать standalone-артефакт Next.js, доставить его и код API,
# переключить симлинки, перезапустить обе службы. В бакет уезжают только `_next/static`
# и картинки — этим занимается terraform/site/deploy.sh последним шагом.
#
#   ./deploy.sh                     полный цикл: сборка → фронт → API → ассеты → проверка
#   ./deploy.sh --skip-build        доставить уже собранное
#   ./deploy.sh --web-only          только фронт
#   ./deploy.sh --api-only          только API (код + venv + миграции)
#   ./deploy.sh --no-assets         не трогать бакет
#   ./deploy.sh --host 1.2.3.4      адрес вручную, без terraform output
#   ./deploy.sh --keep 5            сколько релизов оставить на машине
#   ./deploy.sh --dry-run           показать, что уехало бы; ничего не менять
#
# Почему артефакт, а не сборка на машине: замер на этом репозитории — пик 628 МБ RSS и 189 с
# процессорного времени на 5 862 страницы. На 2 vCPU с гарантией 5 % это минуты простоя сайта
# и риск OOM рядом с Postgres. Подробности — terraform/README.md §3.

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
product_dir="$(cd "${infra_dir}/.." && pwd)"          # project/destiny-matrix
repo_dir="$(cd "${product_dir}/../.." && pwd)"        # корень монорепозитория
web_dir="${product_dir}/web"
api_dir="${product_dir}/api"
server_root="${infra_dir}/terraform/server"
site_root="${infra_dir}/terraform/site"

app_dir="/srv/matritsa"
ssh_user="ubuntu"
ssh_opts=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

host=""
do_build=1
do_web=1
do_api=1
do_assets=1
keep=3
dry=""

die() {
  printf 'deploy: %s\n' "$1" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) do_build=0 ;;
    --web-only) do_api=0 ;;
    --api-only)
      do_web=0
      do_build=0
      ;;
    --no-assets) do_assets=0 ;;
    --host)
      host="${2:-}"
      [[ -n "${host}" ]] || die '--host требует значение'
      shift
      ;;
    --keep)
      keep="${2:-}"
      [[ "${keep}" =~ ^[0-9]+$ ]] || die '--keep требует число'
      (("${keep}" >= 2)) || die '--keep не меньше 2: для отката нужен предыдущий релиз'
      shift
      ;;
    --dry-run)
      dry="--dry-run"
      do_assets=0
      ;;
    -h | --help)
      awk 'NR > 3 && /^#/ { sub(/^# ?/, ""); print; next } NR > 3 { exit }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "неизвестный флаг: $1" ;;
  esac
  shift
done

command -v rsync >/dev/null || die 'rsync не найден'
command -v ssh >/dev/null || die 'ssh не найден'

if [[ -z "${host}" ]]; then
  command -v terraform >/dev/null || die 'terraform не найден: передайте адрес через --host'
  if [[ -z "${AWS_ACCESS_KEY_ID:-}" && -f "${repo_dir}/terraform/bootstrap/export-backend-env.sh" ]]; then
    # shellcheck source=/dev/null
    source "${repo_dir}/terraform/bootstrap/export-backend-env.sh"
  fi
  host="$(terraform -chdir="${server_root}" output -raw public_ip 2>/dev/null || true)"
  [[ -n "${host}" ]] || die "terraform output public_ip пуст: примените корень ${server_root} или передайте --host"
fi

target="${ssh_user}@${host}"

remote() { ssh "${ssh_opts[@]}" "${target}" "$@"; }

remote_script() {
  # Скрипт уходит на stdin, аргументы — позиционными: так в него не попадает ни одна
  # незакавыченная подстановка локальной оболочки.
  local script="$1"
  shift
  ssh "${ssh_opts[@]}" "${target}" bash -s -- "$@" <<<"${script}"
}

printf '== машина %s\n' "${target}"
remote true || die "нет ssh-доступа к ${target}"

release="$(date -u +%Y%m%d-%H%M%S)"

# ---------------------------------------------------------------- фронт: standalone-артефакт

if [[ ${do_web} -eq 1 ]]; then
  if [[ ${do_build} -eq 1 ]]; then
    [[ -f "${web_dir}/package.json" ]] || die "нет package.json в ${web_dir}"
    command -v npm >/dev/null || die 'npm не найден'
    printf '== сборка фронта\n'
    (cd "${web_dir}" && npm run build)
  fi

  standalone="${web_dir}/.next/standalone"
  static_dir="${web_dir}/.next/static"

  if [[ ! -f "${standalone}/server.js" ]]; then
    die "нет ${standalone}/server.js.
Это контракт, а не догадка: docs/api-contract.md, «Раскладка деплоя — решено», п. 3 —
web/next.config.ts обязан ставить output: \"standalone\". Правит его фронтовый агент.
Обход на один прогон, если нужно проверить доставку прямо сейчас:
  cd web && NEXT_PRIVATE_STANDALONE=true npm run build"
  fi
  [[ -d "${static_dir}" ]] || die "нет ${static_dir}: сборка не дошла до конца"

  web_release="${app_dir}/web/releases/${release}"
  prev="$(remote "readlink -f ${app_dir}/web/current 2>/dev/null || true")"

  printf '== фронт -> %s\n' "${web_release}"
  printf '   артефакт: %s\n' "$(du -sh "${standalone}" | cut -f1)"
  [[ -n "${prev}" ]] && printf '   неизменные файлы жёсткими ссылками из %s\n' "${prev}"

  # --link-dest: между релизами меняется единицы страниц из 5 856, остальное становится жёсткой
  # ссылкой на предыдущий релиз. Иначе каждый релиз — это ещё 1,2 ГБ на диске.
  rsync_common=(-a --human-readable --info=stats1 --compress -e "ssh ${ssh_opts[*]}")
  [[ -n "${dry}" ]] && rsync_common+=(--dry-run --itemize-changes)
  [[ -n "${prev}" ]] && rsync_common+=(--link-dest "${prev}")

  remote "mkdir -p ${web_release}"
  rsync "${rsync_common[@]}" "${standalone}/" "${target}:${web_release}/"

  # standalone не включает ни .next/static, ни public — Next кладёт их рядом и требует
  # копировать руками. Для них --link-dest не нужен: 2 МБ.
  rsync -a --info=stats1 --compress ${dry:+--dry-run} -e "ssh ${ssh_opts[*]}" \
    "${static_dir}/" "${target}:${web_release}/.next/static/"
  rsync -a --info=stats1 --compress ${dry:+--dry-run} -e "ssh ${ssh_opts[*]}" \
    "${web_dir}/public/" "${target}:${web_release}/public/"

  # Пул чанков для nginx: sync без --delete, чтобы вкладка, открытая до релиза, догрузила
  # свои старые чанки, а не поймала ошибку загрузки.
  rsync -a --info=stats1 --compress ${dry:+--dry-run} -e "ssh ${ssh_opts[*]}" \
    "${static_dir}/" "${target}:${app_dir}/web/static/"

  if [[ -z "${dry}" ]]; then
    remote_script '
set -euo pipefail
app_dir="$1"; release="$2"; keep="$3"
rel="$app_dir/web/releases/$release"
[ -f "$rel/server.js" ] || { echo "нет $rel/server.js" >&2; exit 1; }

# Next может писать в .next/cache; служба ходит под matritsa, файлы приносит ubuntu.
mkdir -p "$rel/.next/cache"
chgrp matritsa "$rel/.next/cache" 2>/dev/null || true
chmod 2775 "$rel/.next/cache"

# Переключение одним rename: сайт не видит промежуточного состояния.
ln -sfn "$rel" "$app_dir/web/current.tmp"
mv -T "$app_dir/web/current.tmp" "$app_dir/web/current"

sudo systemctl restart matritsa-web
sleep 2
systemctl is-active --quiet matritsa-web || {
  journalctl -u matritsa-web -n 30 --no-pager >&2
  exit 1
}

ls -1dt "$app_dir"/web/releases/*/ 2>/dev/null | tail -n +$((keep + 1)) | xargs -r rm -rf
printf "web: %s, релизов на машине: %s\n" "$(systemctl is-active matritsa-web)" \
  "$(ls -1d "$app_dir"/web/releases/*/ 2>/dev/null | wc -l)"
' "${app_dir}" "${release}" "${keep}"
  fi
fi

# ---------------------------------------------------------------- API: код, venv, миграции

if [[ ${do_api} -eq 1 ]]; then
  api_release="${app_dir}/api/releases/${release}"
  printf '== API -> %s\n' "${api_release}"

  # Раскладка на машине повторяет репозиторий: api импортирует engine из корня, а
  # энциклопедию читает из web/content. PYTHONPATH в unit-файле указывает на корень релиза.
  remote "mkdir -p ${api_release}/apps ${api_release}/engine ${api_release}/web"

  rsync -a --info=stats1 --compress ${dry:+--dry-run} -e "ssh ${ssh_opts[*]}" \
    --exclude '__pycache__/' --exclude '.ruff_cache/' --exclude 'var/' \
    --exclude '.env' --exclude 'tests/' \
    "${api_dir}/" "${target}:${api_release}/api/"

  rsync -a --info=stats1 --compress ${dry:+--dry-run} -e "ssh ${ssh_opts[*]}" \
    --exclude '__pycache__/' --exclude 'tests/' \
    "${repo_dir}/engine/" "${target}:${api_release}/engine/"

  rsync -a --info=stats1 --compress ${dry:+--dry-run} -e "ssh ${ssh_opts[*]}" \
    "${web_dir}/content/" "${target}:${api_release}/web/content/"

  if [[ -z "${dry}" ]]; then
    remote_script '
set -euo pipefail
app_dir="$1"; release="$2"; keep="$3"
rel="$app_dir/api/releases/$release"
[ -f "$rel/api/app/main.py" ] || { echo "нет $rel/api/app/main.py" >&2; exit 1; }

[ -x "$app_dir/venv/bin/python" ] || python3 -m venv "$app_dir/venv"
"$app_dir/venv/bin/pip" install --quiet --upgrade pip
"$app_dir/venv/bin/pip" install --quiet -r "$rel/api/requirements.txt"

ln -sfn "$rel" "$app_dir/api/current.tmp"
mv -T "$app_dir/api/current.tmp" "$app_dir/api/current"

# alembic upgrade head живёт в ExecStartPre: схема догоняется до кода при каждом старте.
sudo systemctl restart matritsa-api
sleep 3
systemctl is-active --quiet matritsa-api || {
  journalctl -u matritsa-api -n 30 --no-pager >&2
  exit 1
}

ls -1dt "$app_dir"/api/releases/*/ 2>/dev/null | tail -n +$((keep + 1)) | xargs -r rm -rf
printf "api: %s, health: %s\n" "$(systemctl is-active matritsa-api)" \
  "$(curl -s --max-time 10 http://127.0.0.1:8010/api/health || echo нет-ответа)"
' "${app_dir}" "${release}" "${keep}"
  fi
fi

# ---------------------------------------------------------------- ассеты в бакет

if [[ ${do_assets} -eq 1 ]]; then
  if [[ -x "${site_root}/deploy.sh" ]]; then
    printf '== ассеты в бакет\n'
    "${site_root}/deploy.sh" || printf 'assets: не удалось; сайт от этого не страдает — nginx отдаёт _next/static с диска\n' >&2
  fi
fi

# ---------------------------------------------------------------- проверка

if [[ -z "${dry}" ]]; then
  printf '== проверка\n'
  code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" || printf 'нет-ответа'; }

  domain=""
  if command -v terraform >/dev/null; then
    domain="$(terraform -chdir="${server_root}" output -raw site_url 2>/dev/null || true)"
  fi
  [[ -n "${domain}" ]] || domain="http://${host}"

  for path in / /encyclopedia /api/health; do
    printf '  %s%s -> %s\n' "${domain}" "${path}" "$(code "${domain}${path}")"
  done

  # Токен обязан жить в httpOnly-куке: если он утёк в HTML, это видно грепом по исходнику.
  if curl -s --max-time 20 "${domain}/" | grep -qi 'destiny_session'; then
    printf '  ВНИМАНИЕ: имя сессионной куки встречается в HTML главной\n' >&2
  else
    printf '  токена в HTML главной нет\n'
  fi
fi

printf '== готово: релиз %s\n' "${release}"
