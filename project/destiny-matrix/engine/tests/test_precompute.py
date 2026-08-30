"""Тесты предвычисления: все матрицы должны быть достижимы и уникальны."""
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from engine.matrix import calculate, fold, fold_year  # noqa: E402
from engine.precompute import all_keys, sample_date, slug  # noqa: E402
from engine.sections import SPEC, build  # noqa: E402

KEYS = all_keys()


def test_count_matches_theoretical_maximum():
    """22 дня x 12 месяцев x 21 год: свёрнутый год не бывает единицей на 1900-2025."""
    assert len(KEYS) == 22 * 12 * 21 == 5544


def test_keys_unique_and_sorted():
    assert len(set(KEYS)) == len(KEYS)
    assert KEYS == sorted(KEYS)


def test_every_key_reachable_by_real_date():
    for key in KEYS[::137]:
        d = sample_date(key)
        assert (fold(d.day), fold(d.month), fold_year(d.year)) == key


def test_slug_roundtrip():
    for key in KEYS[:5]:
        assert tuple(int(x) for x in slug(key).split("-")) == key


def test_matrices_are_distinct_per_key():
    """Разные тройки обязаны давать разные матрицы, иначе страницы дублируют друг друга."""
    sample = KEYS[::311]
    seen = {tuple(calculate(sample_date(k)).values()) for k in sample}
    assert len(seen) == len(sample)


def test_content_units_cover_all_matrices():
    """700 текстов покрывают 5544 матрицы: сколько бы ни было матриц, позиций конечное число."""
    positions = len(SPEC) * 22          # раздел x аркан
    pairs = 22 * 21 // 2               # сочетания
    assert positions + pairs + 22 + 7 == 700
    m = calculate(sample_date(KEYS[0]))
    keys_in_report = {s["key"] for s in build(m, unlocked=True)}
    assert keys_in_report == {k for k, *_ in SPEC}


def test_leap_day_maps_into_keys():
    d = dt.date(2000, 2, 29)
    assert (fold(d.day), fold(d.month), fold_year(d.year)) in set(KEYS)


def test_checked_in_artifact_contains_exactly_the_new_engine_results():
    artifact = Path(__file__).resolve().parents[2] / "web" / "content" / "matrices.json"
    payload = json.loads(artifact.read_text())
    assert payload["count"] == len(payload["items"]) == 5544
    assert {item["slug"] for item in payload["items"]} == {slug(key) for key in KEYS}
    for item in payload["items"]:
        matrix = calculate(item["matrix"]["birth"], item["matrix"]["sex"])
        assert matrix.to_dict() == item["matrix"], item["slug"]
        assert item["slug"] == slug((matrix.day, matrix.month, matrix.year))
