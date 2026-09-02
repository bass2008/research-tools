"""Собранный JSON обязан быть точным снимком канонических Python-источников."""
from __future__ import annotations

import json
from pathlib import Path

from content import build
from engine.sections import DEFINITIONS


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "content"


def _items(name: str) -> list[dict]:
    payload = json.loads((OUT / name).read_text(encoding="utf-8"))
    assert payload["count"] == len(payload["items"])
    return payload["items"]


def test_core_content_artifacts_have_no_generation_drift():
    expected = {
        "arcana.json": build.build_arcana(),
        "combinations.json": build.build_combinations(),
        "positions.json": build.build_positions(),
        "chakras.json": build.build_chakras(),
    }
    for name, items in expected.items():
        actual = _items(name)
        if name in {"arcana.json", "positions.json"}:
            # SEO-сборщик поверх канонического core намеренно заменяет длинное meaning и
            # metadata, а для статей разделов добавляет article_sections и faq. Ни одно
            # расчётное/структурное поле при обогащении меняться не может.
            by_key = {str(row.get("n", row.get("key"))): row for row in items}
            normalized = []
            for row in actual:
                key = str(row.get("n", row.get("key")))
                copy = dict(row)
                core = by_key[key]
                for field in ("meaning", "seo", "article_sections", "faq"):
                    if field in core:
                        copy[field] = core[field]
                    else:
                        copy.pop(field, None)
                normalized.append(copy)
            actual = normalized
        assert actual == items, f"{name}: выполните content.build, затем tools/seo/build-content.py"


def test_client_arcana_catalog_contains_no_article_or_paid_text():
    expected = build.build_arcana_catalog(build.build_arcana())
    actual = _items("arcana-catalog.json")
    assert actual == expected
    assert all(set(row) == {"n", "slug", "title", "short"} for row in actual)


def test_client_point_catalog_is_generated_from_canonical_labels():
    expected = build.build_point_catalog()
    actual = _items("points-catalog.json")
    assert actual == expected
    assert all(set(row) == {"key", "report_label"} for row in actual)


def test_public_section_catalog_is_the_safe_exact_snapshot():
    expected = []
    for definition in DEFINITIONS:
        item = {key: definition[key] for key in ("key", "title", "access")}
        if definition["access"] == "free":
            item["lead"] = definition["lead"]
            item["positions"] = definition["positions"]
        expected.append(item)
    assert _items("sections.json") == expected


def test_content_validator_runs_inside_pytest():
    """Валидатор корпуса запускался только из compose/scripts/run-tests.sh.

    Из-за этого «зелёный pytest» ничего не говорил о контенте: сломанный шаблон канцелярита,
    неверный пример в статье и шаблонные вводные жили ровно в той проверке, которую быстрый цикл
    не выполнял. Гоняем её здесь же, чтобы разрыв не открылся снова.
    """
    from content import validate

    report = validate.Report()
    data = validate.load(report)
    prose: list[tuple[str, str]] = []
    validate.check_arcana(report, data["arcana.json"]["items"], prose)
    validate.check_positions(report, data["positions.json"]["items"], prose)
    validate.check_examples(report, data["positions.json"]["items"])
    validate.check_section_openings(report, data["positions.json"]["items"])
    validate.check_texts(report, prose)
    assert report.errors == [], report.errors[:10]
