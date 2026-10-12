#!/usr/bin/env bash
# Чистка образов на машине: остаётся только то, что работает. Откатов нет (docs/decisions.md,
# Decision 17), поэтому прошлый набор образов не храним.
#
#   prune-images.sh prune               удалить всё, кроме работающих
set -euo pipefail

APP=/srv/arcana
mode="${1:?prune}"

case "$mode" in
  prune)
    keep=$(mktemp)
    trap 'rm -f "$keep"' EXIT
    docker ps --format '{{.Image}}' | sort -u > "$keep"
    rm -f "$APP"/.keep-images.*

    # Удаляем по тегу, а не по id: у одного образа бывает несколько тегов, и чужой тег из
    # списка сохранения не должен уезжать вместе с нашим.
    docker images --format '{{.Repository}}:{{.Tag}}' \
      | grep -v '^<none>:' \
      | grep -vxF -f "$keep" \
      | xargs -r -n 1 docker rmi >/dev/null 2>&1 || true
    docker images -qf dangling=true | xargs -r docker rmi >/dev/null 2>&1 || true
    ;;
  *)
    echo "неизвестный режим: $mode" >&2
    exit 1
    ;;
esac
