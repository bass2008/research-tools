"""Load the canonical encyclopedia datasets from :mod:`content.data` JSON files.

The ``content/data/<lang>`` directories deliberately contain no executable Python.  This module
is the single boundary that reads those files and adapts JSON-only representations (string object
keys and pair rows) to the structures consumed by the content builder.

Язык — обязательный параметр загрузки, а не свойство модуля: корпус каждого языка живёт своим
каталогом, и сборка должна уметь собрать любой из них в одном процессе.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).with_name("data")
DEFAULT_LANG = "ru"
LANGS = ("ru", "en")
DATA_FILES = frozenset({
    "arcana.json",
    "chakras.json",
    "in-positions.json",
    "pairs.json",
    "points.json",
    "sections.json",
    "text-policy.json",
})


def data_dir(lang: str = DEFAULT_LANG) -> Path:
    if lang not in LANGS:
        raise ValueError(f"unknown corpus language: {lang}")
    return ROOT_DIR / lang


def _object_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


@lru_cache(maxsize=None)
def load_json(name: str, lang: str = DEFAULT_LANG) -> Any:
    """Read one declared dataset and reject malformed or duplicate-key JSON."""
    if name not in DATA_FILES:
        raise ValueError(f"unknown content dataset: {name}")
    path = data_dir(lang) / name
    try:
        return json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_object_without_duplicates,
        )
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"cannot load content dataset {path}: {error}") from error


def _list_dataset(name: str, lang: str) -> list[dict[str, Any]]:
    value = load_json(name, lang)
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        raise ValueError(f"{name}: expected an array of objects")
    return value


def _load_in_positions(lang: str) -> dict[int, dict[str, str]]:
    value = load_json("in-positions.json", lang)
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


def _load_pairs(lang: str) -> dict[tuple[int, int], tuple[str, ...]]:
    rows = _list_dataset("pairs.json", lang)
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


@dataclass(frozen=True)
class Corpus:
    """Исходный корпус одного языка: тот же контракт, другой текст."""

    lang: str
    data_dir: Path
    arcana: list[dict[str, Any]]
    chakras: list[dict[str, Any]]
    points: list[dict[str, Any]]
    sections: list[dict[str, Any]]
    text_policy: Any
    in_positions: dict[int, dict[str, str]]
    pairs: dict[tuple[int, int], tuple[str, ...]]


@lru_cache(maxsize=None)
def corpus(lang: str = DEFAULT_LANG) -> Corpus:
    return Corpus(
        lang=lang,
        data_dir=data_dir(lang),
        arcana=_list_dataset("arcana.json", lang),
        chakras=_list_dataset("chakras.json", lang),
        points=_list_dataset("points.json", lang),
        sections=_list_dataset("sections.json", lang),
        text_policy=load_json("text-policy.json", lang),
        in_positions=_load_in_positions(lang),
        pairs=_load_pairs(lang),
    )


def available_langs() -> tuple[str, ...]:
    """Языки, корпус которых действительно лежит на диске."""
    return tuple(lang for lang in LANGS if (ROOT_DIR / lang).is_dir())


# Русский корпус доступен как модульные константы: он же язык по умолчанию у всех проверок,
# которые язык не выбирают.
_RU = corpus(DEFAULT_LANG)
DATA_DIR = _RU.data_dir
ARCANA = _RU.arcana
CHAKRAS_TEXT = _RU.chakras
POINTS = _RU.points
SECTIONS_META = _RU.sections
TEXT_POLICY = _RU.text_policy
IN_POSITIONS = _RU.in_positions
PAIRS = _RU.pairs


__all__ = [
    "ARCANA",
    "CHAKRAS_TEXT",
    "Corpus",
    "DATA_DIR",
    "DATA_FILES",
    "DEFAULT_LANG",
    "IN_POSITIONS",
    "LANGS",
    "PAIRS",
    "POINTS",
    "ROOT_DIR",
    "SECTIONS_META",
    "TEXT_POLICY",
    "available_langs",
    "corpus",
    "data_dir",
    "load_json",
]
