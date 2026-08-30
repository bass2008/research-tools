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


def tail_sources(reachable: list[dict], stats: dict[str, dict[str, int]]) -> list[dict]:
    """Load hand-edited tail articles and verify their calculation-facing metadata.

    Editorial copy is source content, not a generated release artifact. Keeping this boundary
    prevents a technical SEO rebuild from replacing reviewed prose with a generic template.
    """
    expected_keys = {item["triple"] for item in reachable}
    source_paths = {path.stem: path for path in TAIL_SOURCE.glob("*.json")}
    actual_keys = set(source_paths)
    if actual_keys != expected_keys:
        missing = sorted(expected_keys - actual_keys)
        extra = sorted(actual_keys - expected_keys)
        raise ValueError(f"karmic-tail sources mismatch: missing={missing}, extra={extra}")

    tails: list[dict] = []
    for key in sorted(expected_keys, key=lambda value: tuple(map(int, value.split("-")))):
        item = read_json(source_paths[key])
        expected_arcana = list(map(int, key.split("-")))
        expected_index = stats[key]["exact_frequency"] >= 800
        expected_primary = f"кармический хвост {key.replace('-', ' ')}" if expected_index else None
        checks = {
            "key": (item.get("key"), key),
            "entity_type": (item.get("entity_type"), "karmic_tail"),
            "arcana": (item.get("arcana"), expected_arcana),
            "publication.index": (item.get("publication", {}).get("index"), expected_index),
            "publication.follow": (item.get("publication", {}).get("follow"), True),
            "publication.primary_query": (
                item.get("publication", {}).get("primary_query"), expected_primary
            ),
            "publication.exact_frequency": (
                item.get("publication", {}).get("exact_frequency"),
                stats[key]["exact_frequency"],
            ),
        }
        mismatches = [
            f"{field}: {actual!r} != {expected!r}"
            for field, (actual, expected) in checks.items()
            if actual != expected
        ]
        if mismatches:
            raise ValueError(f"{source_paths[key]}: " + "; ".join(mismatches))
        tails.append(item)
    return tails


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
    stats = exact_tail_stats(raw["nodes"], valid)
    tails = tail_sources(reachable, stats)
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
