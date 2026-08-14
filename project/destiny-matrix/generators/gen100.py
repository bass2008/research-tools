"""По N вариантов каждого аркана моделью dev — чтобы выбрать сид для финальной карты.

Картинки без подписей, как отдала модель. Имя файла — сид, под каждой картинкой на странице
стоит его номер. Готовые сиды пропускаются, поэтому прогон можно останавливать и продолжать.
"""
import gc
import json
import os
import time
from pathlib import Path

# до импорта torch: иначе настройка аллокатора не применится и 8 ГБ не хватит
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import torch
from diffusers import FluxPipeline, FluxTransformer2DModel, GGUFQuantizationConfig
from transformers import BitsAndBytesConfig as TrBnb
from transformers import T5EncoderModel

import arcana
import pages

# CLIP, T5 и VAE общие для семейства FLUX — лежат под нейтральным именем models/base
BASE = os.environ.get("FLUX_BASE", "models/base")
GGUF = os.environ.get("FLUX_GGUF", "models/gguf/flux1-dev-Q4_K_S.gguf")
# конфиг только от dev: у schnell guidance_embeds=False, и guidance_scale тихо игнорируется
TR_CONFIG = os.environ.get("FLUX_TR_CONFIG", "models/FLUX.1-dev")
STEPS = int(os.environ.get("FLUX_STEPS", 28))
GUIDANCE = float(os.environ.get("FLUX_GUIDANCE", 3.5))
W = int(os.environ.get("FLUX_W", 768))
H = int(os.environ.get("FLUX_H", 1152))
COUNT = int(os.environ.get("ARC_COUNT", 100))
SEED_FROM = int(os.environ.get("ARC_SEED_FROM", 1))
SLUGS = os.environ.get("ARC_SLUGS", "").strip()
OUT = Path(os.environ.get("ARC_OUT", "out/100"))   # деревья разных режимов не смешиваем

order = [a[0] for a in sorted(arcana.ARCANA, key=lambda a: a[1])]
slugs = [s for s in SLUGS.split(",") if s] if SLUGS else ["empress"] + [s for s in order
                                                                       if s != "empress"]

print(f"модель      : {GGUF}")
print(f"арканы      : {len(slugs)} → {', '.join(slugs[:4])}{'…' if len(slugs) > 4 else ''}")
print(f"вариантов   : {COUNT} на аркан, сиды {SEED_FROM}–{SEED_FROM + COUNT - 1}")
print(f"параметры   : {W}×{H}, шагов {STEPS}, guidance {GUIDANCE}")
print(flush=True)

t0 = time.time()
tr = FluxTransformer2DModel.from_single_file(
    GGUF, quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
    torch_dtype=torch.bfloat16, config=TR_CONFIG, subfolder="transformer")
te2 = T5EncoderModel.from_pretrained(
    BASE, subfolder="text_encoder_2", torch_dtype=torch.bfloat16,
    quantization_config=TrBnb(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                              bnb_4bit_compute_dtype=torch.bfloat16))
pipe = FluxPipeline.from_pretrained(BASE, transformer=tr, text_encoder_2=te2,
                                   torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()
pipe.vae.enable_slicing()
pipe.vae.enable_tiling()
print(f"пайплайн собран за {time.time() - t0:.0f} c\n", flush=True)

for slug in slugs:
    d = OUT / slug
    d.mkdir(parents=True, exist_ok=True)
    prompt = arcana.prompt(slug)
    pages.build_page(slug, COUNT)
    pages.build_index(COUNT)
    print(f"═══ {arcana.roman(slug)} {arcana.ru_title(slug)} ═══", flush=True)
    t_arc = time.time()
    made = 0
    for seed in range(SEED_FROM, SEED_FROM + COUNT):
        path = d / f"seed-{seed:04d}.png"
        if path.exists():
            continue
        t = time.time()
        img = pipe(prompt=prompt, width=W, height=H, num_inference_steps=STEPS,
                   guidance_scale=GUIDANCE, max_sequence_length=256,
                   generator=torch.Generator("cpu").manual_seed(seed)).images[0]
        img.save(path)
        made += 1
        del img
        gc.collect()
        torch.cuda.empty_cache()
        pages.build_page(slug, COUNT)   # страницу видно сразу, не дожидаясь конца
        if made % 5 == 0:
            pages.build_index(COUNT)
        print(f"  [{slug}] seed={seed:<5} {time.time() - t:5.1f} c  всего "
              f"{len(list(d.glob('seed-*.png')))}/{COUNT}", flush=True)
    pages.build_page(slug, COUNT)
    (d / "meta.json").write_text(json.dumps(
        {"slug": slug, "prompt": prompt, "steps": STEPS, "guidance": GUIDANCE,
         "width": W, "height": H, "seeds": [SEED_FROM, SEED_FROM + COUNT - 1],
         "minutes": round((time.time() - t_arc) / 60, 1)}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    pages.build_index(COUNT)
    print(f"✓ {slug}: {len(list(d.glob('seed-*.png')))} шт за "
          f"{(time.time() - t_arc) / 60:.0f} мин", flush=True)

print("ВСЕ АРКАНЫ ГОТОВЫ", flush=True)
