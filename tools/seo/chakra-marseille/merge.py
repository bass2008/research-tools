#!/usr/bin/env python3
"""Переносит толкования троек с 8 и 11 в корпус персональных чакр.

    python3 tools/seo/chakra-marseille/merge.py --lang ru            # проверить и записать
    python3 tools/seo/chakra-marseille/merge.py --lang ru --check    # только проверить
"""
import argparse
import json
import sys
from pathlib import Path

from check_pack import check

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CORPUS = ROOT / "project/destiny-matrix/content/data/{lang}/chakra-personal.json"


def groups(corpus: dict) -> dict:
    return {**{name: chakra["readings"] for name, chakra in corpus["chakras"].items()},
            "energy_field": corpus["energy_field"]["readings"]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--partial", action="store_true", help="перенести только готовые пакеты")
    args = parser.parse_args()

    packs = json.loads((HERE / "packs.json").read_text())
    # Old text of the 8↔11 mirror triple already describes these cards in the new numbering.
    mirror = json.loads((HERE / "mirror.json").read_text())
    corpus_path = Path(str(CORPUS).format(lang=args.lang))
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    old = {group: dict(readings) for group, readings in groups(corpus).items()}

    fresh, problems = {}, []
    for pack in packs:
        path = HERE / args.lang / f"{pack}.json"
        if not path.exists():
            if not args.partial:
                problems.append(f"{pack}: нет файла")
            continue
        problems += [f"{pack}: {issue}" for issue in check(pack, args.lang)]
        fresh.update(json.loads(path.read_text(encoding="utf-8")))
    for target, source in mirror.items():
        group, key = source.split(":")
        fresh[target] = old[group][key]
    if problems:
        print("\n".join(problems))
        return 1

    live = groups(corpus)
    for target, item in fresh.items():
        group, key = target.split(":")
        if key not in live[group]:
            problems.append(f"{target}: такой тройки нет в корпусе")
            continue
        live[group][key] = item
    headings = [r["heading"] for readings in live.values() for r in readings.values()]
    duplicates = sorted({h for h in headings if headings.count(h) > 1})
    if problems:
        print("\n".join(problems))
        return 1
    if not args.check:
        corpus_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(fresh)} толкований {'проверены' if args.check else 'записаны'}: {corpus_path}")
    if duplicates:
        print(f"повторы заголовков в корпусе: {len(duplicates)} — {duplicates[:5]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
