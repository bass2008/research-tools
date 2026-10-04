#!/usr/bin/env python3
"""Руководство по чакрам: Markdown → источник позиции `positions/chakras.json`.

    python3 tools/seo/energy-field/convert_guide.py /home/sergey/Personal/example-chakras-guide-opus.md [--lang en] [--out out.json]
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / "tools/seo/content/{lang}/positions/chakras.json"
TOC = ("**В статье:**", "**In this article:**")
CALC = ("Как посчитать", "How to work out")
MIN_PARAGRAPH = 180  # content/validate.py: MIN_MEANING


def load_converter():
    spec = importlib.util.spec_from_file_location("md_to_content", ROOT / "tools/seo/md-to-content.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def merge_short(paragraphs: list) -> list:
    """Glue paragraphs shorter than the validator minimum to their neighbours inside a run of text."""
    out: list = []
    run: list[str] = []

    def flush() -> None:
        merged: list[str] = []
        for text in run:
            if merged and len(merged[-1]) < MIN_PARAGRAPH:
                merged[-1] = f"{merged[-1]} {text}"
            else:
                merged.append(text)
        if len(merged) > 1 and len(merged[-1]) < MIN_PARAGRAPH:
            merged[-2] = f"{merged[-2]} {merged.pop()}"
        out.extend(merged)
        run.clear()

    for p in paragraphs:
        if isinstance(p, str):
            run.append(p)
        else:
            flush()
            out.append(p)
    flush()
    return out


def main(markdown: Path, lang: str, out: Path | None) -> int:
    source = Path(str(SOURCE).format(lang=lang))
    out = out or source
    m2c = load_converter()
    text = markdown.read_text(encoding="utf-8")
    meta, _ = m2c.front_matter(text.splitlines())
    rep = m2c.Report()
    current = json.loads(source.read_text(encoding="utf-8"))
    item = m2c.convert(text, {}, rep, keep_intro=True)

    intro = [p for p in item["intro"] if not (isinstance(p, str) and p.startswith(TOC))]
    meaning = [item["short"], *[p for p in intro if isinstance(p, str)]]
    if any(not isinstance(p, str) for p in intro):
        print("во вводке есть блоки: их некуда поставить в позиции")
        return 1

    sections = item["sections"]
    calc = next(i for i, s in enumerate(sections) if s["h2"].startswith(CALC))
    sections[calc]["paragraphs"].insert(0, {"slot": "calc"})
    for section in sections:
        if all(isinstance(p, str) for p in section["paragraphs"]):
            section["paragraphs"] = merge_short(section["paragraphs"])

    queries = [meta.get("primary_query"), *(meta.get("queries") or []), *current["seo"].get("queries", [])]
    seo = {
        "title": meta["title"],
        "description": meta["description"],
        "queries": list(dict.fromkeys(q for q in queries if q)),
    }
    result = {
        "key": current["key"], "title": current["title"], "h1": item["title"], "seo": seo,
        "meaning": meaning, "article_sections": sections, "faq": item["faq"],
    }
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for note in rep.notes:
        print(f"  ~ {note}")
    short = [(s["h2"][:40], len(p)) for s in sections for p in s["paragraphs"]
             if isinstance(p, str) and len(p) < MIN_PARAGRAPH
             and all(isinstance(x, str) for x in s["paragraphs"])]
    short += [("meaning", len(p)) for p in meaning if len(p) < MIN_PARAGRAPH]
    print(f"записано: {out}; глав {len(sections)}, вопросов {len(item['faq'])}; "
          f"короче {MIN_PARAGRAPH}: {short or 'нет'}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    sys.exit(main(args.markdown, args.lang, args.out))
