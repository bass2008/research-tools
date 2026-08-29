"""Сборка страниц выбора сидов. Запуск без аргументов пересобирает все страницы по файлам на диске.

Отделено от генерации, чтобы менять оформление, не трогая картинки:
    python pages.py
"""
import html
import json
import os
from pathlib import Path

import arcana

OUT = Path(os.environ.get("ARC_OUT", "out/100"))
LANDING = Path(os.environ.get("ARC_LANDING", "/home/sergey/Personal/research-tools/project/destiny-matrix/legacy"))
ORDER = [a[0] for a in sorted(arcana.ARCANA, key=lambda a: a[1])]
PREFIX = os.environ.get("ARC_PREFIX", "card-100")   # префикс страниц: своё дерево — свои страницы
NOTE = os.environ.get("ARC_NOTE", "")               # пометка режима в подзаголовке

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?'
         'family=Cormorant+Garamond:wght@400;500;600;700&'
         'family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">')

CSS = """
:root{--ink:#16283c;--dim:#5a6d7d;--dim2:#8395a3;--line:#dee6ea;--teal:#0e8f88;--gold:#b8902a}
*{box-sizing:border-box}
body{margin:0;background:#eef2f4;color:var(--ink);padding:34px 22px;
  font:15px/1.5 Manrope,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1560px;margin:0 auto}
h1{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:40px;line-height:1.1;
  letter-spacing:.01em;margin:0 0 10px;font-variant-numeric:lining-nums;font-feature-settings:"lnum" 1}
h1 span{color:var(--teal);font-variant-numeric:lining-nums}
.sub{color:var(--dim);font-size:14.4px;max-width:78ch;margin:0 0 20px}
.prm{color:var(--dim2);font-size:12.4px;max-width:118ch;margin:0 0 20px;line-height:1.5}
.prm b{color:var(--dim);font-weight:600}
.bar{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 24px}
.bar span,.bar a{font-size:12.4px;color:var(--dim);background:#fff;border:1px solid var(--line);
  border-radius:999px;padding:5px 12px;text-decoration:none}
.bar a:hover{border-color:var(--teal);color:#0b7a74}

.tiles,.grid{display:grid;gap:16px;grid-template-columns:repeat(6,1fr)}
@media(max-width:1400px){.tiles,.grid{grid-template-columns:repeat(5,1fr)}}
@media(max-width:1150px){.tiles,.grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:900px){.tiles,.grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:620px){.tiles,.grid{grid-template-columns:repeat(2,1fr)}}

figure,.tile{margin:0;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px;
  text-decoration:none;display:block;box-shadow:0 10px 26px -18px rgba(18,40,60,.34)}
.tile{transition:border-color .15s,transform .15s}
.tile:hover{border-color:var(--teal);transform:translateY(-2px)}
figure img,.tile img{display:block;width:100%;height:auto;border-radius:7px}
.tile .empty{aspect-ratio:2/3;display:grid;place-items:center;color:#a9b8c2;font-size:12.5px;
  background:#f4f7f8;border-radius:7px}

.cap{display:block;text-align:center;padding:9px 2px 3px}
.cap .rom{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:15.5px;
  color:var(--gold);letter-spacing:.09em;font-variant-numeric:lining-nums;font-feature-settings:"lnum" 1}
.cap .name{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:20px;
  color:var(--ink);letter-spacing:.015em;display:block;margin-top:1px;line-height:1.15}
.cap .cnt{font-size:11.6px;color:var(--dim2);letter-spacing:.04em;display:block;margin-top:3px}

figcaption{text-align:center;padding-top:8px;font-size:12.2px;color:var(--dim2);letter-spacing:.03em}
figcaption b{font-family:"Cormorant Garamond",Georgia,serif;font-weight:700;font-size:17.5px;
  color:var(--teal);letter-spacing:.02em;font-variant-numeric:lining-nums;font-feature-settings:"lnum" 1}
.nav{margin:28px 0 0;font-size:13px;color:var(--dim);line-height:2}
.nav a{color:#0b7a74;margin-right:13px;text-decoration:none;border-bottom:1px solid #cfe3e1}
.nav a:hover{border-color:#0b7a74}
.nav .home{font-weight:600}
"""


