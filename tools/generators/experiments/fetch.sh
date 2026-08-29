#!/usr/bin/env bash
# Устойчивая докачка: рвём соединение, если скорость упала ниже 100 КБ/с на 30 c, и продолжаем.
# Сеть идёт через tailscale exit node и подвисает на длинных передачах — python-загрузчик там залипает молча.
set -uo pipefail
cd "$(dirname "$0")"
TOK=$(cat ~/.cache/huggingface/token)
M=models
mkdir -p $M/FLUX.1-schnell/{text_encoder_2,vae} $M/gguf

get() {  # get <url> <файл> <ожидаемый размер в байтах>
  local url=$1 out=$2 want=$3
  for i in $(seq 1 200); do
    local have=0; [ -f "$out" ] && have=$(stat -c%s "$out")
    [ "$want" != "0" ] && [ "$have" -ge "$want" ] && { echo "✓ готов $out"; return 0; }
    echo "  → $out: $((have/1048576)) МБ из $((want/1048576)) МБ, попытка $i"
    curl -sL -H "Authorization: Bearer $TOK" -C - -o "$out" \
      --speed-limit 102400 --speed-time 30 --connect-timeout 20 "$url" || true
    sleep 2
  done
  echo "✗ не смог: $out"; return 1
}

HF=https://huggingface.co
echo "═══ VAE (168 МБ) ═══"
get "$HF/black-forest-labs/FLUX.1-schnell/resolve/main/vae/diffusion_pytorch_model.safetensors" \
    "$M/FLUX.1-schnell/vae/diffusion_pytorch_model.safetensors" 167666902
echo "═══ трансформер schnell, GGUF Q4_K_S (6,3 ГБ) ═══"
get "$HF/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q4_K_S.gguf" \
    "$M/gguf/flux1-schnell-Q4_K_S.gguf" 6783943712
echo "═══ T5 шард 1 из 2 (4,9 ГБ) ═══"
get "$HF/black-forest-labs/FLUX.1-schnell/resolve/main/text_encoder_2/model-00001-of-00002.safetensors" \
    "$M/FLUX.1-schnell/text_encoder_2/model-00001-of-00002.safetensors" 4994582224
echo "═══ трансформер dev, GGUF Q4_K_S (6,3 ГБ) ═══"
get "$HF/city96/FLUX.1-dev-gguf/resolve/main/flux1-dev-Q4_K_S.gguf" \
    "$M/gguf/flux1-dev-Q4_K_S.gguf" 6805988640
echo "ВСЁ СКАЧАНО"
