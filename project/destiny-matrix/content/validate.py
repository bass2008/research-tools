"""Проверка целостности собранной энциклопедии.

    python -m content.validate

Ненулевой код возврата при любом нарушении. Проверяется не только структура, но и стиль:
одинаковые зачины и канцелярит — признак того, что текст досыпали шаблоном, а такие страницы
не индексируются как самостоятельные.
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

from engine.matrix import CHAKRAS as CHAKRA_ROWS, COLUMNS
from engine.sections import SPEC

CONTENT_DIR = Path(os.environ.get(
    "ENCYCLOPEDIA_CONTENT_DIR",
    Path(__file__).resolve().parents[1] / "web" / "content"))
FILES = ("arcana.json", "combinations.json", "positions.json", "chakras.json")

SECTION_KEYS = [key for key, *_ in SPEC]
POINT_KEYS = ["day", "month", "year", "mission", "center",
              "father_line", "mother_line", "descendants", "inheritance",
              "comfort_west", "comfort_north", "comfort_east", "comfort_south",
              "harmony", "planetary", "purpose_personal", "purpose_social"]

MIN_MEANING = 180
MIN_POSITION_TEXT = 140
MIN_PAIR_PARAGRAPH = 160
MIN_PAIR_TOTAL = 350
MIN_COLUMN_TEXT = 110
SHORT_LIMIT = 90
OPENING_LIMIT_PAIRS = 4
OPENING_LIMIT_SECTION = 3
HEAD_LEN = 30

BANNED = tuple(re.compile(p) for p in (
    r"\bявляет(ся|ются)\b", r"\bданн(ый|ая|ое|ого|ые|ых)\b", r"\bосуществля\w*",
    r"\bв рамках\b", r"\bследует отметить\b", r"\bнеобходимо отметить\b",
    r"\bтаким образом\b", r"\bв связи с этим\b", r"\bвышеуказан\w*", r"\bвышеупомян\w*",
    r"\bв целях\b", r"\bимеет место\b", r"\bнапрямую зависит\b",
    r"\bиграет важную роль\b", r"\bне стоит забывать\b", r"\bпринимая во внимание\b",
))

# Юридический фильтр, отдельный от стилевого. Реклама гадания в Директе разрешена без
# документов, а «народная медицина и целительство» требует разрешения органа власти субъекта РФ.
# Границы слов обязательны: без них «влечение» и «развлечения» ловятся как «лечение», и
# правится не то, что нужно.
MEDICAL = tuple(re.compile(p) for p in (
    r"\bздоровь\w*", r"\bболезн\w*", r"\bзаболеван\w*", r"\bдиагноз\w*",
    r"\bлечени\w*", r"\bлечить\w*", r"\bисцел\w*", r"\bцелител\w*",
    r"\bсимптом\w*", r"\bтерапи\w*", r"\bпрепарат\w*", r"\bиммунит\w*",
    r"\bпохуден\w*", r"\bнабор веса\b", r"\bалкогол\w*", r"\bвыздоравл\w*",
    r"\bврач\w*", r"\bклиник\w*", r"\bгарантиру\w*",
))

WORD_RE = re.compile(r"[а-яёa-z0-9]+", re.IGNORECASE)


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.checks = 0

    def check(self, ok: bool, message: str) -> bool:
        self.checks += 1
        if not ok:
            self.errors.append(message)
        return ok

    def fail(self, message: str) -> None:
        self.checks += 1
        self.errors.append(message)


def norm(text: str) -> str:
    return " ".join(WORD_RE.findall(text.lower()))


def opening(text: str, words: int = 2) -> str:
    return " ".join(WORD_RE.findall(text.lower())[:words])


def load(rep: Report) -> dict[str, dict]:
    data: dict[str, dict] = {}
    for name in FILES:
        path = CONTENT_DIR / name
        if not path.exists():
            rep.fail(f"нет файла {path} — сначала python -m content.build")
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        rep.check(payload.get("count") == len(payload.get("items", [])),
                  f"{name}: count не совпадает с числом записей")
        data[name] = payload
    return data


def check_arcana(rep: Report, items: list[dict], prose: list[tuple[str, str]]) -> None:
    rep.check(len(items) == 22, f"арканов {len(items)}, а нужно 22")
    rep.check({a["n"] for a in items} == set(range(1, 23)), "номера арканов не 1..22")
    for field in ("slug", "title"):
        values = [a[field] for a in items]
        dupes = [v for v, c in Counter(values).items() if c > 1]
        rep.check(not dupes, f"дубли {field} у арканов: {dupes}")
    for a in items:
        who = f"аркан {a['n']}"
        rep.check(bool(re.fullmatch(r"[a-z][a-z-]+", a["slug"])), f"{who}: слаг не латиница")
        rep.check(bool(re.fullmatch(r"[IVX]+", a["roman"])), f"{who}: римская цифра пустая")
        rep.check(20 <= len(a["short"]) <= SHORT_LIMIT,
                  f"{who}: короткая фраза {len(a['short'])} знаков, нужно 20..{SHORT_LIMIT}")
        rep.check(not a["short"].endswith("."), f"{who}: короткая фраза с точкой на конце")
        rep.check(len(a["keywords"]) >= 5, f"{who}: ключевых слов {len(a['keywords'])}, нужно 5+")
        rep.check(len(set(a["keywords"])) == len(a["keywords"]), f"{who}: дубли в ключевых словах")
        rep.check(3 <= len(a["meaning"]) <= 5,
                  f"{who}: абзацев значения {len(a['meaning'])}, нужно 3..5")
        for i, para in enumerate(a["meaning"], 1):
            rep.check(len(para) >= MIN_MEANING,
                      f"{who}: абзац {i} короче {MIN_MEANING} знаков ({len(para)})")
            prose.append((f"{who} · значение, абзац {i}", para))
        rep.check(len(a["plus"]) >= 3, f"{who}: плюсов {len(a['plus'])}, нужно 3+")
        rep.check(len(a["minus"]) >= 3, f"{who}: минусов {len(a['minus'])}, нужно 3+")
        missing = [k for k in SECTION_KEYS if not a["in_positions"].get(k)]
        rep.check(not missing, f"{who}: нет текста в позициях {missing}")
        extra = [k for k in a["in_positions"] if k not in SECTION_KEYS]
        rep.check(not extra, f"{who}: лишние позиции {extra}")
        for key, text in a["in_positions"].items():
            rep.check(len(text) >= MIN_POSITION_TEXT,
                      f"{who} · {key}: {len(text)} знаков, нужно {MIN_POSITION_TEXT}+")
            prose.append((f"{who} · позиция {key}", text))
        rep.check(len(a["combinations"]) == 21,
                  f"{who}: сочетаний {len(a['combinations'])}, нужно 21")
        partners = sorted(c["with"] for c in a["combinations"])
        rep.check(partners == [n for n in range(1, 23) if n != a["n"]],
                  f"{who}: список партнёров неполный")
        check_seo(rep, who, a["seo"], min_queries=8)


def check_combinations(rep: Report, items: list[dict], arcana: list[dict],
                       prose: list[tuple[str, str]]) -> None:
    expected = {(x, y) for x in range(1, 23) for y in range(x + 1, 23)}
    rep.check(len(expected) == 231, "внутренняя ошибка: сетка пар не 231")
    got = {(c["a"], c["b"]) for c in items}
    rep.check(len(items) == 231, f"сочетаний {len(items)}, а нужно 231")
    missing = sorted(expected - got)
    rep.check(not missing,
              f"не хватает {len(missing)} сочетаний, первые: "
              f"{['-'.join(map(str, p)) for p in missing[:12]]}")
    rep.check(not sorted(got - expected), f"лишние пары: {sorted(got - expected)}")
    rep.check(len(got) == len(items), "дубли пар в combinations.json")
    titles = {a["n"]: a["title"] for a in arcana}
    for c in items:
        who = f"сочетание {c['key']}"
        rep.check(c["a"] < c["b"], f"{who}: порядок пары не a < b")
        rep.check(len(c["short"]) <= SHORT_LIMIT, f"{who}: короткая фраза длиннее {SHORT_LIMIT}")
        rep.check(len(c["short"]) >= 12, f"{who}: короткая фраза пустая")
        rep.check(2 <= len(c["paragraphs"]) <= 3,
                  f"{who}: абзацев {len(c['paragraphs'])}, нужно 2..3")
        for i, para in enumerate(c["paragraphs"], 1):
            rep.check(len(para) >= MIN_PAIR_PARAGRAPH,
                      f"{who}: абзац {i} короче {MIN_PAIR_PARAGRAPH} знаков ({len(para)})")
            prose.append((f"{who}, абзац {i}", para))
        rep.check(sum(len(p) for p in c["paragraphs"]) >= MIN_PAIR_TOTAL,
                  f"{who}: всего {sum(len(p) for p in c['paragraphs'])} знаков, "
                  f"нужно {MIN_PAIR_TOTAL}+")
        prose.append((f"{who} · фраза", c["short"]))
        rep.check([r["n"] for r in c["arcana"]] == [c["a"], c["b"]],
                  f"{who}: ссылки на арканы не совпадают с парой")
        rep.check([titles[c["a"]], titles[c["b"]]] == [r["title"] for r in c["arcana"]],
                  f"{who}: названия арканов в ссылках разъехались")
        check_seo(rep, who, c["seo"], min_queries=5)


def check_positions(rep: Report, items: list[dict], prose: list[tuple[str, str]]) -> None:
    rep.check(len(items) == 37, f"позиций {len(items)}, а нужно 37 (20 разделов + 17 точек)")
    by_key = {p["key"]: p for p in items}
    rep.check(len(by_key) == len(items), "дубли ключей в positions.json")
    rep.check(set(by_key) == set(SECTION_KEYS) | set(POINT_KEYS),
              f"набор ключей позиций не совпадает: "
              f"нет {sorted((set(SECTION_KEYS) | set(POINT_KEYS)) - set(by_key))}, "
              f"лишние {sorted(set(by_key) - set(SECTION_KEYS) - set(POINT_KEYS))}")
    spec_by_key = {key: (title, lead, access) for key, title, lead, access, _fn in SPEC}
    for item in items:
        who = f"позиция {item['key']}"
        rep.check(bool(item["meaning"]), f"{who}: нет текста")
        for i, para in enumerate(item["meaning"], 1):
            rep.check(len(para) >= MIN_MEANING,
                      f"{who}: абзац {i} короче {MIN_MEANING} знаков ({len(para)})")
            prose.append((f"{who}, абзац {i}", para))
        rep.check(len(item.get("reading", "")) >= 80, f"{who}: нет пояснения «как читать»")
        prose.append((f"{who} · как читать", item["reading"]))
        rep.check(len(item.get("arcana", [])) == 22, f"{who}: список арканов не полный")
        if item["kind"] == "section":
            title, lead, access = spec_by_key[item["key"]]
            rep.check((item["title"], item["lead"], item["access"]) == (title, lead, access),
                      f"{who}: заголовок/вводка/доступ разъехались с engine.sections")
            rep.check(bool(item["points"]) or bool(item["links"]),
                      f"{who}: нет ни точек матрицы, ни связанных чакр")
        else:
            rep.check(bool(item.get("formula")), f"{who}: нет формулы")
            rep.check(bool(item["sections"]), f"{who}: точка не привязана ни к одному разделу")
        check_seo(rep, who, item["seo"], min_queries=4)


def check_chakras(rep: Report, items: list[dict], prose: list[tuple[str, str]]) -> None:
    rep.check(len(items) == 7, f"чакр {len(items)}, а нужно 7")
    rep.check([c["key"] for c in items] == [k for k, _t, _h in CHAKRA_ROWS],
              "порядок или ключи чакр не совпадают с engine.matrix.CHAKRAS")
    col_keys = [k for k, _t in COLUMNS]
    for c in items:
        who = f"чакра {c['key']}"
        rep.check(len(c["level"]) >= 2, f"{who}: значение уровня короче двух абзацев")
        for i, para in enumerate(c["level"], 1):
            rep.check(len(para) >= MIN_MEANING,
                      f"{who}: абзац {i} короче {MIN_MEANING} знаков ({len(para)})")
            prose.append((f"{who}, абзац {i}", para))
        rep.check([col["key"] for col in c["columns"]] == col_keys,
                  f"{who}: колонки не совпадают с engine.matrix.COLUMNS")
        for col in c["columns"]:
            rep.check(len(col["text"]) >= MIN_COLUMN_TEXT,
                      f"{who} · {col['key']}: {len(col['text'])} знаков, "
                      f"нужно {MIN_COLUMN_TEXT}+")
            prose.append((f"{who} · колонка {col['key']}", col["text"]))
        rep.check(bool(c["sections"]), f"{who}: не привязана к разделам отчёта")
        check_seo(rep, who, c["seo"], min_queries=4)


def check_seo(rep: Report, who: str, seo: dict, min_queries: int) -> None:
    rep.check(10 <= len(seo.get("title", "")) <= 90, f"{who}: title плохой длины")
    desc = seo.get("description", "")
    rep.check(60 <= len(desc) <= 200, f"{who}: description {len(desc)} знаков, нужно 60..200")
    queries = seo.get("queries", [])
    rep.check(len(queries) >= min_queries, f"{who}: запросов {len(queries)}, нужно {min_queries}+")
    rep.check(len(set(queries)) == len(queries), f"{who}: дубли запросов")


def check_queries(rep: Report, data: dict[str, dict]) -> None:
    """Один запрос — одна страница: иначе страницы конкурируют друг с другом в выдаче."""
    owner: dict[str, str] = {}
    for name, items in data.items():
        for item in items["items"]:
            who = f"{name}:{item.get('n') or item.get('key')}"
            for query in item["seo"]["queries"]:
                key = query.strip().lower()
                if key in owner and owner[key] != who:
                    rep.fail(f"запрос «{query}» стоит и у {owner[key]}, и у {who}")
                else:
                    owner.setdefault(key, who)


def check_links(rep: Report, data: dict[str, dict]) -> None:
    pages = {"/encyclopedia"}
    pages |= {f"/encyclopedia/arcanum/{a['n']}" for a in data["arcana.json"]["items"]}
    pages |= {f"/encyclopedia/position/{p['key']}" for p in data["positions.json"]["items"]}
    pages |= {f"/encyclopedia/combination/{c['key']}" for c in data["combinations.json"]["items"]}
    pages |= {f"/encyclopedia/chakra/{c['key']}" for c in data["chakras.json"]["items"]}
    rep.check(len(pages) == 298, f"страниц энциклопедии {len(pages)}, по контракту 298")

    out_degree: Counter[str] = Counter()
    in_degree: Counter[str] = Counter()

    def walk(node, page: str) -> None:
        if isinstance(node, dict):
            href = node.get("href")
            if isinstance(href, str) and href.startswith("/encyclopedia") and href != page:
                # href самой страницы (canonical) ссылкой не считается
                out_degree[page] += 1
                in_degree[href] += 1
                if href not in pages:
                    rep.fail(f"{page}: ссылка в никуда — {href}")
            for value in node.values():
                walk(value, page)
        elif isinstance(node, list):
            for value in node:
                walk(value, page)

    roots = {
        "arcana.json": lambda i: f"/encyclopedia/arcanum/{i['n']}",
        "positions.json": lambda i: f"/encyclopedia/position/{i['key']}",
        "combinations.json": lambda i: f"/encyclopedia/combination/{i['key']}",
        "chakras.json": lambda i: f"/encyclopedia/chakra/{i['key']}",
    }
    for name, page_of in roots.items():
        for item in data[name]["items"]:
            page = page_of(item)
            walk(item, page)
            rep.check(out_degree[page] > 0, f"{page}: тупик, ни одной ссылки наружу")

    orphans = sorted(p for p in pages if p != "/encyclopedia" and not in_degree[p])
    rep.check(not orphans,
              f"страниц без входящих ссылок: {len(orphans)}, первые {orphans[:10]}")


def check_texts(rep: Report, prose: list[tuple[str, str]]) -> None:
    seen: dict[str, str] = {}
    heads: dict[str, str] = {}
    for where, text in prose:
        key = norm(text)
        if key in seen:
            rep.fail(f"дубль текста: «{where}» повторяет «{seen[key]}»")
        else:
            seen[key] = where
        head = key[:HEAD_LEN]
        if head in heads and heads[head] != where:
            rep.fail(f"одинаковое начало текста: «{where}» и «{heads[head]}» — «{text[:40]}…»")
        else:
            heads.setdefault(head, where)
        low = text.lower()
        for pattern in BANNED:
            found = pattern.search(low)
            if found:
                rep.fail(f"канцелярит «{found.group()}» в {where}")
        for pattern in MEDICAL:
            found = pattern.search(low)
            if found:
                rep.fail(f"медицинская лексика «{found.group()}» в {where}: "
                         f"переводит рекламу в категорию, где нужно разрешение Минздрава")


def check_openings(rep: Report, data: dict[str, dict]) -> None:
    pair_openings: Counter[str] = Counter()
    for c in data["combinations.json"]["items"]:
        for para in c["paragraphs"]:
            pair_openings[opening(para)] += 1
    for start, count in pair_openings.most_common():
        if count > OPENING_LIMIT_PAIRS:
            rep.fail(f"зачин «{start}» повторяется {count} раз в сочетаниях "
                     f"(предел {OPENING_LIMIT_PAIRS})")

    per_section: dict[str, Counter[str]] = {k: Counter() for k in SECTION_KEYS}
    for a in data["arcana.json"]["items"]:
        for key, text in a["in_positions"].items():
            per_section[key][opening(text)] += 1
    for key, counter in per_section.items():
        for start, count in counter.most_common():
            if count > OPENING_LIMIT_SECTION:
                rep.fail(f"позиция {key}: зачин «{start}» повторяется {count} раз "
                         f"(предел {OPENING_LIMIT_SECTION})")


def main() -> int:
    rep = Report()
    data = load(rep)
    if len(data) == len(FILES):
        prose: list[tuple[str, str]] = []
        check_arcana(rep, data["arcana.json"]["items"], prose)
        check_combinations(rep, data["combinations.json"]["items"],
                           data["arcana.json"]["items"], prose)
        check_positions(rep, data["positions.json"]["items"], prose)
        check_chakras(rep, data["chakras.json"]["items"], prose)
        check_queries(rep, data)
        check_links(rep, data)
        check_texts(rep, prose)
        check_openings(rep, data)
        total = sum(len(t) for _w, t in prose)
        pairs = data["combinations.json"]["items"]
        avg = (sum(sum(len(p) for p in c["paragraphs"]) for c in pairs) / len(pairs)
               if pairs else 0)
        print(f"текстов: {len(prose)}, знаков: {total}, "
              f"средняя длина сочетания: {avg:.0f}")
    limit = len(rep.errors) if "--all" in sys.argv else 60
    print(f"проверок: {rep.checks}, ошибок: {len(rep.errors)}")
    for err in rep.errors[:limit]:
        print(f"  ✗ {err}")
    if len(rep.errors) > limit:
        print(f"  … ещё {len(rep.errors) - limit}, полный список с --all")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
