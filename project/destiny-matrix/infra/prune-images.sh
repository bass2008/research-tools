#!/usr/bin/env bash
# Чистка образов на машине: остаётся то, что работает, и ровно один набор для отката.
#
# Правило «удалять всё старше суток» запасом не было: сколько релизов успело пройти за сутки,
# столько наборов и лежало. Четыре релиза подряд забивали диск, а один релиз в неделю не оставлял
# отката вовсе.
#
#   prune-images.sh remember <проект>   запомнить образы, которые сейчас в работе (станут откатом)
#   prune-images.sh prune               удалить всё, кроме работающих и запомненных
#
# Откат запоминают только боевые контуры: тестовым он не нужен, а место на диске общее.
set -euo pipefail

APP=/srv/arcana
mode="${1:?remember или prune}"

case "$mode" in
  remember)
    project="${2:?нужно имя compose-проекта}"
    docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Image}}' \
      | sort -u > "$APP/.keep-images.$project"
    ;;
  prune)
    keep=$(mktemp)
    trap 'rm -f "$keep"' EXIT
    docker ps --format '{{.Image}}' | sort -u > "$keep"
    cat "$APP"/.keep-images.* 2>/dev/null >> "$keep" || true

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
