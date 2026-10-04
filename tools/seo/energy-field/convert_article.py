#!/usr/bin/env python3
"""Статья об энергополе: Markdown → источник шапки категории `category-hubs/energy-field.json`.

Два полных толкования из статьи (10-10-11 и 9-9-9) уходят в корпус через `ru/overrides.json`,
а в статье на их месте остаётся блок `chakra_reading`: текст живёт в одном месте.

    python3 tools/seo/energy-field/convert_article.py /home/sergey/Personal/example-1-2-3-opus.md [--lang en] [--out file]
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "tools/seo/content/{lang}/category-hubs/energy-field.json"
TRIPLES = {"10-10-11", "9-9-9"}

BASE = {
    "key": "energy-field",
    "crumb": "Общее энергополе",
    "seo": {"queries": [
        "энергополе в матрице судьбы", "энергополе в матрице судьбы где",
        "где находится энергополе в матрице судьбы", "энергополе в матрице судьбы рассчитать",
        "матрица судьбы общее энергополе", "общее энергополе в матрице судьбы",
        "где посмотреть энергополе в матрице судьбы",
    ]},
    "related": ["position/chakras", "chakra", "energies", "method"],
}
# The English corpus has no energy-field readings, so the English article keeps its examples inline.
BASE_EN = {
    "key": "energy-field",
    "crumb": "Overall energy field",
    "seo": {"queries": [
        "overall energy field in the destiny matrix", "destiny matrix energy field",
        "where is the energy field in the destiny matrix", "destiny matrix energy field calculation",
    ]},
    "related": BASE["related"],
}
FIXES = {
    "У двух случайных дней того же месяца совпадение бывает в 4% случаев.":
        "У двух случайных дней того же месяца совпадение бывает примерно в 6% случаев.",
}


def load_converter():
    spec = importlib.util.spec_from_file_location("md_to_content", ROOT / "tools/seo/md-to-content.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main(markdown: Path, lang: str, out: Path | None) -> int:
    target = Path(str(OUT).format(lang=lang))
    out = out or target
    m2c = load_converter()
    text = markdown.read_text(encoding="utf-8")
    rep = m2c.Report()
    if lang != "ru":
        item = m2c.convert(text, BASE_EN, rep, keep_intro=True)
        out.write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for note in rep.notes:
            print(f"  ~ {note}")
        print(f"записано: {out}")
        return 0
    for old, new in FIXES.items():
        if old not in text:
            print(f"не найдено для правки: {old}")
            return 1
        text = text.replace(old, new)
    item = m2c.convert(text, BASE, rep, keep_intro=True)

    overrides = {}
    for section in item["sections"]:
        paragraphs = section["paragraphs"]
        for i, p in enumerate(paragraphs):
            if not (isinstance(p, dict) and "h3" in p and i + 4 < len(paragraphs)):
                continue
            table = paragraphs[i + 1]
            triple = next((t for t in TRIPLES if t in section["h2"]), None)
            if not triple or not (isinstance(table, dict) and "table" in table):
                continue
            body = paragraphs[i + 2:i + 5]
            overrides[triple] = {
                "heading": p["h3"],
                "captions": [row[2] for row in table["table"]["rows"]],
                "paragraphs": body,
            }
            paragraphs[i:i + 5] = [{"chakra_reading": {"chakra": "energy_field", "triple": triple}}]
            break
    if set(overrides) != TRIPLES:
        print(f"толкования не найдены: {sorted(TRIPLES - set(overrides))}")
        return 1

    (out.parent / "overrides.json" if out != target else HERE / "ru" / "overrides.json").write_text(
        json.dumps(overrides, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    out.write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for note in rep.notes:
        print(f"  ~ {note}")
    print(f"записано: {out} и overrides для {sorted(overrides)}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    sys.exit(main(args.markdown, args.lang, args.out))
