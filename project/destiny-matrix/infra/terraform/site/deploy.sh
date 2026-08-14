#!/usr/bin/env bash
set -euo pipefail

# Ассеты в Object Storage: только `_next/static` и файлы из `public`. Страницы сюда больше не
# едут — их отдаёт node на VM (../README.md §1). Сборку этот скрипт не запускает: релизом
# управляет infra/deploy.sh, который и вызывает этот скрипт последним шагом.
#
#   ./deploy.sh                 залить ассеты уже собранного web
#   ./deploy.sh --dry-run       показать разницу, ничего не менять
#   ./deploy.sh --no-purge      не сбрасывать кэш CDN
#   ./deploy.sh --no-check      не проверять бакет curl-ом
#
# Terraform владеет бакетом и ключом; содержимое кладёт этот скрипт. Почему не terraform apply —
# ../README.md §2.

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "${root_dir}/../../.." && pwd)"
web_dir="${repo_dir}/web"
static_dir="${web_dir}/.next/static"
public_dir="${web_dir}/public"

immutable_cache="public, max-age=31536000, immutable"
# Имена в public стабильные (og.png), поэтому вечный кэш нельзя, а no-cache расточителен.
public_cache="public, max-age=3600"

do_purge=1
do_check=1
dry_run=""

for arg in "$@"; do
  case "${arg}" in
    --no-purge) do_purge=0 ;;
    --no-check) do_check=0 ;;
    --dry-run)
      dry_run="--dry-run"
      do_purge=0
      do_check=0
      ;;
    *)
      printf 'Unknown flag: %s\n' "${arg}" >&2
      exit 2
      ;;
  esac
done

die() {
  printf 'assets: %s\n' "$1" >&2
  exit 1
}

command -v terraform >/dev/null || die 'terraform not found'
command -v rclone >/dev/null || die 'rclone not found: apt install rclone (fallback in ../README.md §2)'

[[ -d "${static_dir}" ]] || die "нет ${static_dir}: сначала соберите фронт (infra/deploy.sh)"
[[ -d "${public_dir}" ]] || die "нет ${public_dir}"

# Reading state from Object Storage needs the backend credentials from the bootstrap root.
if [[ -z "${AWS_ACCESS_KEY_ID:-}" && -f "${repo_dir}/terraform/bootstrap/export-backend-env.sh" ]]; then
  # shellcheck source=/dev/null
  source "${repo_dir}/terraform/bootstrap/export-backend-env.sh"
fi

# `terraform output -raw missing` prints a warning and still exits 0, so set -e alone would let an
# empty bucket name through and rclone would sync into the remote root. Every value is checked.
tf_out() { terraform -chdir="${root_dir}" output -raw "$1"; }

tf_out_required() {
  local value
  value="$(tf_out "$1")"
  [[ -n "${value}" ]] || die "terraform output ${1} is empty: apply this root before deploying"
  printf '%s' "${value}"
}

bucket="$(tf_out_required bucket_name)"
asset_base="$(tf_out_required asset_base_url)"
cdn_resource_id="$(tf_out cdn_resource_id)"

# Bucket names contain dots, so virtual-hosted addressing would break TLS: path style is required.
export RCLONE_CONFIG_YC_TYPE="s3"
export RCLONE_CONFIG_YC_PROVIDER="Other"
export RCLONE_CONFIG_YC_ENDPOINT="${S3_ENDPOINT:-https://storage.yandexcloud.net}"
export RCLONE_CONFIG_YC_REGION="ru-central1"
export RCLONE_CONFIG_YC_FORCE_PATH_STYLE="true"
# Terraform owns the bucket. Without this rclone calls CreateBucket before the first upload, and
# the deploy key has storage.admin, so a typo in the name would silently create a second bucket.
export RCLONE_CONFIG_YC_NO_CHECK_BUCKET="true"

# Assigned first, exported second: with `export x=$(cmd)` bash reports export's status, not the
# command's, so a failed terraform output would slip past set -e and empty credentials would fly.
access_key="$(tf_out_required deploy_access_key)"
secret_key="$(tf_out_required deploy_secret_key)"
export RCLONE_CONFIG_YC_ACCESS_KEY_ID="${access_key}"
export RCLONE_CONFIG_YC_SECRET_ACCESS_KEY="${secret_key}"

# --checksum, not mtime: every next build rewrites mtimes, and comparing MD5 keeps an unchanged
# file from being re-uploaded.
sync_common=(--checksum --transfers 8 --checkers 16 --stats-one-line --verbose)

printf '== assets -> %s\n' "${bucket}"

# Чанки удаляются вместе со старым релизом: браузер с открытой вкладкой ходит за ними по
# хешированному имени, поэтому здесь `copy`, а не `sync`. Мусор чистится вручную и редко —
# 2 МБ на релиз.
printf -- '-- _next/static (copy, immutable)\n'
rclone copy "${static_dir}" "yc:${bucket}/_next/static" "${sync_common[@]}" ${dry_run:+"${dry_run}"} \
  --header-upload "Cache-Control: ${immutable_cache}"

printf -- '-- public/ (sync, %s)\n' "${public_cache}"
rclone sync "${public_dir}" "yc:${bucket}" "${sync_common[@]}" ${dry_run:+"${dry_run}"} \
  --exclude "_next/**" \
  --header-upload "Cache-Control: ${public_cache}"

if [[ ${do_purge} -eq 1 && -n "${cdn_resource_id}" ]]; then
  command -v yc >/dev/null || die 'yc not found, cannot purge the CDN'
  printf '== purge CDN %s\n' "${cdn_resource_id}"
  yc cdn cache purge --resource-id "${cdn_resource_id}" --all
elif [[ -z "${cdn_resource_id}" ]]; then
  printf '== no CDN resource: only browser caches matter, and Cache-Control is already set\n'
fi

if [[ ${do_check} -eq 1 ]]; then
  printf '== check\n'
  asset="$(cd "${static_dir}" && find . -type f | head -1 || true)"
  asset="${asset#./}"
  if [[ -n "${asset}" ]]; then
    url="${asset_base}/_next/static/${asset}"
    printf '  %s -> %s\n' "${url}" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${url}")"
    printf '  Cache-Control: %s\n' \
      "$(curl -sI --max-time 20 "${url}" | tr -d '\r' | awk -F': ' 'tolower($1)=="cache-control"{print $2}')"
  fi
fi

printf '== done: %s\n' "${asset_base}"