def head(title, extra=""):
    return ['<!doctype html><html lang="ru"><head><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width,initial-scale=1">',
            f"<title>{html.escape(title)}</title>", FONTS,
            f"<style>{CSS}{extra}</style></head><body><div class=wrap>"]


def meta_of(slug):
    p = OUT / slug / "meta.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def files_of(slug):
    return sorted((OUT / slug).glob("seed-*.png"), key=lambda p: int(p.stem.split("-")[1]))


def build_page(slug, planned=None):
    files = files_of(slug)
    m = meta_of(slug)
    ru, rom = arcana.ru_title(slug), arcana.roman(slug)
    total = max(planned or 0, len(files))
    chips = []
    if m:
        chips = [f"{m['width']}×{m['height']}", f"шагов {m['steps']}",
                 f"guidance {m['guidance']}", f"сиды {m['seeds'][0]}–{m['seeds'][1]}"]
    links = " ".join(f'<a href="card-100-{s}.html">{arcana.ru_title(s)}</a>' for s in ORDER)
    parts = head(f"{ru} — варианты")
    parts += [f"<h1>{html.escape(rom)} · {html.escape(ru)} — <span>{len(files)}</span> "
              f"из {total} вариантов</h1>",
              f"<p class=sub>{html.escape(NOTE)} Как отдала модель: без рамок, подписей и обработки. "
              "Под каждой картинкой её сид — он воспроизводит эту картинку точно.</p>",
              f"<p class=prm><b>Промпт:</b> {html.escape(arcana.prompt(slug))}</p>",
              '<div class="bar">' + "".join(f"<span>{html.escape(c)}</span>" for c in chips)
              + "</div>", '<div class="grid">']
    for f in files:
        sd = int(f.stem.split("-")[1])
        parts.append(f'<figure><a href="gen/100/{slug}/{f.name}" target="_blank">'
                     f'<img src="gen/100/{slug}/{f.name}" alt="сид {sd}" loading="lazy"></a>'
                     f'<figcaption>сид <b>{sd}</b></figcaption></figure>')
    parts += ["</div>", f'<p class=nav><a class=home href=f"{PREFIX}-index.html">← все арканы</a> '
              f'{links}</p>', "</div></body></html>"]
    (LANDING / f"{PREFIX}-{slug}.html").write_text("\n".join(parts), encoding="utf-8")
    if slug == "empress" and PREFIX == "card-100":
        (LANDING / "card100.html").write_text("\n".join(parts), encoding="utf-8")
    return len(files)


def build_index(planned=None):
    tiles, total = [], 0
    for slug in ORDER:
        files = files_of(slug)
        total += len(files)
        thumb = (f'<img src="gen/100/{slug}/{files[0].name}" alt="" loading="lazy">'
                 if files else '<div class="empty">ещё нет</div>')
        tiles.append(
            f'<a class="tile" href="{PREFIX}-{slug}.html">{thumb}<span class="cap">'
            f'<span class="rom">{html.escape(arcana.roman(slug))}</span>'
            f'<span class="name">{html.escape(arcana.ru_title(slug))}</span>'
            f'<span class="cnt">{len(files)} вариантов</span></span></a>')
    per = planned or (max((len(files_of(s)) for s in ORDER), default=0))
    parts = head("Старшие арканы — варианты")
    parts += [f"<h1>Старшие арканы — <span>{total}</span> вариантов, по {per} на карту</h1>",
              f"<p class=sub>{html.escape(NOTE)} Открой аркан и выбери сид — "
              "по нему карта воспроизводится точно, в любом разрешении.</p>",
              '<div class="tiles">'] + tiles + ["</div>", "</div></body></html>"]
    (LANDING / f"{PREFIX}-index.html").write_text("\n".join(parts), encoding="utf-8")
    return total


if __name__ == "__main__":
    n = build_index()
    for slug in ORDER:
        build_page(slug)
    print(f"страницы пересобраны: {len(ORDER) + 2} шт, картинок {n}")
