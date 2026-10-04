#!/usr/bin/env python3
"""Сборка толкований общего энергополя из пакетов в корпус персональных чакр.

    python3 tools/seo/energy-field/merge.py            # проверить пакеты и записать корпус
    python3 tools/seo/energy-field/merge.py --check    # только проверить
"""
import argparse
import json
import sys
from pathlib import Path

from check_pack import check

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CORPUS = ROOT / "project/destiny-matrix/content/data/{lang}/chakra-personal.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    packs = json.loads((HERE / "packs.json").read_text())
    expected = [triple for triples in packs.values() for triple in triples]
    if len(expected) != len(set(expected)):
        print("packs.json: тройки повторяются")
        return 1

    readings, problems = {}, []
    for pack in packs:
        path = HERE / args.lang / f"{pack}.json"
        if not path.exists():
            problems.append(f"{pack}: нет файла")
            continue
        problems += [f"{pack}: {issue}" for issue in check(pack, args.lang)]
        readings.update(json.loads(path.read_text(encoding="utf-8")))
    # Толкования, показанные в статье об энергополе, берутся из неё, чтобы текст жил в одном месте.
    overrides_path = HERE / args.lang / "overrides.json"
    if overrides_path.exists():
        overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
        for key, item in overrides.items():
            if key not in expected or set(item) != {"heading", "captions", "paragraphs"} \
                    or len(item["captions"]) != 3 or len(item["paragraphs"]) != 3:
                problems.append(f"overrides: {key} — неверная тройка или структура")
        readings.update(overrides)
    headings = [item["heading"] for item in readings.values()]
    duplicates = sorted({h for h in headings if headings.count(h) > 1})
    if duplicates:
        problems.append(f"заголовки повторяются между пакетами: {duplicates[:10]}")
    if sorted(readings) != sorted(expected):
        problems.append(f"собрано {len(readings)} из {len(expected)} троек")
    if problems:
        print("\n".join(problems))
        return 1

    corpus_path = Path(str(CORPUS).format(lang=args.lang))
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    corpus["energy_field"] = {"readings": {key: readings[key] for key in expected}}
    if not args.check:
        corpus_path.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(readings)} троек энергополя {'проверены' if args.check else 'записаны'}: {corpus_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
