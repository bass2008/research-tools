#!/usr/bin/env bash
# Карта «Императрица», 4 варианта на каждую модель, своя страница на модель.
# Веса берём локальные (см. fetch.sh): трансформер — квантованный GGUF, остальное — общая база.
set -uo pipefail
cd "$(dirname "$0")"

PY=/home/sergey/miniconda3/envs/flux/bin/python
LANDING=/home/sergey/Personal/research-tools/project/destiny-matrix

# ── что генерируем ────────────────────────────────────────────────
export FLUX_PROMPT="tarot card illustration, The Empress, a serene queen seated on a stone throne \
in a blooming garden, wheat field and cypress trees behind her, crown of twelve stars, \
flowing robe with pomegranate pattern, heart-shaped shield with a planetary symbol resting at her feet, \
a small stream in the foreground; elegant art nouveau line art, refined engraving with soft flat colors, \
muted teal and deep petrol blue palette with warm ochre gold accents, cream paper background, \
thin double border frame, centered symmetrical composition, full-body figure, \
vertical card format, no text, no lettering, no watermark, highly detailed, clean lines"

# CLIP, T5 и VAE у schnell и dev одинаковые — база одна, меняется только трансформер
export FLUX_BASE="models/FLUX.1-schnell"

# ── модели: метка | GGUF-трансформер | шаги | guidance | лицензия | страница ──
# schnell дистиллирован под 1–4 шага и работает без CFG; dev рассчитан на 20–30 шагов с CFG.
MODELS=(
  "schnell|models/gguf/flux1-schnell-Q4_K_S.gguf|4|0.0|Apache 2.0 — коммерческое использование разрешено|card.html|6783943712"
  "dev|models/gguf/flux1-dev-Q4_K_S.gguf|28|3.5|Non-Commercial License — только тесты и оценка|card-dev.html|6805988640"
)

# ── параметры генерации ───────────────────────────────────────────
export FLUX_W=768          # ширина
export FLUX_H=1152         # высота (пропорция карты 2:3)
export FLUX_SEEDS="11,22,33,44"   # 4 варианта = 4 файла, одни и те же сиды для обеих моделей
export FLUX_OUT="out"

export TOKENIZERS_PARALLELISM=false
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export HF_HUB_OFFLINE=1    # веса лежат локально, в сеть ходить не нужно

CARD="empress"
mkdir -p out logs "$LANDING/gen"

done_any=0
for row in "${MODELS[@]}"; do
  IFS='|' read -r label gguf steps guid lic page size <<<"$row"
  # curl создаёт файл сразу, поэтому проверяем размер, а не существование
  got=$( [ -f "$gguf" ] && stat -c%s "$gguf" || echo 0 )
  if [ "$got" -lt "$size" ]; then
    echo "пропускаю $label: $gguf докачан на $((got/1048576)) из $((size/1048576)) МБ"
    continue
  fi
  echo
  echo "═══ $label ═══"
  have=$(ls out/${CARD}-${label}-v*.png 2>/dev/null | wc -l)
  if [ "$have" -ge 4 ]; then
    echo "уже готово ($have шт.), пересобираю только страницу"
  else
    FLUX_GGUF="$gguf" FLUX_STEPS="$steps" FLUX_GUIDANCE="$guid" FLUX_NAME="$CARD-$label" \
      "$PY" generate.py || { echo "✗ $label не сгенерировался"; continue; }
  fi
  done_any=1

  # страницу собираем сразу после своей модели, не дожидаясь остальных
  cp -f out/${CARD}-${label}-v*.png "$LANDING/gen/" 2>/dev/null || true
  CARD="$CARD" PROMPT="$FLUX_PROMPT" W="$FLUX_W" H="$FLUX_H" SEEDS="$FLUX_SEEDS" \
  LABEL="$label" REPO="$gguf" STEPS="$steps" GUIDANCE="$guid" LICENSE="$lic" \
    "$PY" build_page.py > "$LANDING/$page"
  echo "страница: http://127.0.0.1:8899/$page"
done

echo
[ "$done_any" = "1" ] && echo "готово:" || echo "ничего не сгенерировано"
echo "  http://127.0.0.1:8899/card.html      — FLUX.1-schnell"
echo "  http://127.0.0.1:8899/card-dev.html  — FLUX.1-dev"
