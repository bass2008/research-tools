#!/usr/bin/env python3
import argparse
import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORDS = {"ru": (450, 950), "en": (550, 1250)}
BANNED = {
    "ru": ("есть ли у вас хвост", "проверка за", "в этой статье", "читайте полную", "полную статью"),
    "en": ("do you have the", "check in ten seconds", "in this article", "read the full", "full article"),
}


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check(path: Path, lang: str) -> list[str]:
    m2c = load("md_to_content", ROOT / "tools/seo/md-to-content.py")
    build = load("build_content", ROOT / "tools/seo/build-content.py")
    text = path.read_text(encoding="utf-8")
    problems: list[str] = []
    if text.lstrip().startswith("---"):
        problems.append("шапки (front matter) быть не должно")
    rep = m2c.Report()
    blocks = []
    for kind, value in m2c.tokens(text.splitlines(), rep):
        if kind in ("h1", "h2"):
            problems.append(f"заголовок {kind} — только ### для подзаголовков: «{value}»")
        elif kind in ("table", "slot"):
            problems.append(f"блок {kind} не допускается")
        else:
            blocks.append(m2c.block(kind, value, rep))
    problems += [note for note in rep.notes if "блок кода" in note or "короче 21" in note]
    if not blocks or not isinstance(blocks[0], str):
        problems.append("текст должен начинаться с абзаца, а не с подзаголовка")
    build.check_paragraphs(blocks, path.name, "report", problems)
    words = len(re.findall(r"[A-Za-zА-Яа-яЁё]+", text))
    low, high = WORDS[lang]
    if not low <= words <= high:
        problems.append(f"слов {words}, нужно {low}–{high}")
    for phrase in BANNED[lang]:
        if phrase in text.lower():
            problems.append(f"запрещённый фрагмент: «{phrase}»")
    heads = sum(1 for b in blocks if isinstance(b, dict) and "h3" in b)
    if not 2 <= heads <= 5:
        problems.append(f"подзаголовков ### {heads}, нужно 2–5")
    warnings: list[str] = []
    pattern = {"ru": r"(?<![А-Яа-яЁё])(вы|вас|вам|вами|ваш\w*)(?![А-Яа-яЁё])", "en": r"\b(you|your|yours|yourself)\b"}[lang]
    if pattern:
        second = re.findall(pattern, text, flags=re.I)
        if second:
            warnings.append(f"обращение к читателю: {len(second)} раз ({', '.join(sorted(set(w.lower() for w in second)))})")
    build.hygiene(blocks, path.name, "report", warnings, lang)
    for warning in warnings:
        print(f"  ! {warning}")
    print(f"{path.name}: слов {words}, подзаголовков {heads}, блоков {len(blocks)}")
    return problems


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("--lang", default="ru", choices=sorted(WORDS))
    args = parser.parse_args()
    found = check(args.markdown, args.lang)
    for problem in found:
        print(f"  ✗ {problem}")
    sys.exit(1 if found else 0)
