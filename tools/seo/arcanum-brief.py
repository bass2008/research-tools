#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import sqlite3
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "project/destiny-matrix"
CONTENT = SITE / "web/content/ru"
OUT = ROOT / "tools/seo/prompt/arcanum-briefs"
DB = ROOT / "semcore.db"
sys.path.insert(0, str(SITE))

from engine.matrix import calculate  # noqa: E402
from engine.sections import build  # noqa: E402

STOP = {"в", "во", "на", "и", "с", "по", "у"}
NOISE = re.compile(r"рубл|курс|\d+\s+чакр")
YEAR = re.compile(r"(19|20)\d\d")
FIRST_DAY, LAST_DAY = dt.date(1900, 1, 1), dt.date(2026, 10, 5)


def items(name: str) -> list[dict]:
    data = json.load(open(CONTENT / f"{name}.json", encoding="utf-8"))
    return data["items"] if isinstance(data, dict) and "items" in data else data


def norm(text: str) -> str:
    return text.lower().replace("ё", "е")


ENDING = re.compile(r"(ами|ями|ого|ему|ому|ах|ях|ам|ям|ов|ей|ой|ом|ем|ые|ый|ых|ым|ий|ь|[аеиоуыэюя])$")


def tokens(text: str) -> frozenset[str]:
    # основа без окончания, а не первые буквы: «импер» склеивал Императрицу с Императором
    return frozenset(ENDING.sub("", w) for w in re.findall(r"\w+", norm(text)) if w not in STOP)


def name_pattern(title: str) -> re.Pattern:
    # падежные окончания, а не любой хвост: иначе «маг» ловит «магию», а «суд» — «судьбу»
    stem = re.sub(r"(ые|ый|ь|[аеиоуыэюя])$", "", norm(title).split()[0])
    return re.compile(rf"\b{stem}(а|я|у|ю|о|е|и|ы|ь|ью|ом|ем|ой|ей|ов|ам|ами|ах|ые|ый|ых|ым|ого|ому)?\b")


def owners(n: int, named: re.Pattern) -> list[tuple[frozenset, str, str]]:
    mine = re.compile(rf"(?<!\d){n}(?!\d)")
    pages = [
        ("year-arcana", lambda it: f"/year/{it['n']}"),
        ("karmic-tails", lambda it: f"/encyclopedia/karmic-tail/{it['key']}"),
        ("combinations", lambda it: f"/encyclopedia/combination/{it['key']}"),
        ("positions", lambda it: f"/encyclopedia/position/{it['key']}"),
    ]
    out = []
    for name, href in pages:
        for it in items(name):
            queries = (it.get("seo") or {}).get("queries") or []
            for q in queries:
                if mine.search(q) or named.search(norm(q)):
                    out.append((tokens(q), href(it), queries[0]))
    for it in items("position-arcanum"):
        if it["arcanum"] == n and it.get("primary_query"):
            q = it["primary_query"]
            out.append((tokens(q), f"/encyclopedia/position/{it['position']}/{n}", q))
    return out


def demand(n: int, named: re.Pattern) -> list[tuple[int, str]]:
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    found = []
    for phrase, freq in db.execute("select phrase, freq from node where freq is not null"):
        p = norm(phrase)
        if YEAR.search(p) or NOISE.search(p) or not re.search(r"аркан|матриц|энерги", p):
            continue
        nums = re.findall(r"\d+", p)
        # имя без номера часто значит другое («сила рода», «белое солнце»): берём только явный аркан
        by_name = not nums and named.search(p) and ("аркан" in p or re.fullmatch(r"\w+ в матрице судьбы", p))
        if nums == [str(n)] or by_name:
            found.append((freq, phrase))
    return sorted(found, reverse=True)


