#!/usr/bin/env python3
"""Реестр страниц «аркан N в позиции X»: что бывает по методу и что из этого спрашивают.

Зачем отдельный корпус. Спрашивают пересечение — «8 аркан профессии», «21 аркан в отношениях».
У сайта есть страница позиции (каталог 22 карточек) и страница
аркана (список позиций), а страницы на пересечении нет: каталог формально содержит ответ, но
ответом не является, и поиск ставит его ниже статьи про ровно одну пару. Замер на самом сайте:
единственный раздел, где адрес повторяет запрос, стоит на медиане 5, каталоги позиций — на 33–42.

Два разных решения, и путать их нельзя. **Какие адреса бывают** решает метод: аркан, который
движок не ставит в эту точку ни при какой дате рождения, страницы не получает, сколько бы его ни
спрашивали. **Какие адреса видит поиск** решает спрос: ниже порога запись остаётся в реестре с
`publication.index = false`, ровно как у ordered-хвостов. Плоская генерация 836 адресов — тот
самый тонкий корпус, который уже дал 76 страниц хвостов на один показ за шесть дней.

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
PROJECT = ROOT / "project/destiny-matrix"
# Реестр строится по русскому спросу (оплаченный Вордстат): адреса он задаёт всем языкам,
# а частоты остаются русскими — своего замера у английского поля пока нет.
OUT = PROJECT / "web/content/ru/position-arcanum.json"
METHOD = PROJECT / "spec/method.json"
POINTS = PROJECT / "content/data/ru/points.json"

# Два разных решения, и раньше они были слиты в одно число.
#
# THRESHOLD — стоит ли ЗАВОДИТЬ страницу, то есть писать текст руками. Значение выбрано по
# отдаче: при 500 — 80 страниц и 2 046 показов на страницу, при 300 добавляются 36 страниц
# по ~400, при 100 — ещё 8 по ~137. Ниже этого страница стоит дороже, чем приносит.
#
# SHOW_THRESHOLD — показывать ли поиску страницу, которая УЖЕ написана. Порога здесь больше
# нет: текст лежит, показ не стоит ничего, а закрытая страница не приносит ничего гарантированно.
# Спрос мерился до публикации и мерился Вордстатом, который редкие формы просто не показывает, —
# закрывать по нему готовую страницу значит доверять отсутствию данных больше, чем данным.
THRESHOLD = 500
SHOW_THRESHOLD = 0

# Дата разбора, а не «сегодня»: `--check` сверяет файл побайтово, и подвижная дата ломала бы
# проверку каждую полночь. Меняется руками вместе с пересмотром реестра — так же, как TODAY в
# prepare-unified-release.py.
REVIEWED_AT = "2026-09-14"

ROOT_PHRASE = "матрица судьбы"
NUMBER = re.compile(r"(?<![\d/-])(2[0-2]|1[0-9]|[1-9])(?![\d/-])")

# Позиция корпуса → как её называют в запросах. Ключи обязаны существовать в positions.json:
# сверяет `sync` ниже. Порядок словаря задаёт порядок в корпусе.
WORDING: dict[str, dict[str, str]] = {
    # Одно число в хвосте обслуживает указатель существующих троек, а не самостоятельная
    # статья past_lives/N. Полная программа определяется порядком M–N–D и контекстом.
    "center": {"center": r"центр"},
    "relations": {"relations": r"отношени|любов|брак|партн"},
    "money": {"money": r"деньг|денежн|финанс|доход"},
    # «Под сердцем» — партнёрская точка R1, а не вход линии отношений M. В M бывают только числа,
    # кратные трём, а спрос «N аркан под сердцем» распределён ровно по 3–22, как и значения R1.
    # Тринадцать адресов, стоявших под этим именем на M, уходят редиректом (tools/seo/recrawl-301.csv).
    "love_middle": {"heart": r"под сердц"},
    "profession": {"talent": r"талант|професси"},
    "day": {"card": r"визитк"},
}

# Позиции, где адреса перечисляются по методу целиком, а спрос решает только индексацию.
#
# `center` — потому что бесплатный расчёт показывает E каждому, а статьи не было у четырёх из
# шестнадцати возможных чисел: правило отбора работало против продукта. `love_middle` — потому
# что это новая точка целиком и её двадцать трактовок написаны руками; завести её наполовину
# значило бы снова нарезать адреса спросом и снова получить дыры.
#
# Остальные позиции остаются на пороге спроса: метод отсекает там максимум два числа из
# двадцати двух, а полный перебор добавил бы шестьдесят страниц без спроса и без нужды продукта.
BY_METHOD = ("center", "love_middle")

# Другие формулировки того же вопроса: главный запрос они не выбирают и в частоту не входят,
# но страница пересечения отвечает и на них. «Сердце» в поиске — это точка под сердцем, а не центр
# (уточнения «матрица судьбы сердце»: 7 987 из 9 189 — «…под сердцем»).
VARIANTS: dict[str, str] = {
    "center": r"центр|середин|комфорт",
    "relations": r"отношени|любов|брак|партн",
    "money": r"деньг|денег|денежн|финанс|доход|доллар",
    "love_middle": r"под сердц|сердечк|сердц",
    "profession": r"талант|професси",
    "day": r"визитк|визитн",
}
OTHER_INTENT = re.compile(r"совместим|таро|программ|хвост|\bгод|\bлет\b|возраст|(19|20)\d\d")
VARIANT_FLOOR = 40
VARIANT_LIMIT = 8
ENDING = re.compile(r"(ами|ями|ого|ему|ому|ах|ях|ам|ям|ов|ей|ой|ом|ем|ые|ый|ых|ым|ий|ь|[аеиоуыэюя])$")
FILLER = {"в", "во", "и"}
CONTENT = PROJECT / "web/content/ru"
OWNED_FILES = ("arcana", "positions", "year-arcana", "karmic-tails", "combinations", "chakras", "hubs",
               "category-hubs")


def query_key(phrase: str) -> tuple:
    """Одна формулировка с точностью до формы слова и порядка слов; порядок чисел значим — у хвостов
    перестановка чисел меняет сущность."""
    words = re.findall(r"\w+", phrase.lower().replace("ё", "е"))
    numbers = tuple(w for w in words if w.isdigit())
    stems = frozenset(ENDING.sub("", w) for w in words if not w.isdigit() and w not in FILLER)
    return numbers, stems


def owned_elsewhere() -> set[tuple]:
    out = set()
    for name in OWNED_FILES:
        data = json.loads((CONTENT / f"{name}.json").read_text(encoding="utf-8"))
        for item in data["items"] if isinstance(data, dict) else data:
            out |= {query_key(q) for q in (item.get("seo") or {}).get("queries") or []}
    return out


def variants(phrases: dict[str, int], position: str, arcanum: int, primary: str, owned: set[tuple]) -> list[str]:
    rx = re.compile(VARIANTS[position])
    seen = {query_key(primary)} | owned
    out = []
    for phrase, freq in sorted(phrases.items(), key=lambda x: (-x[1], x[0])):
        if freq < VARIANT_FLOOR or len(out) >= VARIANT_LIMIT:
            break
        if not rx.search(phrase) or OTHER_INTENT.search(phrase) or NUMBER.findall(phrase) != [str(arcanum)]:
            continue
        key = query_key(phrase)
        if key in seen:
            continue
        seen.add(key)
        out.append(phrase)
    return out


def domains() -> dict[str, set[int]]:
    """Позиция реестра → какие арканы в ней вообще бывают.

    Точка отвечает за себя, раздел — за все свои точки: страница «N аркан в отношениях» честна,
    если N встречается хотя бы в одной точке раздела.
    """
    method = json.loads(METHOD.read_text(encoding="utf-8"))
    reachable = {key: set(values) for key, values in method["reachable_arcana"].items()}
    by_section: dict[str, set[int]] = collections.defaultdict(set)
    for point in json.loads(POINTS.read_text(encoding="utf-8")):
        for section in point["sections"]:
            by_section[section] |= reachable[point["key"]]
    out = {}
    for position in WORDING:
        if position in reachable:
            out[position] = reachable[position]
        elif position in by_section:
            out[position] = by_section[position]
        else:
            raise SystemExit(f"{position}: ни точка метода, ни раздел с точками")
    return out


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
    domain = domains()
    with sqlite3.connect(f"file:{DB}?mode=ro", uri=True) as conn:
        phrases = subtree(conn)
        raw = collect(phrases)
    owned = owned_elsewhere()

    items, skipped = [], 0
    for position, per in raw.items():
        # Перебор по методу заводит все достижимые числа; остальные позиции живут на пороге
        # спроса — запись без спроса там была бы страницей, которой никто не задавал вопроса.
        asked = {a for a, r in per.items() if r["frequency"] >= THRESHOLD}
        wanted = (domain[position] if position in BY_METHOD else asked) & domain[position]
        skipped += len(set(per) - wanted)
        for arcanum in sorted(wanted):
            row = per.get(arcanum, {"frequency": 0, "wordings": {}, "top": (0, "", None)})
            _, phrase, wording = row["top"]
            indexed = row["frequency"] >= SHOW_THRESHOLD and bool(phrase)
            if not indexed:
                # Без спроса головного запроса у страницы нет: заявить его — значит увести
                # выдачу у той страницы, которая по нему и стоит.
                phrase, wording = None, next(iter(WORDING[position]))
            items.append({
                "position": position,
                "arcanum": arcanum,
                "frequency": row["frequency"],
                "primary_query": phrase,
                "queries": variants(phrases, position, arcanum, phrase, owned) if phrase else [],
                "wording": wording,
                "wordings": {k: v for k, v in sorted(row["wordings"].items(), key=lambda x: -x[1])},
                "publication": {
                    "index": indexed,
                    "follow": True,
                    "primary_query": phrase,
                    "exact_frequency": row["frequency"],
                    "reviewed_at": REVIEWED_AT,
                },
            })

    payload = {"threshold": THRESHOLD, "show_threshold": SHOW_THRESHOLD,
               "count": len(items), "items": items}
    body = json.dumps(payload, ensure_ascii=False, indent=1) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != body:
            raise SystemExit(f"{OUT.name} устарел — выполните tools/seo/build-position-arcanum.py")
        print(f"проверено: {len(items)} страниц, порог заведения {THRESHOLD}, показа {SHOW_THRESHOLD}")
        return 0
    OUT.write_text(body, encoding="utf-8")
    shown = [item for item in items if item["publication"]["index"]]
    total = sum(item["frequency"] for item in shown)
    print(f"{OUT.name}: {len(items)} страниц, из них в индексе {len(shown)} "
          f"({total:,} показов/мес), порог заведения {THRESHOLD}, показа {SHOW_THRESHOLD}; "
          f"отброшено методом {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
