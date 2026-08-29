"""Страницы с подписанными картами: dev и schnell. Вызывается из gen8.sh."""
import html
import json
import os
from pathlib import Path

RU = Path("out/ru")
CSS = """
body{margin:0;background:#eef2f4;color:#16283c;font:15px/1.55 Manrope,system-ui,sans-serif;padding:38px 22px}
.wrap{max-width:1320px;margin:0 auto}
h1{font-family:"Cormorant Garamond",Georgia,serif;font-size:32px;margin:0 0 8px;font-weight:600}
h1 code{font:600 14px/1 ui-monospace,monospace;color:#0e8f88;background:#e6f2f1;
  border-radius:6px;padding:4px 9px;vertical-align:3px}
.lic{font-size:13px;margin:0 0 8px;font-weight:600}.ok{color:#0b7a74}.no{color:#c9453a}
.sub{color:#5a6d7d;font-size:14px;margin:0 0 16px;max-width:100ch}
.meta{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 22px}
.meta span{font-size:12.5px;color:#5a6d7d;background:#fff;border:1px solid #dee6ea;
  border-radius:999px;padding:5px 12px}
.row{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media(max-width:1100px){.row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.row{grid-template-columns:1fr}}
figure{margin:0;background:#fff;border:1px solid #dee6ea;border-radius:14px;padding:11px;
  box-shadow:0 14px 34px -18px rgba(18,40,60,.32)}
figure img{display:block;width:100%;height:auto;border-radius:8px}
figcaption{font-size:12.4px;color:#8395a3;text-align:center;padding-top:9px}
figcaption b{color:#0e8f88;font-weight:700}
.nav{margin:30px 0 0;font-size:13.4px;color:#5a6d7d}.nav a{color:#0b7a74}
"""


def page(label, title, lic, lic_cls, out_path, nav):
    imgs = sorted(RU.glob(f"empress-{label}-v*-ru.png"),
                  key=lambda p: int(p.stem.split("-v")[1].split("-")[0]))
    meta = Path(f"out/empress-{label}-meta.json")
    chips = []
    if meta.exists():
        m = json.loads(meta.read_text(encoding="utf-8"))
        seconds = {r["file"]: r["seconds"] for r in m["runs"]}
        seeds = {r["file"]: r["seed"] for r in m["runs"]}
        avg = sum(seconds.values()) / max(len(seconds), 1)
        chips = [f"{m['width']}×{m['height']}", f"шагов {m['steps']}",
                 f"guidance {m['guidance']}", f"~{avg:.0f} c на карту",
                 f"пик VRAM {m['vram_peak_gb']} ГБ", f"вариантов {len(imgs)}"]
    else:
        seconds, seeds = {}, {}

    parts = ['<!doctype html><html lang="ru"><head><meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width,initial-scale=1">',
             f"<title>Императрица — {html.escape(label)}</title>",
             '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600'
             '&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">',
             f"<style>{CSS}</style></head><body><div class=wrap>",
             f"<h1>{html.escape(title)}</h1>",
             f'<p class="lic {lic_cls}">{html.escape(lic)}</p>',
             "<p class=sub>Иллюстрация — от модели, всё остальное нарисовано кодом: рамка, "
             "уголки, номер аркана, название и девиз шрифтом Cormorant Garamond, тем же, что в "
             "заголовках лендинга. Модель кириллицу не умеет и врёт в буквах, поэтому её рамку "
             "с подписями обрезаем.</p>",
             '<div class="meta">' + "".join(f"<span>{html.escape(c)}</span>" for c in chips)
             + "</div>", '<div class="row">']
    for i, p in enumerate(imgs, 1):
        src = f"empress-{label}-v{i}.png"
        sd = seeds.get(src, "?")
        sec = seconds.get(src)
        tail = f" · {sec:.0f} c" if sec else ""
        parts.append(f'<figure><img src="gen/ru/{p.name}" alt="вариант {i}">'
                     f'<figcaption>Вариант <b>{i}</b> · seed {sd}{tail}</figcaption></figure>')
    parts += ["</div>", f'<p class=nav>{nav}</p>', "</div></body></html>"]
    Path(out_path).write_text("\n".join(parts), encoding="utf-8")
    print(f"  {out_path}: {len(imgs)} карт")


page("dev", "«Императрица» — FLUX.1-dev, 8 вариантов",
     "Non-Commercial License — только тесты и оценка, в продукт нельзя", "no",
     os.environ["PAGE_DEV"],
     'Другие: <a href="card-ru.html">schnell с подписью</a> · '
     '<a href="card.html">schnell без подписи</a>')
page("schnell", "«Императрица» — FLUX.1-schnell",
     "Apache 2.0 — коммерческое использование разрешено", "ok",
     os.environ["PAGE_SCHNELL"],
     'Другие: <a href="card-dev.html">dev, 8 вариантов</a> · '
     '<a href="card.html">schnell без подписи</a>')
