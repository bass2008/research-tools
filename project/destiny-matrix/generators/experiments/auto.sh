#!/usr/bin/env bash
# Ждёт докачки весов и запускает генерацию сам: schnell — как только готовы его файлы, dev — позже.
set -uo pipefail
cd "$(dirname "$0")"
M=models
ready() { [ -f "$1" ] && [ "$(stat -c%s "$1")" -ge "$2" ]; }
V=$M/FLUX.1-schnell/vae/diffusion_pytorch_model.safetensors
T=$M/FLUX.1-schnell/text_encoder_2/model-00001-of-00002.safetensors
GS=$M/gguf/flux1-schnell-Q4_K_S.gguf
GD=$M/gguf/flux1-dev-Q4_K_S.gguf

for _ in $(seq 1 720); do   # до 12 часов
  base_ok=0
  ready "$V" 167666902 && ready "$T" 4994582224 && base_ok=1
  s_done=$(ls out/empress-schnell-v*.png 2>/dev/null | wc -l)
  d_done=$(ls out/empress-dev-v*.png 2>/dev/null | wc -l)

  if [ "$base_ok" = "1" ] && ready "$GS" 6783943712 && [ "$s_done" -lt 4 ]; then
    echo "[$(date +%H:%M)] веса schnell готовы — генерирую"
    ./run.sh
  fi
  if [ "$base_ok" = "1" ] && ready "$GD" 6805988640 && [ "$d_done" -lt 4 ]; then
    echo "[$(date +%H:%M)] веса dev готовы — генерирую"
    ./run.sh
  fi

  s_done=$(ls out/empress-schnell-v*.png 2>/dev/null | wc -l)
  d_done=$(ls out/empress-dev-v*.png 2>/dev/null | wc -l)
  if [ "$s_done" -ge 4 ] && [ "$d_done" -ge 4 ]; then
    echo "ОБЕ МОДЕЛИ ГОТОВЫ"
    exit 0
  fi
  sleep 60
done
echo "истекло время ожидания"
