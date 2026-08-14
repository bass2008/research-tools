#!/usr/bin/env bash
# Восстанавливает мелкие части базы реальными файлами (раньше это были ссылки в кэш HF).
set -uo pipefail
cd "$(dirname "$0")"
TOK=$(cat ~/.cache/huggingface/token)
REPO=black-forest-labs/FLUX.1-schnell
D=models/FLUX.1-schnell

FILES=(
  model_index.json
  scheduler/scheduler_config.json
  tokenizer/merges.txt tokenizer/special_tokens_map.json
  tokenizer/tokenizer_config.json tokenizer/vocab.json
  tokenizer_2/special_tokens_map.json tokenizer_2/spiece.model
  tokenizer_2/tokenizer.json tokenizer_2/tokenizer_config.json
  text_encoder/config.json text_encoder/model.safetensors
  text_encoder_2/config.json text_encoder_2/model.safetensors.index.json
  text_encoder_2/model-00002-of-00002.safetensors
  transformer/config.json vae/config.json
)

for rel in "${FILES[@]}"; do
  out="$D/$rel"
  [ -L "$out" ] && rm -f "$out"          # битая ссылка на удалённый кэш
  mkdir -p "$(dirname "$out")"
  for i in $(seq 1 60); do
    curl -sfL -H "Authorization: Bearer $TOK" -C - -o "$out" \
      --speed-limit 51200 --speed-time 30 --connect-timeout 20 \
      "https://huggingface.co/$REPO/resolve/main/$rel" && break
    echo "  повтор $i: $rel"
    sleep 3
  done
  printf "✓ %-52s %6.1f МБ\n" "$rel" "$(stat -c%s "$out" 2>/dev/null | awk '{print $1/1048576}')"
done
echo "БАЗА ВОССТАНОВЛЕНА"
