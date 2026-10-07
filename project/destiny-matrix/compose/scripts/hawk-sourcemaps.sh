#!/usr/bin/env bash
# scripts/hawk-sourcemaps.sh <integration-token> <release> <maps-dir>
set -euo pipefail

TOKEN="$1" RELEASE="$2" DIR="$3"
ID="$(printf '%s' "$TOKEN" | base64 -d | python3 -c 'import json, sys; print(json.load(sys.stdin)["integrationId"])')"

sent=0 failed=0
while IFS= read -r -d '' map; do
  answer="$(curl -sS -m 120 -H "Authorization: Bearer $TOKEN" -F "release=$RELEASE" \
    -F "file=@$map;filename=$(basename "$map")" "https://$ID.k1.hawk.so/release" || true)"
  if grep -q '"error":false' <<<"$answer"; then
    sent=$((sent + 1))
  else
    failed=$((failed + 1))
    echo "  не принята $(basename "$map"): ${answer:0:160}" >&2
  fi
done < <(find "$DIR" -name '*.map' -print0)

echo "карты $RELEASE: принято $sent, отказ $failed"
[ "$sent" -gt 0 ] && [ "$failed" -eq 0 ]
