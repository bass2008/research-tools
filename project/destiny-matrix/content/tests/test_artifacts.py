"""Собранный JSON обязан быть точным снимком канонических Python-источников."""
from __future__ import annotations

import json
from pathlib import Path

from content import build
from engine.sections import SPEC


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
            # SEO-сборщик поверх канонического core намеренно заменяет только длинное meaning и
            # metadata. Ни одно расчётное/структурное поле при обогащении меняться не может.
            by_key = {str(row.get("n", row.get("key"))): row for row in items}
            normalized = []
            for row in actual:
                key = str(row.get("n", row.get("key")))
                copy = dict(row)
                copy["meaning"] = by_key[key]["meaning"]
                copy["seo"] = by_key[key]["seo"]
                normalized.append(copy)
            actual = normalized
        assert actual == items, f"{name}: выполните content.build, затем tools/seo/build-content.py"


def test_public_section_catalog_is_the_safe_exact_snapshot():
    expected = [
        {"key": key, "title": title, "access": access}
        for key, title, _lead, access, _positions in SPEC
    ]
    assert _items("sections.json") == expected
