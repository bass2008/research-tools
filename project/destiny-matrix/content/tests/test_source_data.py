"""The canonical content directory is JSON-only and loads through content.source."""
from __future__ import annotations

import json
import re

from content.source import (
    ARCANA,
    CHAKRAS_TEXT,
    DATA_DIR,
    DATA_FILES,
    IN_POSITIONS,
    PAIRS,
    POINTS,
    SECTIONS_META,
    TEXT_POLICY,
)


def test_data_directory_contains_only_the_declared_json_datasets():
    files = {path.relative_to(DATA_DIR).as_posix() for path in DATA_DIR.rglob("*") if path.is_file()}
    assert files == DATA_FILES
    assert all(path.suffix == ".json" for path in DATA_DIR.rglob("*") if path.is_file())


def test_every_dataset_is_valid_standalone_json():
    for name in DATA_FILES:
        json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def test_source_preserves_the_complete_content_contract():
    assert len(ARCANA) == 22
    assert len(CHAKRAS_TEXT) == 7
    assert len(POINTS) == 17
    assert len(SECTIONS_META) == 20
    assert sorted(IN_POSITIONS) == list(range(1, 23))
    expected_keys = {row["key"] for row in SECTIONS_META} | {row["key"] for row in POINTS}
    assert len(expected_keys) == 37
    assert all(set(rows) == expected_keys for rows in IN_POSITIONS.values())
    assert sum(len(rows) for rows in IN_POSITIONS.values()) == 22 * 37
    assert len(PAIRS) == 22 * 21 // 2
    assert all(1 <= a < b <= 22 for a, b in PAIRS)
    assert all(row.get("report_label") for row in POINTS)
    assert len({row["report_label"] for row in POINTS}) == len(POINTS)
    assert TEXT_POLICY["blocked"]


def test_point_interpretations_are_individual_editorial_texts():
    point_keys = [row["key"] for row in POINTS]
    titles = {row["n"]: row["title"] for row in ARCANA}
    texts = [IN_POSITIONS[number][key] for number in range(1, 23) for key in point_keys]

    assert len(texts) == len(set(texts)) == 22 * 17
    assert all("Сверять трактовку полезно" not in text for text in texts)
    assert all(
        IN_POSITIONS[number][key].startswith(f"Аркан «{titles[number]}»")
        for number in range(1, 23)
        for key in point_keys
    )

    sentences = [
        sentence
        for text in texts
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence
    ]
    assert len(sentences) == len(set(sentences))
