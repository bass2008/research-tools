"""Инварианты таксономии, семантики, URL и полного контентного корпуса."""
from __future__ import annotations

import hashlib
import itertools
import json
import re
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[2]
ROOT = PROJECT.parents[1]
AUDIT = ROOT / "tools" / "seo" / "audit"
TAILS = ROOT / "tools" / "seo" / "content" / "karmic-tails"
WEB = PROJECT / "web" / "content"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def items(path: Path) -> list[dict]:
    value = load(path)
    return value.get("items", value)


def test_exact_ordered_tail_registry_and_all_product_content():
    method = load(PROJECT / "spec" / "method.json")
    registry = load(PROJECT / "spec" / "entities.json")
    expected = {row["triple"] for row in method["reachable_karmic_tails"]}
    entities = registry["karmic_tails"]
    assert len(expected) == len(entities) == 26
    assert {row["ordered_key"] for row in entities} == expected
    assert {path.stem for path in TAILS.glob("*.json")} == expected
    assert {row["key"] for row in items(WEB / "karmic-tails.json")} == expected
    for row in entities:
        assert row["arcana"] == [int(value) for value in row["ordered_key"].split("-")]


def test_three_orders_of_18_9_9_are_distinct_entities():
    entities = {row["ordered_key"]: row for row in load(PROJECT / "spec" / "entities.json")["karmic_tails"]}
    assert {"18-9-9", "9-18-9", "9-9-18"} <= set(entities)
    assert len({tuple(entities[key]["arcana"])
                for key in ("18-9-9", "9-18-9", "9-9-18")}) == 3


def test_603_queries_are_classified_once_without_frequency_loss():
    core = items(AUDIT / "semantic-core.json")
    summary = load(AUDIT / "semantic-summary.json")
    raw = ROOT / summary["raw_source"]
    assert hashlib.sha256(raw.read_bytes()).hexdigest() == summary["raw_sha256"]
    assert len(core) == summary["raw_rows"] == 603
    assert len({row["query"] for row in core}) == 603
    assert sum(row["frequency"] for row in core) == summary["frequency_checksum"] == 199_240
    assert summary["accepted_frequency"] + summary["rejected_frequency"] == 199_240
    assert all(row["intent"] and row["primary_or_supporting"] in {"primary", "reject"}
               for row in core)
    valid = {row["ordered_key"] for row in load(PROJECT / "spec" / "entities.json")["karmic_tails"]}
    for row in core:
        if row["method_entity"] and row["method_entity"].startswith("tail:"):
            assert row["method_entity"].removeprefix("tail:") in valid


def test_public_url_registry_is_total_unique_and_sitemap_safe():
    urls = items(AUDIT / "public-url-map.json")
    assert len(urls) == len({row["old_url"] for row in urls})
    assert len(urls) > 5_900
    for row in urls:
        if row["sitemap"]:
            assert row["decision"] == "keep"
            assert row["index_now"] is True
            assert row["status_code"] == 200
            assert row["canonical"] == row["old_url"]
        if row["decision"] in {"404", "410"}:
            assert row["sitemap"] is False
            assert row["canonical"] is None
    assert not [row for row in urls
                if row["entity_type"] == "calculated_matrix" and row["sitemap"]]
    expected_tails = {
        row["ordered_key"] for row in load(PROJECT / "spec" / "entities.json")["karmic_tails"]
    }
    tail_urls = {
        row["old_url"].rsplit("/", 1)[-1]
        for row in urls
        if row["entity_type"] == "karmic_tail"
    }
    assert tail_urls == expected_tails


def _ngrams(item: dict, n: int = 5) -> set[tuple[str, ...]]:
    text = " ".join([item["short"], *(p for section in item["sections"]
                                         for p in section["paragraphs"])])
    words = re.findall(r"[а-яёa-z0-9]+", text.lower())
    return set(zip(*(words[offset:] for offset in range(n))))


