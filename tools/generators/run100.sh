#!/usr/bin/env bash
# Очередь генерации: держим прогон живым и переживаем падения.
# Идём волнами по 5 сидов на все 22 аркана: обрыв в любой момент оставляет пул равномерным,
# а не «шесть арканов готовы, шестнадцать пустых». Готовые сиды gen100.py пропускает.
trap 'echo "останов по сигналу"; kill 0; exit 130' TERM INT
cd "$(dirname "$0")"
PY=/home/sergey/miniconda3/envs/flux/bin/python

export ARC_OUT="${ARC_OUT:-out/dev-guided}"
export ARC_PREFIX="${ARC_PREFIX:-g100}"
export ARC_NOTE="${ARC_NOTE:-FLUX.1-dev с рабочим guidance 3.5.}"
export ARC_SLUGS="${ARC_SLUGS:-empress,fool,magician,priestess,emperor,hierophant,lovers,chariot,strength,hermit,wheel,justice,hanged,death,temperance,devil,tower,star,moon,sun,judgement,world}"

WAVE="${WAVE:-5}"                 # сидов за один круг по всем арканам
FIRST="${ARC_SEED_FROM:-21}"      # первый сид: 1..20 сделаны без guidance, их не трогаем
LAST="${LAST:-40}"

for start in $(seq "$FIRST" "$WAVE" "$LAST"); do
  echo "══ круг: сиды $start–$((start + WAVE - 1)), $(date +%H:%M:%S) ══"
  for attempt in 1 2 3; do
    ARC_SEED_FROM="$start" ARC_COUNT="$WAVE" "$PY" gen100.py && break
    echo "круг прервался, попытка $attempt, повтор через 20 c"
    sleep 20
  done
done
echo "ОЧЕРЕДЬ ЗАВЕРШЕНА"
