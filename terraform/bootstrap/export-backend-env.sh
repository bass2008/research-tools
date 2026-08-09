#!/usr/bin/env bash

# Source this file before running a Terraform root backed by Object Storage:
#   source ../bootstrap/export-backend-env.sh

_bootstrap_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! terraform -chdir="${_bootstrap_dir}" output -raw state_access_key >/dev/null 2>&1; then
  printf 'Bootstrap state is missing. Run terraform apply in %s first.\n' "${_bootstrap_dir}" >&2
  unset _bootstrap_dir
  return 1 2>/dev/null || exit 1
fi

export AWS_ACCESS_KEY_ID
AWS_ACCESS_KEY_ID="$(terraform -chdir="${_bootstrap_dir}" output -raw state_access_key)"

export AWS_SECRET_ACCESS_KEY
AWS_SECRET_ACCESS_KEY="$(terraform -chdir="${_bootstrap_dir}" output -raw state_secret_key)"

export AWS_REGION="ru-central1"
export AWS_DEFAULT_REGION="ru-central1"

unset _bootstrap_dir
printf 'Terraform backend credentials loaded into the current shell.\n'
