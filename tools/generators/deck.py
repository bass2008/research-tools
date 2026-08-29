"""Собирает колоду для сайта: выбранный сид каждого аркана → webp в нумерации матрицы судьбы.

Выбор сидов лежит в seeds.json: {"empress": 7, ...}; для остальных берётся сид по умолчанию.
Сканы Уэйта (arcana-NN.webp) не трогаются — наши файлы называются gen-NN.webp, чтобы можно
было вернуться одной правкой пути в index.html.

    python deck.py            # все карты на сиде по умолчанию
    DECK_SEED=3 python deck.py
"""
import json
import os
from pathlib import Path

from PIL import Image

import arcana

SRC = Path(os.environ.get("DECK_SRC", "out/100"))
DST = Path(os.environ.get("DECK_DST",
                          "/home/sergey/Personal/research-tools/project/destiny-matrix/web/public/img/arcana"))
WIDTH = int(os.environ.get("DECK_WIDTH", 520))     # на сайте карта показывается не шире 260 px
QUALITY = int(os.environ.get("DECK_QUALITY", 78))
DEFAULT_SEED = int(os.environ.get("DECK_SEED", 1))
CHOICES = Path(os.environ.get("DECK_CHOICES", "seeds.json"))

chosen = json.loads(CHOICES.read_text(encoding="utf-8")) if CHOICES.exists() else {}
DST.mkdir(parents=True, exist_ok=True)

total = 0
missing = []
for num, slug in enumerate(arcana.MATRIX, 1):
    seed = int(chosen.get(slug, DEFAULT_SEED))
    src = SRC / slug / f"seed-{seed:04d}.png"
    if not src.exists():
        missing.append(f"{arcana.ru_title(slug)} (сид {seed})")
        continue
    img = Image.open(src).convert("RGB")
    img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
    out = DST / f"gen-{num:02d}.webp"
    img.save(out, "WEBP", quality=QUALITY, method=6)
    kb = out.stat().st_size / 1024
    total += kb
    print(f"  {num:>2}  {arcana.ru_title(slug):18s} сид {seed:<4} → {out.name}  {kb:5.0f} КБ")

if missing:
    print("\nне найдено:", ", ".join(missing))
print(f"\nготово: {22 - len(missing)} карт, {total / 1024:.1f} МБ, {WIDTH}px по ширине")
