#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "project/destiny-matrix"))
from content.text_policy import blocked_match  # noqa: E402

HERE = Path(__file__).resolve().parent

NAMES = {
    "ru": {1: r"Маг", 2: r"Жриц", 3: r"Императриц", 4: r"Император(?!иц)", 5: r"Иерофант", 6: r"Влюбл[её]нн",
           7: r"Колесниц", 8: r"Справедливост", 9: r"Отшельник", 10: r"Колес(?:о|а|у|ом|е)\b", 11: r"Сил(?:а|ы|у|е|ой)\b",
           12: r"Повешенн", 13: r"Смерт", 14: r"Умеренност", 15: r"Дьявол", 16: r"Башн", 17: r"Звезд",
           18: r"Лун(?:а|ы|у|е|ой)\b", 19: r"Солнц", 20: r"Суд(?:а|у|ом|е)?\b", 21: r"Мир(?:а|у|ом|е)?\b", 22: r"Шут"},
    "en": {1: r"Magician", 2: r"High Priestess|Priestess", 3: r"Empress", 4: r"Emperor", 5: r"Hierophant",
           6: r"Lovers", 7: r"Chariot", 8: r"Justice", 9: r"Hermit", 10: r"Wheel", 11: r"Strength", 12: r"Hanged Man",
           13: r"Death", 14: r"Temperance", 15: r"Devil", 16: r"Tower", 17: r"Star", 18: r"Moon", 19: r"Sun",
           20: r"Judge?ment", 21: r"World", 22: r"Fool"},
}
WORDS = {"ru": (160, 205), "en": (215, 305)}


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
        low, high = WORDS[lang]
        if not low <= words <= high:
            problems.append(f"{key}: {words} слов, допустимо {low}–{high}")
        text = " ".join(paragraphs)
        cards = {int(n) for n in key.split(":")[1].split("-")}
        for n in sorted(cards):
            if not re.search(NAMES[lang][n], text):
                problems.append(f"{key}: в тексте не названа карта {n}")
        for n in (8, 11):
            pattern, scope = NAMES[lang][n], " ".join([heading, *captions, text])
            if lang == "ru" and n == 11:
                pattern, scope = r"[а-яё,]\s+" + pattern, text
            if n not in cards and re.search(pattern, scope):
                problems.append(f"{key}: упомянута карта {n}, которой нет в тройке — проверь нумерацию")
        for chunk in [heading, *captions, *paragraphs]:
            found = blocked_match(chunk, "content", lang)
            if found:
                problems.append(f"{key}: слово из text-policy — {found}")
    return problems


if __name__ == "__main__":
    pack = sys.argv[1]
    issues = check(pack, sys.argv[2] if len(sys.argv) > 2 else "ru")
    print("\n".join(issues) if issues else f"{pack}: OK")
    sys.exit(1 if issues else 0)
