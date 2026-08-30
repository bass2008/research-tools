"""Load the canonical encyclopedia datasets from :mod:`content.data` JSON files.

The ``content/data`` directory deliberately contains no executable Python.  This module is
the single boundary that reads those files and adapts JSON-only representations (string object
keys and pair rows) to the structures consumed by the content builder.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


DATA_DIR = Path(__file__).with_name("data")
DATA_FILES = frozenset({
    "arcana.json",
    "chakras.json",
    "in-positions.json",
    "pairs.json",
    "points.json",
    "sections.json",
    "text-policy.json",
})


def _object_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


@lru_cache(maxsize=None)
def load_json(name: str) -> Any:
    """Read one declared dataset and reject malformed or duplicate-key JSON."""
    if name not in DATA_FILES:
        raise ValueError(f"unknown content dataset: {name}")
    path = DATA_DIR / name
    try:
        return json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_object_without_duplicates,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"cannot load content dataset {path}: {error}") from error


def _list_dataset(name: str) -> list[dict[str, Any]]:
    value = load_json(name)
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        raise ValueError(f"{name}: expected an array of objects")
    return value


ARCANA = _list_dataset("arcana.json")
CHAKRAS_TEXT = _list_dataset("chakras.json")
POINTS = _list_dataset("points.json")
SECTIONS_META = _list_dataset("sections.json")
TEXT_POLICY = load_json("text-policy.json")


def _load_in_positions() -> dict[int, dict[str, str]]:
    value = load_json("in-positions.json")
    if not isinstance(value, dict):
        raise ValueError("in-positions.json: expected an object keyed by arcanum number")

    result: dict[int, dict[str, str]] = {}
    for raw_number, rows in value.items():
        try:
            number = int(raw_number)
        except (TypeError, ValueError) as error:
            raise ValueError(f"in-positions.json: invalid arcanum number {raw_number!r}") from error
        if str(number) != raw_number or not 1 <= number <= 22:
            raise ValueError(f"in-positions.json: arcanum number outside 1..22: {raw_number!r}")
        if not isinstance(rows, dict) or not all(
            isinstance(key, str) and isinstance(text, str) for key, text in rows.items()
        ):
            raise ValueError(f"in-positions.json: arcanum {number} must map strings to strings")
        result[number] = rows
    return result


def _load_pairs() -> dict[tuple[int, int], tuple[str, ...]]:
    rows = _list_dataset("pairs.json")
    result: dict[tuple[int, int], tuple[str, ...]] = {}
    for index, row in enumerate(rows):
        if set(row) != {"a", "b", "texts"}:
            raise ValueError(f"pairs.json row {index}: expected only a, b and texts")
        a, b, texts = row["a"], row["b"], row["texts"]
        if not isinstance(a, int) or isinstance(a, bool) or not isinstance(b, int) or isinstance(b, bool):
            raise ValueError(f"pairs.json row {index}: a and b must be integers")
        key = (a, b)
        if not 1 <= a < b <= 22:
            raise ValueError(f"pairs.json row {index}: pair {key} must satisfy 1 <= a < b <= 22")
        if key in result:
            raise ValueError(f"pairs.json row {index}: duplicate pair {key}")
        if not isinstance(texts, list) or len(texts) < 3 or not all(
            isinstance(text, str) for text in texts
        ):
            raise ValueError(f"pairs.json row {index}: texts must contain a lead and two paragraphs")
        result[key] = tuple(texts)
    return result


IN_POSITIONS = _load_in_positions()
PAIRS = _load_pairs()


__all__ = [
    "ARCANA",
    "CHAKRAS_TEXT",
    "DATA_DIR",
    "DATA_FILES",
    "IN_POSITIONS",
    "PAIRS",
    "POINTS",
    "SECTIONS_META",
    "TEXT_POLICY",
    "load_json",
]
