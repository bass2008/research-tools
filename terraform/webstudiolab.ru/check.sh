#!/usr/bin/env bash
set -euo pipefail

domain="${DOMAIN:-webstudiolab.ru}"

printf 'NS:\n'
dig +short NS "${domain}"
printf 'A/ANAME result:\n'
dig +short A "${domain}"
printf 'MX:\n'
dig +short MX "${domain}"
printf 'SPF:\n'
dig +short TXT "${domain}"
printf 'DMARC:\n'
dig +short TXT "_dmarc.${domain}"

curl --fail --silent --show-error --location --max-time 20 "https://${domain}/" >/dev/null
printf 'HTTPS site: OK\n'

subject="$(openssl s_client -connect "${domain}:443" -servername "${domain}" </dev/null 2>/dev/null |
  openssl x509 -noout -subject 2>/dev/null || true)"
printf 'TLS certificate: %s\n' "${subject:-unavailable}"

if ! dig +short MX "${domain}" | grep -q 'improvmx\.com\.$'; then
  printf 'MX: does not point at ImprovMX\n' >&2
  exit 1
fi
printf 'MX: ImprovMX\n'