def census() -> tuple[dict[int, dict[str, float]], dict[int, float]]:
    hits = {n: {} for n in range(1, 23)}
    anywhere = {n: 0 for n in range(1, 23)}
    total, day = 0, FIRST_DAY
    while day <= LAST_DAY:
        for sex in ("f", "m"):
            m = calculate(day, sex)
            found: dict[int, set[str]] = {}
            for k, v in asdict(m).items():
                if isinstance(v, int) and 1 <= v <= 22:
                    found.setdefault(v, set()).add(k)
            for s in build(m, unlocked=True):
                for p in s["positions"]:
                    found.setdefault(p["arcanum"], set()).add(s["key"])
            for n, keys in found.items():
                anywhere[n] += 1
                for k in keys:
                    hits[n][k] = hits[n].get(k, 0) + 1
            total += 1
        day += dt.timedelta(days=1)
    return ({n: {k: v / total for k, v in h.items()} for n, h in hits.items()},
            {n: v / total for n, v in anywhere.items()})


def pct(x: float) -> str:
    return f"{x * 100:.1f}".replace(".", ",") + " %"


def brief(n: int, shares: dict[int, dict[str, float]], anywhere: dict[int, float]) -> str:
    arcanum = next(it for it in items("arcana") if it["n"] == n)
    title = arcanum["title"]
    named = name_pattern(title)
    pages = owners(n, named)

    lines = [f"# Справка по аркану {n} · {title}", "",
             "Справка, а не план статьи: структуру, подачу и что из этого брать решаешь сам.", "",
             "## Что ищут", "",
             "Вордстат (только Яндекс), показов в месяц. Широкие фразы включают свои уточнения, складывать их нельзя.",
             "Стрелка — у запроса на сайте своя страница.", ""]
    for freq, phrase in demand(n, named)[:40]:
        t = tokens(phrase)
        own = [(len(q), href, primary) for q, href, primary in pages if q <= t]
        tail = f" → {max(own)[1]}" if own else ""
        lines.append(f"- {freq} — {phrase}{tail}")

    lines += ["", "## Темы с отдельной страницей на сайте", "",
              "О них в статье — коротко и ссылкой; не спорь с этими страницами и не бери их главный запрос в заголовок раздела.", ""]
    seen = set()
    for _, href, primary in sorted(pages, key=lambda x: x[1]):
        if href in seen or "/combination/" in href:
            continue
        seen.add(href)
        lines.append(f"- {href} — «{primary}»")
    for it in items("karmic-tails"):
        href = f"/encyclopedia/karmic-tail/{it['key']}"
        if href not in seen and (n in it["arcana"] or named.search(norm(it["title"]))):
            seen.add(href)
            lines.append(f"- {href} — «{it['title']}»")
    lines.append(f"- /encyclopedia/combination/{n}-… — сочетания с другими арканами, по странице на пару")

    method = json.load(open(SITE / "spec/method.json", encoding="utf-8"))
    known = set(method["reachable_arcana"])
    points = {k for k, v in method["reachable_arcana"].items() if n in v}
    share = shares[n]
    others = [v for k, v in anywhere.items() if k != n]
    yes, no = [], []
    for it in items("positions"):
        key, name = it["key"], it["title"]
        possible = key in points if key in known else key in share
        if not possible:
            no.append(name)
        else:
            yes.append(f"{name} ({pct(share[key])})" if key in share else name)
    lines += ["", "## Где аркан бывает", "",
              f"Движок сайта, все даты {FIRST_DAY.year}–{LAST_DAY.year}, оба пола; в скобках — доля людей.", "",
              f"**Есть в отчёте хоть где-то:** у {pct(anywhere[n])} людей; у остальных арканов — от {pct(min(others))} до {pct(max(others))}. "
              "Если пишешь, как часто встречается аркан, бери эти числа.", "",
              "**Бывает:** " + "; ".join(yes) + ".", "",
              "**Не бывает никогда:** " + ("; ".join(no) if no else "—") + ". Об этих позициях не пиши как о возможных.", ""]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("n", nargs="+", type=int)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    shares, anywhere = census()
    for n in args.n:
        path = OUT / f"{n}.md"
        path.write_text(brief(n, shares, anywhere), encoding="utf-8")
        print(path)


if __name__ == "__main__":
    main()
