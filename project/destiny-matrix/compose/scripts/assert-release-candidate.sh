#!/usr/bin/env bash
# Разрешить deploy только проверенного clean commit из manifest единого preflight.
set -euo pipefail

cd "$(dirname "$0")/../.."
PY="${PY:-/home/sergey/miniconda3/envs/research3.12/bin/python}"
MANIFEST="${UNIFIED_RELEASE_MANIFEST:-$PWD/reports/unified/release-manifest.json}"

if [ -n "$(git status --porcelain -- . ../../tools/seo)" ]; then
  echo "release запрещён: рабочее дерево проекта/SEO не чистое" >&2
  exit 1
fi
test -s "$MANIFEST" || { echo "release запрещён: нет $MANIFEST" >&2; exit 1; }

"$PY" - "$MANIFEST" "$(git rev-parse HEAD)" <<'PY'
import json, sys
path, commit = sys.argv[1:]
data = json.load(open(path, encoding="utf-8"))
assert data.get("preflight") == "passed", "manifest не подтверждает preflight"
assert data.get("release_allowed") is True, "manifest собран из dirty tree"
assert data.get("git", {}).get("commit") == commit, "manifest относится к другому commit"
print(f"release candidate подтверждён: {commit}")
PY

if [ "${REQUIRE_TEST_EVIDENCE:-0}" = "1" ]; then
  TESTED="${UNIFIED_TESTED_COMMIT:-$PWD/reports/unified/tested-commit.txt}"
  test -s "$TESTED" || { echo "prod запрещён: нет evidence test deploy" >&2; exit 1; }
  test "$(tr -d '[:space:]' < "$TESTED")" = "$(git rev-parse HEAD)" || {
    echo "prod запрещён: test проходил другой commit" >&2
    exit 1
  }
fi
