#!/usr/bin/env python3
"""Реестр страниц «аркан N в позиции X»: что спрашивают и под каким именем.

Зачем отдельный корпус. Спрашивают пересечение — «8 аркан профессии», «21 аркан в отношениях»,
«9 в хвосте матрицы судьбы». У сайта есть страница позиции (каталог 22 карточек) и страница
аркана (список позиций), а страницы на пересечении нет: каталог формально содержит ответ, но
ответом не является, и поиск ставит его ниже статьи про ровно одну пару. Замер на самом сайте:
единственный раздел, где адрес повторяет запрос, стоит на медиане 5, каталоги позиций — на 33–42.

Почему порог, а не «все 22 × 37». Плоская генерация 814 адресов — тот самый тонкий корпус,
который уже дал 76 страниц хвостов на один показ за шесть дней. Адрес появляется только против
записи с подтверждённым спросом.

Источник частот — оплаченный Вордстат (`semcore.db`, поддерево «матрица судьбы»); база вне
репозитория, поэтому результат работы скрипта коммитится как корпус.
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "semcore.db"
OUT = ROOT / "project/destiny-matrix/web/content/position-arcanum.json"
METHOD = ROOT / "project/destiny-matrix/spec/method.json"

# Страница появляется при спросе не ниже этого числа. Значение выбрано по отдаче: при 500 —
# 80 страниц и 2 046 показов на страницу, при 300 добавляются 36 страниц по ~400, при 100 — ещё
# 8 по ~137. Ниже порога страница стоит дороже, чем приносит.
THRESHOLD = 500

ROOT_PHRASE = "матрица судьбы"
NUMBER = re.compile(r"(?<![\d/-])(2[0-2]|1[0-9]|[1-9])(?![\d/-])")

# Позиция корпуса → как её называют в запросах. Ключи обязаны существовать в positions.json:
# сверяет `sync` ниже. Порядок словаря задаёт порядок в корпусе.
WORDING: dict[str, dict[str, str]] = {
    # У хвоста две равноправные формулировки: «хвост N» и «программа N». Это одно и то же —
    # арканы 1 и 2 не встречаются ни в одном достижимом хвосте, и спрос по ним равен нулю под
    # обоими именами, а объёмы почти совпадают (49 385 против 47 573). Поэтому одна страница на
    # два имени, а не два почти одинаковых набора, которые делят выдачу.
    "past_lives": {"tail": r"хвост", "program": r"программ"},
    "center": {"center": r"центр"},
    "relations": {"relations": r"отношени|любов|брак|партн"},
    "money": {"money": r"деньг|денежн|финанс|доход"},
    "comfort_south": {"heart": r"под сердц"},
    "profession": {"talent": r"талант|професси"},
    "day": {"card": r"визитк"},
}


def subtree(conn: sqlite3.Connection) -> dict[str, int]:
    edges: dict[str, list[str]] = collections.defaultdict(list)
    for parent, child in conn.execute("SELECT parent, child FROM edge"):
        edges[parent].append(child)
    seen, stack = {ROOT_PHRASE}, [ROOT_PHRASE]
    while stack:
        for child in edges.get(stack.pop(), ()):
            if child not in seen:
                seen.add(child)
                stack.append(child)
    freq = dict(conn.execute("SELECT phrase, freq FROM node WHERE freq IS NOT NULL AND freq > 0"))
    return {phrase: freq[phrase] for phrase in seen if phrase in freq}


def collect(phrases: dict[str, int]) -> dict[str, dict[int, dict]]:
    """(позиция, аркан) → спрос и самая частая формулировка."""
    out: dict[str, dict[int, dict]] = {}
    for position, wordings in WORDING.items():
        per: dict[int, dict] = {}
        for name, pattern in wordings.items():
            rx = re.compile(pattern)
            for phrase, freq in phrases.items():
                if not rx.search(phrase):
                    continue
                numbers = NUMBER.findall(phrase)
                if len(numbers) != 1:
                    continue
                arcanum = int(numbers[0])
                row = per.setdefault(arcanum, {"frequency": 0, "wordings": {}, "top": (0, "", name)})
                row["frequency"] += freq
                row["wordings"][name] = row["wordings"].get(name, 0) + freq
                if freq > row["top"][0]:
                    row["top"] = (freq, phrase, name)
        out[position] = per
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="только сверить, ничего не писать")
    args = parser.parse_args()

    if not DB.exists():
        raise SystemExit(f"нет {DB}: реестр строится из оплаченного Вордстата")
    method = json.loads(METHOD.read_text(encoding="utf-8"))
    tails = {item["triple"] for item in method["reachable_karmic_tails"]}
    in_tail: dict[int, list[str]] = collections.defaultdict(list)
    for triple in sorted(tails):
        for part in dict.fromkeys(triple.split("-")):
            in_tail[int(part)].append(triple)

    with sqlite3.connect(f"file:{DB}?mode=ro", uri=True) as conn:
        raw = collect(subtree(conn))

    items, skipped = [], 0
    for position, per in raw.items():
        for arcanum in sorted(per):
            row = per[arcanum]
            if row["frequency"] < THRESHOLD:
                skipped += 1
                continue
            # Хвост — тройка: аркан, который движок туда не ставит ни при какой дате, не может
            # иметь страницу «в хвосте», сколько бы его ни спрашивали.
            if position == "past_lives" and not in_tail[arcanum]:
                skipped += 1
                continue
            _, phrase, wording = row["top"]
            items.append({
                "position": position,
                "arcanum": arcanum,
                "frequency": row["frequency"],
                "primary_query": phrase,
                "wording": wording,
                "wordings": {k: v for k, v in sorted(row["wordings"].items(), key=lambda x: -x[1])},
                "tails": in_tail[arcanum] if position == "past_lives" else [],
            })

    payload = {"threshold": THRESHOLD, "count": len(items), "items": items}
    body = json.dumps(payload, ensure_ascii=False, indent=1) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != body:
            raise SystemExit(f"{OUT.name} устарел — выполните tools/seo/build-position-arcanum.py")
        print(f"проверено: {len(items)} страниц, порог {THRESHOLD}")
        return 0
    OUT.write_text(body, encoding="utf-8")
    total = sum(item["frequency"] for item in items)
    print(f"{OUT.name}: {len(items)} страниц, {total:,} показов/мес, порог {THRESHOLD}; отброшено {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
