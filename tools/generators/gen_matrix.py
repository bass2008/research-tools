"""По COUNT вариантов каждого аркана → out/images/NN-slug-vK.png (NN — номер матрицы судьбы).

Страница на аркан: out/1.html … out/22.html в порядке MATRIX (1=Магистр … 22=Шут).
Готовые файлы пропускаются, прогон можно рвать и продолжать.
"""
import gc
import html
import os
import time
from pathlib import Path

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import torch
from diffusers import FluxPipeline, FluxTransformer2DModel, GGUFQuantizationConfig
from transformers import BitsAndBytesConfig as TrBnb
from transformers import T5EncoderModel

import arcana
import pages

BASE = os.environ.get("FLUX_BASE", "models/base")
GGUF = os.environ.get("FLUX_GGUF", "models/gguf/flux1-dev-Q4_K_S.gguf")
TR_CONFIG = os.environ.get("FLUX_TR_CONFIG", "models/FLUX.1-dev")
STEPS = int(os.environ.get("FLUX_STEPS", 28))
GUIDANCE = float(os.environ.get("FLUX_GUIDANCE", 3.5))
W = int(os.environ.get("FLUX_W", 768))
H = int(os.environ.get("FLUX_H", 1152))
COUNT = int(os.environ.get("ARC_COUNT", 2))
OUT = Path(os.environ.get("ARC_OUT", "out"))
IMG = OUT / "images"


def variants(num, slug):
    return sorted(IMG.glob(f"{num:02d}-{slug}-v*.png"),
                  key=lambda p: int(p.stem.rsplit("v", 1)[1]))


def build_page(num, slug):
    files = variants(num, slug)
    ru, rom = arcana.ru_title(slug), arcana.roman(slug)
    links = " ".join(f'<a href="{n}.html">{n}</a>' for n in range(1, 23))
    prev = f'<a href="{num - 1}.html">← {num - 1}</a> ' if num > 1 else ""
    nxt = f'<a href="{num + 1}.html">{num + 1} →</a>' if num < 22 else ""
    parts = pages.head(f"{num}. {ru} — варианты")
    parts += [f"<h1>{num}. {html.escape(rom)} · {html.escape(ru)} — "
              f"<span>{len(files)}</span> из {COUNT}</h1>",
              "<p class=sub>Как отдала модель: без рамок, подписей и обработки. "
              "Под картинкой её вариант.</p>",
              f"<p class=prm><b>Промпт:</b> {html.escape(arcana.prompt(slug))}</p>",
              '<div class="grid">']
    for f in files:
        k = int(f.stem.rsplit("v", 1)[1])
        parts.append(f'<figure><a href="images/{f.name}" target="_blank">'
                     f'<img src="images/{f.name}" alt="вариант {k}" loading="lazy"></a>'
                     f'<figcaption>вариант <b>{k}</b></figcaption></figure>')
    parts += ["</div>", f'<p class=nav><span class=home>{prev}{nxt}</span><br>{links}</p>',
              "</div></body></html>"]
    (OUT / f"{num}.html").write_text("\n".join(parts), encoding="utf-8")


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    print(f"модель      : {GGUF}")
    print(f"арканы      : 22, по {COUNT} варианта, {W}×{H}, шагов {STEPS}, guidance {GUIDANCE}")
    print(f"выход       : {IMG} + {OUT}/1.html … {OUT}/22.html", flush=True)

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

    arc = list(enumerate(arcana.MATRIX, 1))
    # волнами по варианту на все 22 аркана: обрыв оставляет пул равномерным, а не первые полные
    for num, slug in arc:
        build_page(num, slug)   # все страницы 1..22 есть сразу, до генерации
    for k in range(1, COUNT + 1):
        print(f"═══ круг v{k} ═══", flush=True)
        for num, slug in arc:
            path = IMG / f"{num:02d}-{slug}-v{k}.png"
            if path.exists():
                continue
            t = time.time()
            img = pipe(prompt=arcana.prompt(slug), width=W, height=H, num_inference_steps=STEPS,
                       guidance_scale=GUIDANCE, max_sequence_length=256,
                       generator=torch.Generator("cpu").manual_seed(k)).images[0]
            img.save(path)
            del img
            gc.collect()
            torch.cuda.empty_cache()
            build_page(num, slug)
            print(f"  [{num:02d}-{slug}] v{k} {time.time() - t:5.1f} c", flush=True)

    print("ВСЕ АРКАНЫ ГОТОВЫ", flush=True)


if __name__ == "__main__":
    main()
