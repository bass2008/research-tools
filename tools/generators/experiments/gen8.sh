#!/usr/bin/env bash
# Ждёт восстановления базы, доводит dev до 8 вариантов, подписывает и собирает страницы.
set -uo pipefail
cd "$(dirname "$0")"
PY=/home/sergey/miniconda3/envs/flux/bin/python
LANDING=/home/sergey/Personal/research-tools/project/destiny-matrix
T5=models/FLUX.1-schnell/text_encoder_2/model-00002-of-00002.safetensors

echo "ждём базу..."
for _ in $(seq 1 120); do
  sz=$( [ -f "$T5" ] && stat -c%s "$T5" || echo 0 )
  broken=$(find models/FLUX.1-schnell -xtype l | wc -l)
  [ "$sz" -ge 4530066360 ] && [ "$broken" = "0" ] && break
  sleep 15
done
sz=$( [ -f "$T5" ] && stat -c%s "$T5" || echo 0 )
[ "$sz" -ge 4530066360 ] || { echo "✗ база не восстановилась: T5 $((sz/1048576)) МБ"; exit 1; }
echo "база готова"

export FLUX_PROMPT="tarot card illustration, The Empress, a serene queen seated on a stone throne \
in a blooming garden, wheat field and cypress trees behind her, crown of twelve stars, \
flowing robe with pomegranate pattern, heart-shaped shield with a planetary symbol resting at her feet, \
a small stream in the foreground; elegant art nouveau line art, refined engraving with soft flat colors, \
muted teal and deep petrol blue palette with warm ochre gold accents, cream paper background, \
thin double border frame, centered symmetrical composition, full-body figure, \
vertical card format, no text, no lettering, no watermark, highly detailed, clean lines"
export FLUX_BASE="models/FLUX.1-schnell"
export FLUX_W=768 FLUX_H=1152 FLUX_OUT="out"
export TOKENIZERS_PARALLELISM=false PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export HF_HUB_OFFLINE=1

have=$(ls out/empress-dev-v*.png 2>/dev/null | wc -l)
if [ "$have" -lt 8 ]; then
  echo "═══ dev: сиды 55,66,77,88 (к уже готовым $have) ═══"
  FLUX_GGUF="models/gguf/flux1-dev-Q4_K_S.gguf" FLUX_STEPS=28 FLUX_GUIDANCE=3.5 \
  FLUX_NAME="empress-dev" FLUX_SEEDS="55,66,77,88" FLUX_INDEX_OFFSET="$have" \
    "$PY" generate.py || { echo "✗ генерация не удалась"; exit 1; }
fi

echo "═══ подписи ═══"
# у dev своя нарисованная рамка занимает меньше кадра, чем у schnell
LABEL_GLOB="empress-dev-v*.png" LABEL_DST=out/ru LABEL_FONT=cormorant \
LABEL_CROP_L=0.075 LABEL_CROP_T=0.055 LABEL_CROP_R=0.075 LABEL_CROP_B=0.085 "$PY" label.py
LABEL_GLOB="empress-schnell-v*.png" LABEL_DST=out/ru LABEL_FONT=cormorant "$PY" label.py

mkdir -p "$LANDING/gen/ru"
cp -f out/ru/*.png "$LANDING/gen/ru/"
PAGE_DEV="$LANDING/card-dev.html" PAGE_SCHNELL="$LANDING/card-ru.html" "$PY" page_ru.py
echo
echo "  http://127.0.0.1:8899/card-dev.html  — dev, 8 вариантов с подписью"
echo "  http://127.0.0.1:8899/card-ru.html   — schnell, 4 варианта с подписью"