def test_indexed_tails_have_unique_metadata_query_and_no_near_copy():
    indexed = [row for row in items(WEB / "karmic-tails.json") if row["publication"]["index"]]
    assert len(indexed) == 22
    assert len({row["title"] for row in indexed}) == len(indexed)
    assert len({row["seo"]["title"] for row in indexed}) == len(indexed)
    assert len({row["seo"]["description"] for row in indexed}) == len(indexed)
    assert len({row["publication"]["primary_query"] for row in indexed}) == len(indexed)
    for left, right in itertools.combinations(indexed, 2):
        a, b = _ngrams(left), _ngrams(right)
        similarity = len(a & b) / len(a | b)
        assert similarity < 0.70, f"near-copy {left['key']} / {right['key']}: {similarity:.3f}"


def test_every_material_has_review_card_and_all_report_sections_are_covered():
    cards = items(AUDIT / "content-review.json")
    assert len(cards) == len({row["entity"] for row in cards})
    covered = {row["entity"] for row in cards}
    for filename, entity, field in (
        ("arcana.json", "arcanum", "n"), ("positions.json", "position", "key"),
        ("chakras.json", "chakra", "key"), ("combinations.json", "combination", "key"),
        ("year-arcana.json", "year", "n"), ("category-hubs.json", "category_hub", "key"),
        ("hubs.json", "hub", "key"),
    ):
        for row in items(WEB / filename):
            assert f"{entity}:{row[field]}" in covered
    for row in items(WEB / "karmic-tails.json"):
        assert f"karmic_tail:{row['key']}" in covered
    sections = items(WEB / "sections.json")
    assert len(sections) == 20
    for section in sections:
        assert f"position:{section['key']}" in covered
    assert all(row["decision"] in {"keep", "noindex"} for row in cards)


def test_position_arcanum_registry_matches_the_public_url_map():
    """Реестр пересечений и карта публичных адресов обязаны совпадать: запись без адреса — это
    потерянный спрос, адрес без записи — тонкий корпус, которым проект уже обжигался."""
    registry = load(WEB / "position-arcanum.json")
    assert registry["threshold"] >= 500, registry["threshold"]
    assert registry["count"] == len(registry["items"])
    pages = {f"/encyclopedia/position/{i['position']}/{i['arcanum']}" for i in registry["items"]}
    assert len(pages) == len(registry["items"]), "повтор пары позиция-аркан"

    urls = {row["old_url"] for row in items(AUDIT / "public-url-map.json")
            if row["entity_type"] == "position_arcanum"}
    assert urls == pages, sorted(pages ^ urls)[:5]

    cards = {row["entity"] for row in items(AUDIT / "content-review.json")
             if row["entity"].startswith("position_arcanum:")}
    assert cards == {f"position_arcanum:{i['position']}/{i['arcanum']}" for i in registry["items"]}

    below = [i for i in registry["items"] if i["frequency"] < registry["threshold"]]
    assert below == [], below


def test_position_arcanum_primary_queries_are_unique():
    """Два адреса не могут целиться в один головной запрос: поиск выберет между ними сам и
    обычно занизит оба."""
    registry = load(WEB / "position-arcanum.json")["items"]
    queries = [i["primary_query"].strip().lower() for i in registry]
    duplicates = {q for q in queries if queries.count(q) > 1}
    assert duplicates == set(), sorted(duplicates)


def test_tail_crossings_exist_in_the_method():
    """Хвост — тройка: аркан, которого движок туда не ставит, не может иметь страницу «в хвосте»,
    сколько бы его ни спрашивали. Арканы 1 и 2 как раз такие, и спрос по ним нулевой под обоими
    именами — это и подтвердило, что «программа N» и «хвост N» одно и то же."""
    registry = load(WEB / "position-arcanum.json")["items"]
    reachable = {row["triple"] for row in load(PROJECT / "spec" / "method.json")["reachable_karmic_tails"]}
    for item in registry:
        if item["position"] != "past_lives":
            assert item["tails"] == [], item
            continue
        assert item["tails"], item
        for triple in item["tails"]:
            assert triple in reachable, (item["arcanum"], triple)
            assert str(item["arcanum"]) in triple.split("-"), (item["arcanum"], triple)
