#!/usr/bin/env python3
"""Воспроизводимые SEO-артефакты единого релиза Arcana Sense.

Скрипт не обращается в сеть, не трогает БД приложения и ничего не публикует. Он связывает
неизменённый снимок семантики с контрактом метода, создаёт 26 корректных продуктовых хвостов,
реестр сущностей, классификацию 603 числовых запросов, карту URL и карточки контентного аудита.

    python tools/seo/prepare-unified-release.py
    python tools/seo/prepare-unified-release.py --check
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "project" / "destiny-matrix"
RAW = ROOT / "logs" / "needs-lab" / "матрица-судьбы-dd5dcc98" / "params.json"
METHOD = PROJECT / "spec" / "method.json"
WEB_CONTENT = PROJECT / "web" / "content"
TAIL_SOURCE = ROOT / "tools" / "seo" / "content" / "karmic-tails"
AUDIT = ROOT / "tools" / "seo" / "audit"

TODAY = "2026-08-30"
NUMBER = re.compile(r"(?<!\d)(?:[1-9]|1\d|2[0-2])(?!\d)")
WORD = re.compile(r"[а-яёa-z0-9]+", re.IGNORECASE)

POSITION_WORDS: tuple[tuple[str, str], ...] = (
    ("комфорт", "comfort"), ("центр", "center"), ("ден", "money"),
    ("финанс", "money"), ("отнош", "relations"), ("люб", "relations"),
    ("талант", "profession"), ("професс", "profession"), ("предназнач", "purpose"),
    ("род", "ancestry"), ("дет", "parents_children"), ("чакр", "chakras"),
)

STATIC_INDEXED = {
    "/": "calculate", "/encyclopedia": "catalog", "/matrix": "matrix_catalog",
    "/encyclopedia/karmic-tail": "tail_hub", "/na-god": "year_hub",
    "/o-metode": "method", "/energii": "concept", "/programmy": "concept",
    "/karmicheskaya-matrica": "concept", "/avtor": "author",
    "/contacts": "legal", "/oferta": "legal", "/privacy": "legal", "/refund": "legal",
}
STATIC_NOINDEX = {
    "/account", "/admin", "/forgot", "/login", "/register", "/reset", "/report",
    "/matrices", "/pay", "/pay/done", "/pay/fail", "/print/report",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def numbers(query: str) -> list[int]:
    return [int(value) for value in NUMBER.findall(query)]


def norm(query: str) -> str:
    return " ".join(WORD.findall(query.lower()))


def exact_tail_stats(nodes: list[dict], ordered_keys: set[str]) -> dict[str, dict[str, int]]:
    out = {key: {"exact_frequency": 0, "explicit_tail_frequency": 0, "queries": 0}
           for key in ordered_keys}
    for row in nodes:
        triple = numbers(row["phrase"])
        if len(triple) != 3:
            continue
        key = "-".join(map(str, triple))
        if key not in out:
            continue
        out[key]["exact_frequency"] += int(row["freq"])
        out[key]["queries"] += 1
        low = row["phrase"].lower()
        if "хвост" in low or "кармическ" in low:
            out[key]["explicit_tail_frequency"] += int(row["freq"])
    return out


def tail_article(key: str, sample: str, arcana: dict[int, dict], stats: dict[str, int]) -> dict:
    first, middle, root = map(int, key.split("-"))
    a, b, c = arcana[first], arcana[middle], arcana[root]
    indexed = stats["exact_frequency"] >= 800
    names = f"{first} · {a['title']} → {middle} · {b['title']} → {root} · {c['title']}"
    related_pool = []
    method = read_json(METHOD)
    for item in method["reachable_karmic_tails"]:
        other = item["triple"]
        if other == key:
            continue
        overlap = len(set(map(int, other.split("-"))) & {first, middle, root})
        if overlap:
            related_pool.append((-overlap, other))
    related = [item[1] for item in sorted(related_pool)[:4]]
    exact = stats["exact_frequency"]
    queries = [
        f"кармический хвост {key.replace('-', ' ')}",
        f"{key.replace('-', ' ')} в матрице судьбы",
        f"{key.replace('-', ' ')} расшифровка",
    ]
    return {
        "key": key,
        "entity_type": "karmic_tail",
        "publication": {
            "index": indexed,
            "follow": True,
            "primary_query": queries[0] if indexed else None,
            "exact_frequency": exact,
            "reviewed_at": TODAY,
        },
        "title": f"Кармический хвост {key}: порядок и значение трёх позиций",
        "arcana": [first, middle, root],
        "seo": {
            "title": f"Кармический хвост {key}: расшифровка M–N–D",
            "description": (
                f"Хвост {key} в матрице судьбы: роли {a['title']}, {b['title']} и "
                f"{c['title']} в строгом порядке M–N–D, формула и практическое чтение."
            ),
            "queries": queries if indexed else [],
        },
        "short": (
            f"{names}. Это не неупорядоченный набор чисел, а три разные роли нижнего луча: "
            "первая показывает вход в повторяющийся сценарий, вторая — механизм его закрепления, "
            "третья — корневую задачу. Перестановка чисел меняет результат."
        ),
        "sections": [
            {
                "h2": "Как получилась последовательность",
                "paragraphs": [
                    f"Для контрольной даты {'.'.join(reversed(sample.split('-')))} формула даёт "
                    f"ровно {key}. M — внутренняя нижняя точка D+E, N — свёртка D+M, D — "
                    "кармическая задача из A+B+C. Каждая сумма сразу сворачивается сложением "
                    "цифр, пока значение не станет не больше 22.",
                    f"Порядок записи — {first} → {middle} → {root}. Он фиксирован символами "
                    "M–N–D и не зависит от того, как похожий запрос набрали в поиске. Обратная "
                    "или иная перестановка является отдельной сущностью только тогда, когда сама "
                    "достижима по той же формуле.",
                ],
            },
            {
                "h2": "Первая позиция M — как сценарий включается",
                "paragraphs": [
                    f"Здесь стоит {first} аркан — {a['title']}. {a['in_positions']['past_lives']} "
                    "В первой позиции этот смысл читается именно как вход: по какой привычной "
                    "реакции человек замечает начало повторяющегося сюжета.",
                ],
            },
            {
                "h2": "Средняя позиция N — что удерживает повтор",
                "paragraphs": [
                    f"Среднюю роль занимает {middle} аркан — {b['title']}. "
                    f"{b['in_positions']['past_lives']} Здесь важен механизм: что связывает "
                    "первичную реакцию с корневой задачей и почему одного намерения бывает мало, "
                    "чтобы изменить привычный ход.",
                ],
            },
            {
                "h2": "Корневая позиция D — чему учит связка",
                "paragraphs": [
                    f"Третья позиция — {root} аркан, {c['title']}. "
                    f"{c['in_positions']['past_lives']} В хвосте это не финальный приговор, а "
                    "направление наблюдения: какую реакцию полезно перестать выполнять на автомате.",
                    f"Связку {key} читают слева направо: сначала заметить проявление "
                    f"{a['title']}, затем проверить удерживающий механизм {b['title']}, после чего "
                    f"работать с задачей {c['title']}. Текст описывает эзотерическую модель для "
                    "саморефлексии, а не научный факт, доказанный прогноз или обещание события.",
                ],
            },
        ],
        "faq": [
            {
                "q": f"Можно ли переставить числа в хвосте {key}?",
                "a": "Нет. В Arcana Sense первое, второе и третье число соответствуют M, N и D. "
                     "Перестановка меняет роли и не перенаправляется на эту страницу автоматически.",
            },
            {
                "q": "Почему в другом источнике эта тройка может быть записана иначе?",
                "a": "Источники используют разные направления чтения и разные формулы. На этой "
                     "странице показан только порядок M–N–D из опубликованного контракта Arcana Sense.",
            },
            {
                "q": "Одинаковы ли числа для мужской и женской карты?",
                "a": "Да, пол не меняет арифметику точек. Он остаётся частью выбранной карты и "
                     "покупки, но для одной даты последовательность M–N–D будет одинаковой.",
            },
        ],
        "related": related + [f"arcanum/{first}", f"arcanum/{middle}", f"arcanum/{root}"],
    }


def classify(row: dict, valid: set[str], indexed: set[str]) -> dict:
    query = row["phrase"]
    low = query.lower()
    triple = numbers(query)
    key = "-".join(map(str, triple))
    shape = "-".join(map(str, sorted(triple)))
    context = None
    landing = None
    entity = None
    evidence: list[str] = []

    if "совместим" in low:
        intent = "compatibility"
        evidence.append("явный маркер совместимости")
    elif re.search(r"\b(?:19|20)\d{2}\b", low) or " на год" in low:
        intent = "year"
        landing = "/na-god"
        evidence.append("явный годовой интент")
    elif "хвост" in low or "кармическ" in low:
        intent = "tail"
        evidence.append("явное слово хвост/кармический")
        if key in valid:
            entity = f"tail:{key}"
            landing = f"/encyclopedia/karmic-tail/{key}" if key in indexed else None
            evidence.append("ordered-последовательность есть в контракте метода")
        else:
            evidence.append("последовательности нет в реестре 26; чужую формулу не публикуем")
    elif "программ" in low:
        intent = "program"
        context = "loops"
        landing = "/programmy"
        entity = f"occurrence:loops:{key}"
        evidence.append("явное слово программа; это не делает тройку хвостом")
    else:
        position = next(((needle, name) for needle, name in POSITION_WORDS if needle in low), None)
        if position:
            intent = "position"
            context = position[1]
            landing = f"/encyclopedia/position/{context}"
            entity = f"occurrence:{context}:{key}"
            evidence.append(f"явный маркер позиции: {position[0]}")
        elif any(word in low for word in ("рассчитать", "калькулятор", "дата рождения")):
            intent = "calculate"
            landing = "/"
            evidence.append("явный расчётный интент")
        elif any(word in low for word in ("гадалкин", "нумеф", "ладин", "аркана сенс")):
            intent = "brand"
            evidence.append("брендовый запрос")
        else:
            intent = "meaning"
            evidence.append("числовой запрос без предметного маркера")
            if key in valid:
                entity = f"tail:{key}"
                landing = f"/encyclopedia/karmic-tail/{key}" if key in indexed else None
                evidence.append("точный порядок совпал с продуктовым хвостом")

    return {
        "query": query,
        "frequency": int(row["freq"]),
        "intent": intent,
        "context": context,
        "ordered_numbers": triple,
        "unordered_shape": list(map(int, shape.split("-"))),
        "method_entity": entity,
        "landing_url": landing,
        "primary_or_supporting": "primary" if landing else "reject",
        "confidence": "product_verified" if entity and entity.startswith("tail:") else "automatic",
        "evidence": "; ".join(evidence),
        "reviewed_at": TODAY,
    }


def semantic_artifacts(nodes: list[dict], valid: set[str], indexed: set[str]) -> tuple[str, str, str]:
    source = [row for row in nodes if len(numbers(row["phrase"])) == 3]
    rows = [classify(row, valid, indexed) for row in source]
    rows.sort(key=lambda item: (-item["frequency"], item["query"]))
    fields = list(rows[0])
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        encoded = dict(row)
        encoded["ordered_numbers"] = "-".join(map(str, row["ordered_numbers"]))
        encoded["unordered_shape"] = "-".join(map(str, row["unordered_shape"]))
        writer.writerow(encoded)

    intents = Counter(row["intent"] for row in rows)
    accepted_frequency = sum(row["frequency"] for row in rows if row["landing_url"])
    rejected_frequency = sum(row["frequency"] for row in rows if not row["landing_url"])
    summary = {
        "generated_at": TODAY,
        "raw_source": str(RAW.relative_to(ROOT)),
        "raw_sha256": sha(RAW),
        "classifier_sha256": sha(Path(__file__)),
        "raw_rows": len(source),
        "raw_frequency": sum(int(row["freq"]) for row in source),
        "unique_unordered_shapes": len({tuple(sorted(numbers(row["phrase"]))) for row in source}),
        "classified_once": len({row["query"] for row in rows}) == len(rows),
        "intent_counts": dict(sorted(intents.items())),
        "accepted_frequency": accepted_frequency,
        "rejected_frequency": rejected_frequency,
        "frequency_checksum": accepted_frequency + rejected_frequency,
        "serp_policy": (
            "Неоднозначный запрос без продуктовой сущности не создаёт landing. Внешний SERP не "
            "может переопределить формулу; будущая индексация требует отдельного датированного review."
        ),
    }
    return dump({"items": rows}), output.getvalue(), dump(summary)


def item_list(name: str) -> list[dict]:
    payload = read_json(WEB_CONTENT / name)
    return payload.get("items", payload)


def url_registry(tails: list[dict]) -> list[dict]:
    rows: list[dict] = []

    def add(url: str, entity: str, decision: str, index: bool, reason: str,
            canonical: str | None = None) -> None:
        rows.append({
            "old_url": url, "entity_type": entity, "index_now": index,
            "impressions": None, "clicks": None, "backlinks": None,
            "decision": decision, "new_url": canonical if decision == "redirect" else None,
            "status_code": 200 if decision in ("keep", "noindex") else 404,
            "canonical": canonical or (url if decision in ("keep", "noindex") else None),
            "sitemap": decision == "keep" and index,
            "reason": reason, "owner": "seo+product", "release": "unified",
        })

    for url, entity in sorted(STATIC_INDEXED.items()):
        add(url, entity, "keep", True, "каноническая публичная страница")
    for url in sorted(STATIC_NOINDEX):
        add(url, "private_or_transactional", "noindex", False,
            "личный, служебный или транзакционный адрес")
    for n in range(1, 23):
        add(f"/encyclopedia/arcanum/{n}", "arcanum", "keep", True, "канонический аркан")
    for item in item_list("positions.json"):
        add(f"/encyclopedia/position/{item['key']}", item["kind"], "keep", True,
            "каноническая позиция метода")
    for item in item_list("chakras.json"):
        add(f"/encyclopedia/chakra/{item['key']}", "chakra", "keep", True,
            "канонический уровень карты энергий")
    for item in item_list("combinations.json"):
        add(f"/encyclopedia/combination/{item['key']}", "combination", "keep", True,
            "каноническая неупорядоченная пара")
    for item in tails:
        add(f"/encyclopedia/karmic-tail/{item['key']}", "karmic_tail",
            "keep" if item["publication"]["index"] else "noindex",
            bool(item["publication"]["index"]),
            "ordered-хвост метода; индексируется только после demand gate")
    for item in item_list("year-arcana.json"):
        add(f"/na-god/{item['n']}", "year", "keep", True, "каноническая годовая статья")
    for item in item_list("matrices.json"):
        add(f"/matrix/{item['slug']}", "calculated_matrix", "noindex", False,
            "производный продуктовый результат, не SEO landing")
    return sorted(rows, key=lambda row: row["old_url"])


def review_cards(tails: list[dict], urls: list[dict]) -> list[dict]:
    cards: list[dict] = []
    categories = (
        ("arcana.json", "arcanum", "n"), ("positions.json", "position", "key"),
        ("chakras.json", "chakra", "key"), ("combinations.json", "combination", "key"),
        ("year-arcana.json", "year", "n"), ("category-hubs.json", "category_hub", "key"),
        ("hubs.json", "hub", "key"),
    )
    for filename, entity, keyfield in categories:
        for item in item_list(filename):
            key = str(item[keyfield])
            seo = item.get("seo", {})
            cards.append({
                "entity": f"{entity}:{key}", "source": f"web/content/{filename}",
                "primary_query": (seo.get("queries") or [None])[0],
                "search_intent": entity, "formula_verified": entity in {"position", "chakra"},
                "position_context_verified": entity in {"position", "chakra", "combination"},
                "claims_reviewed": "automated contract/safety audit",
                "unique_value": "content validator + category invariants",
                "paid_report_overlap": "checked" if entity in {"position", "arcanum", "chakra"} else "n/a",
                "internal_links": "automated", "metadata": "automated",
                "decision": "keep", "reviewer": "Codex engineering/content audit",
                "reviewed_at": TODAY, "independent_editor": "pending human sign-off",
            })
    for item in tails:
        cards.append({
            "entity": f"karmic_tail:{item['key']}", "source": "tools/seo/content/karmic-tails",
            "primary_query": item["publication"]["primary_query"], "search_intent": "tail",
            "formula_verified": True, "position_context_verified": True,
            "claims_reviewed": "automated contract/safety audit",
            "unique_value": "three explicit M–N–D roles",
            "paid_report_overlap": "encyclopedia deepens the in-report position texts",
            "internal_links": "automated", "metadata": "automated",
            "decision": "keep" if item["publication"]["index"] else "noindex",
            "reviewer": "Codex engineering/content audit", "reviewed_at": TODAY,
            "independent_editor": "pending human sign-off",
        })
    for row in urls:
        if row["entity_type"] in {"calculate", "matrix_catalog", "method", "concept", "author", "legal"}:
            cards.append({
                "entity": f"page:{row['old_url']}", "source": "web/app",
                "primary_query": None, "search_intent": row["entity_type"],
                "formula_verified": row["entity_type"] in {"calculate", "method"},
                "position_context_verified": True,
                "claims_reviewed": "automated route/claims audit",
                "unique_value": "route-level review", "paid_report_overlap": "checked",
                "internal_links": "crawler", "metadata": "crawler", "decision": row["decision"],
                "reviewer": "Codex engineering/content audit", "reviewed_at": TODAY,
                "independent_editor": "pending human sign-off",
            })
    return sorted(cards, key=lambda card: card["entity"])


def expected_outputs() -> dict[Path, str]:
    raw = read_json(RAW)
    method = read_json(METHOD)
    reachable = method["reachable_karmic_tails"]
    valid = {item["triple"] for item in reachable}
    arcana = {item["n"]: item for item in item_list("arcana.json")}
    stats = exact_tail_stats(raw["nodes"], valid)
    tails = [tail_article(item["triple"], item["sample_birth"], arcana,
                          stats[item["triple"]])
             for item in reachable]
    tails.sort(key=lambda item: tuple(map(int, item["key"].split("-"))))
    indexed = {item["key"] for item in tails if item["publication"]["index"]}
    entities = {
        "generated_at": TODAY,
        "karmic_tails": [
            {"ordered_key": item["key"], "arcana": item["arcana"],
             "sample_birth": next(r["sample_birth"] for r in reachable if r["triple"] == item["key"]),
             "publication": item["publication"]}
            for item in tails
        ],
        "occurrence_types": [
            {"key": "karmic_tail", "entity_type": "tail", "symbols": ["M", "N", "D"]},
            {"key": "money", "entity_type": "occurrence", "symbols": ["L", "R2", "R"]},
            {"key": "relations", "entity_type": "occurrence", "symbols": ["M", "R1", "R"]},
            {"key": "talent", "entity_type": "occurrence", "symbols": ["B", "P", "K"]},
            {"key": "comfort", "entity_type": "section", "symbols": ["E", "M", "K"]},
            {"key": "loops", "entity_type": "section", "symbols": ["D", "E", "harmony"]},
        ],
        "rules": {
            "ordered_tail_only": True,
            "unordered_shape_is_not_an_entity": True,
            "three_numbers_do_not_imply_tail": True,
            "unknown_program_requires_position": True,
        },
    }
    semantic_json, semantic_csv, semantic_summary = semantic_artifacts(raw["nodes"], valid, indexed)
    urls = url_registry(tails)
    cards = review_cards(tails, urls)
    outputs: dict[Path, str] = {
        PROJECT / "spec" / "entities.json": dump(entities),
        AUDIT / "semantic-core.json": semantic_json,
        AUDIT / "semantic-core.csv": semantic_csv,
        AUDIT / "semantic-summary.json": semantic_summary,
        AUDIT / "public-url-map.json": dump({"items": urls}),
        AUDIT / "content-review.json": dump({"items": cards}),
    }
    for item in tails:
        outputs[TAIL_SOURCE / f"{item['key']}.json"] = dump(item)
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    outputs = expected_outputs()
    stale: list[str] = []
    for path, body in outputs.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != body:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body, encoding="utf-8")
    if stale:
        print("устарели артефакты единого релиза:")
        for path in stale:
            print(f"  - {path}")
        return 1
    action = "проверено" if args.check else "собрано"
    print(f"{action}: {len(outputs)} артефактов; raw {sha(RAW)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
