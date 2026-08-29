"""Страница одной модели: 4 варианта карты и замеры из meta.json. Вызывается из run.sh."""
import html
import json
import os
from pathlib import Path

CARD = os.environ["CARD"]
PROMPT = os.environ["PROMPT"]
W, H = os.environ["W"], os.environ["H"]
QUANT = os.environ.get("QUANT", "")
SEEDS = os.environ["SEEDS"].split(",")
LABEL = os.environ["LABEL"]
REPO = os.environ["REPO"]
STEPS = os.environ["STEPS"]
GUIDANCE = os.environ["GUIDANCE"]
LICENSE = os.environ["LICENSE"]
MODEL_NAME = ("FLUX.1-schnell" if LABEL == "schnell" else "FLUX.1-dev") \
    + " · " + os.path.basename(REPO)
OUT = Path("out")

CSS = """
body{margin:0;background:#eef2f4;color:#16283c;font:15px/1.55 Manrope,system-ui,sans-serif;padding:38px 22px}
.wrap{max-width:1240px;margin:0 auto}
h1{font-family:"Cormorant Garamond",Georgia,serif;font-size:31px;margin:0 0 8px;font-weight:600}
h1 code{font:600 15px/1 ui-monospace,monospace;color:#0e8f88;background:#e6f2f1;
  border-radius:6px;padding:4px 9px;vertical-align:3px}
.lic{font-size:13px;margin:0 0 6px;font-weight:600}
.ok{color:#0b7a74}.no{color:#c9453a}
.sub{color:#5a6d7d;font-size:14px;margin:0 0 16px}
.meta{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 18px}
.meta span{font-size:12.5px;color:#5a6d7d;background:#fff;border:1px solid #dee6ea;
  border-radius:999px;padding:5px 12px}
.prm{color:#8395a3;font-size:12.6px;max-width:100ch;margin:0 0 26px;line-height:1.5}
.prm b{color:#5a6d7d}
.row{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media(max-width:1000px){.row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.row{grid-template-columns:1fr}}
figure{margin:0;background:#fff;border:1px solid #dee6ea;border-radius:14px;padding:11px;
  box-shadow:0 14px 34px -18px rgba(18,40,60,.32)}
figure img{display:block;width:100%;height:auto;border-radius:8px}
figcaption{font-size:12.4px;color:#8395a3;text-align:center;padding-top:9px}
figcaption b{color:#0e8f88;font-weight:700}
.nav{margin:30px 0 0;font-size:13.4px;color:#5a6d7d}
.nav a{color:#0b7a74}
.miss{color:#c9453a;font-size:13.4px}
"""

imgs = sorted(OUT.glob(f"{CARD}-{LABEL}-v*.png"))
meta_path = OUT / f"{CARD}-{LABEL}-meta.json"

chips = [f"{W}×{H}", f"шагов {STEPS}", f"guidance {GUIDANCE}"]
if QUANT:
    chips.append(f"квантование {QUANT}")
seconds = {}
if meta_path.exists():
    m = json.loads(meta_path.read_text(encoding="utf-8"))
    seconds = {r["file"]: r["seconds"] for r in m["runs"]}
    chips += [f"загрузка модели {m['load_seconds']:.0f} c",
              f"генерация {m['total_seconds'] - m['load_seconds']:.0f} c на {len(m['runs'])} карт",
              f"пик VRAM {m['vram_peak_gb']} ГБ"]

other = ("card-dev.html", "FLUX.1-dev") if LABEL == "schnell" else ("card.html", "FLUX.1-schnell")
parts = [
    '<!doctype html><html lang="ru"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    f"<title>{html.escape(CARD)} — {html.escape(LABEL)}</title>",
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600'
    '&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">',
    f"<style>{CSS}</style></head><body><div class=wrap>",
    f"<h1>«Императрица» <code>{html.escape(MODEL_NAME)}</code></h1>",
    f'<p class="lic {"ok" if "Apache" in LICENSE else "no"}">{html.escape(LICENSE)}</p>',
    "<p class=sub>Сгенерировано локально на RTX 4070 Laptop, 8 ГБ VRAM. "
    "Четыре варианта — четыре сида на одном промпте.</p>",
    '<div class="meta">' + "".join(f"<span>{html.escape(c)}</span>" for c in chips) + "</div>",
    f"<p class=prm><b>Промпт:</b> {html.escape(PROMPT)}</p>",
]

if not imgs:
    parts.append('<p class="miss">картинок нет — генерация не дошла до конца</p>')
else:
    parts.append('<div class="row">')
    for i, p in enumerate(imgs, 1):
        sd = SEEDS[i - 1] if i <= len(SEEDS) else "?"
        sec = seconds.get(p.name)
        tail = f" · {sec:.0f} c" if sec else ""
        parts.append(f'<figure><img src="gen/{p.name}" alt="{html.escape(LABEL)} вариант {i}">'
                     f'<figcaption>Вариант <b>{i}</b> · seed {sd}{tail}</figcaption></figure>')
    parts.append("</div>")

parts.append(f'<p class=nav>Другая модель: <a href="{other[0]}">{other[1]}</a></p>')
parts.append("</div></body></html>")
print("\n".join(parts))
