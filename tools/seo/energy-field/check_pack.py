#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "project/destiny-matrix"))
from content.text_policy import blocked_match  # noqa: E402

HERE = Path(__file__).resolve().parent


def check(pack: str, lang: str = "ru") -> list[str]:
    expected = json.loads((HERE / "packs.json").read_text())[pack]
    path = HERE / lang / f"{pack}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"{path}: не читается как JSON — {exc}"]
    problems = []
    if sorted(data) != sorted(expected):
        problems.append(f"ключи не совпадают: лишние {sorted(set(data) - set(expected))}, "
                        f"нет {sorted(set(expected) - set(data))}")
    headings = {}
    for key, item in data.items():
        if not isinstance(item, dict) or set(item) != {"heading", "captions", "paragraphs"}:
            problems.append(f"{key}: нужны ровно heading, captions, paragraphs")
            continue
        heading, captions, paragraphs = item["heading"], item["captions"], item["paragraphs"]
        if not isinstance(heading, str) or not heading.strip() or "*" in heading:
            problems.append(f"{key}: пустой heading или звёздочки в нём")
        if heading in headings:
            problems.append(f"{key}: heading повторяет {headings[heading]}")
        headings[heading] = key
        if not (isinstance(captions, list) and len(captions) == 3
                and all(isinstance(c, str) and c.strip() and "*" not in c for c in captions)):
            problems.append(f"{key}: captions — три непустые строки без звёздочек")
        if not (isinstance(paragraphs, list) and len(paragraphs) == 3
                and all(isinstance(p, str) and len(p.strip()) > 80 for p in paragraphs)):
            problems.append(f"{key}: paragraphs — три абзаца длиннее 80 знаков")
            continue
        for i, p in enumerate(paragraphs):
            if "*" in re.sub(r"\*\*[^*]+\*\*", "", p):
                problems.append(f"{key}: абзац {i + 1} — непарные звёздочки")
        words = sum(len(re.findall(r"\w+", p)) for p in paragraphs)
        low, high = (120, 260) if lang == "ru" else (140, 340)
        if not low <= words <= high:
            problems.append(f"{key}: {words} слов, допустимо {low}–{high}")
        for text in [heading, *captions, *paragraphs]:
            found = blocked_match(text, "content", lang)
            if found:
                problems.append(f"{key}: слово из text-policy — {found}")
    return problems


if __name__ == "__main__":
    pack = sys.argv[1]
    issues = check(pack, sys.argv[2] if len(sys.argv) > 2 else "ru")
    print("\n".join(issues) if issues else f"{pack}: OK")
    sys.exit(1 if issues else 0)
