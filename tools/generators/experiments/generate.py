"""FLUX: 4 варианта одной карты за один запуск. Параметры — в run.sh."""
import gc
import json
import os
import time
from pathlib import Path

import torch
from diffusers import FluxPipeline

BASE = os.environ.get("FLUX_BASE", "black-forest-labs/FLUX.1-schnell")
GGUF = os.environ.get("FLUX_GGUF", "")  # путь к квантованному трансформеру; пусто — грузим из BASE
PROMPT = os.environ["FLUX_PROMPT"]
W = int(os.environ.get("FLUX_W", 768))
H = int(os.environ.get("FLUX_H", 1152))
STEPS = int(os.environ.get("FLUX_STEPS", 4))
GUIDANCE = float(os.environ.get("FLUX_GUIDANCE", 0.0))
SEEDS = [int(x) for x in os.environ.get("FLUX_SEEDS", "1,2,3,4").split(",")]
OUT = Path(os.environ.get("FLUX_OUT", "out"))
NAME = os.environ.get("FLUX_NAME", "card")
OFFSET = int(os.environ.get("FLUX_INDEX_OFFSET", 0))  # дописать варианты к уже готовым

OUT.mkdir(parents=True, exist_ok=True)
print(f"база        : {BASE}")
print(f"трансформер : {GGUF or 'из базы, nf4 на лету'}")
print(f"размер      : {W}×{H}, шагов {STEPS}, guidance {GUIDANCE}")
print(f"вариантов   : {len(SEEDS)} (сиды {SEEDS})")
print(flush=True)

t0 = time.time()
from diffusers import BitsAndBytesConfig as DiffBnb
from diffusers import FluxTransformer2DModel, GGUFQuantizationConfig
from transformers import BitsAndBytesConfig as TrBnb
from transformers import T5EncoderModel

# 8 ГБ VRAM: трансформер квантован (готовый GGUF или nf4 на лету), T5 — в 4 бита
if GGUF:
    tr = FluxTransformer2DModel.from_single_file(
        GGUF, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        torch_dtype=torch.bfloat16, config=BASE, subfolder="transformer")
else:
    tr = FluxTransformer2DModel.from_pretrained(
        BASE, subfolder="transformer", torch_dtype=torch.bfloat16,
        quantization_config=DiffBnb(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                    bnb_4bit_compute_dtype=torch.bfloat16))
te2 = T5EncoderModel.from_pretrained(
    BASE, subfolder="text_encoder_2", torch_dtype=torch.bfloat16,
    quantization_config=TrBnb(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                              bnb_4bit_compute_dtype=torch.bfloat16))
pipe = FluxPipeline.from_pretrained(BASE, transformer=tr, text_encoder_2=te2,
                                   torch_dtype=torch.bfloat16)

pipe.enable_model_cpu_offload()
pipe.vae.enable_slicing()
pipe.vae.enable_tiling()
load_s = time.time() - t0
print(f"пайплайн собран за {load_s:.0f} c\n", flush=True)

meta_path = OUT / f"{NAME}-meta.json"
runs = []
if OFFSET and meta_path.exists():
    runs = json.loads(meta_path.read_text(encoding="utf-8"))["runs"]
for i, seed in enumerate(SEEDS, 1):
    t = time.time()
    img = pipe(
        prompt=PROMPT,
        width=W, height=H,
        num_inference_steps=STEPS,
        guidance_scale=GUIDANCE,
        max_sequence_length=256,
        generator=torch.Generator("cpu").manual_seed(seed),
    ).images[0]
    path = OUT / f"{NAME}-v{i + OFFSET}.png"
    img.save(path)
    took = time.time() - t
    vram = torch.cuda.max_memory_allocated() / 2**30 if torch.cuda.is_available() else 0
    runs.append({"file": path.name, "seed": seed, "seconds": round(took, 1)})
    print(f"[{i}/{len(SEEDS)}] seed={seed:<6} {took:5.1f} c  VRAM пик {vram:.1f} ГБ  →  {path}",
          flush=True)
    del img
    gc.collect()
    torch.cuda.empty_cache()

total = time.time() - t0
meta_path.write_text(json.dumps({
    "base": BASE, "gguf": GGUF, "steps": STEPS, "guidance": GUIDANCE,
    "width": W, "height": H, "load_seconds": round(load_s, 1),
    "total_seconds": round(total, 1),
    "vram_peak_gb": round(torch.cuda.max_memory_allocated() / 2**30, 1)
    if torch.cuda.is_available() else 0,
    "runs": runs,
}, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"\nготово за {total:.0f} c, файлы в {OUT.resolve()}")
