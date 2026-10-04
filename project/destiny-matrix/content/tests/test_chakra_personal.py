import datetime as dt
from functools import lru_cache

import pytest

from content.source import LANGS, load_json
from engine.matrix import Matrix, _chakras, calculate, fold, fold_year


def _rows(day: int, month: int, year: int):
    # calculate() rejects years before 1900 and future dates, so the chain is rebuilt from folded values.
    m = Matrix(birth=dt.date(1900, 1, 1), sex="f")
    m.day, m.month, m.year = day, month, year
    m.mission = fold(day + month + year)
    m.center = fold(day + month + year + m.mission)
    m.comfort_west, m.comfort_north = fold(day + m.center), fold(month + m.center)
    m.comfort_east, m.comfort_south = fold(year + m.center), fold(m.mission + m.center)
    return _chakras(m)[0]


@lru_cache(maxsize=None)
def _needed() -> dict[str, frozenset[str]]:
    needed: dict[str, set[str]] = {}
    years = {fold_year(year) for year in range(1, 10000)}
    for day in {fold(day) for day in range(1, 32)}:
        for month in range(1, 13):
            for year in years:
                for row in _rows(day, month, year):
                    needed.setdefault(row.key, set()).add(f"{row.physics}-{row.energy}-{row.emotions}")
    return {key: frozenset(triples) for key, triples in needed.items()}


def test_folded_chain_matches_engine():
    seen = set()
    day = dt.date(1900, 1, 1)
    while day <= dt.date.today():
        key = (fold(day.day), day.month, fold_year(day.year))
        if key not in seen:
            seen.add(key)
            assert _rows(*key) == calculate(day).chakras, day
        day += dt.timedelta(days=1)


def _filled(reading: dict) -> bool:
    captions, paragraphs = reading.get("captions", []), reading.get("paragraphs", [])
    return (bool(reading.get("heading", "").strip()) and len(captions) == 3 and len(paragraphs) == 3
            and all(text.strip() for text in captions + paragraphs))


@pytest.mark.parametrize("lang", LANGS)
def test_personal_chakra_corpus_covers_every_date_with_filled_texts(lang):
    chakras = load_json("chakra-personal.json", lang)["chakras"]
    missing, empty = [], []
    for key, triples in _needed().items():
        readings = chakras.get(key, {}).get("readings", {})
        for triple in sorted(triples):
            if triple not in readings:
                missing.append(f"{key} {triple}")
            elif not _filled(readings[triple]):
                empty.append(f"{key} {triple}")
    assert not missing and not empty, (
        f"{lang}: нет текста {len(missing)} {missing[:5]}, пустых {len(empty)} {empty[:5]}")


def test_energy_field_corpus_covers_every_date_ru():
    # Calculator years start at 1900; a year arcanum of 1 is unreachable there, so 363 triples, not 367.
    years = {fold_year(year) for year in range(1900, dt.date.today().year + 1)}
    needed = set()
    for day in {fold(day) for day in range(1, 32)}:
        for month in range(1, 13):
            for year in years:
                m = Matrix(birth=dt.date(1900, 1, 1), sex="f")
                m.day, m.month, m.year = day, month, year
                m.mission = fold(day + month + year)
                m.center = fold(day + month + year + m.mission)
                m.comfort_west, m.comfort_north = fold(day + m.center), fold(month + m.center)
                m.comfort_east, m.comfort_south = fold(year + m.center), fold(m.mission + m.center)
                totals = _chakras(m)[1]
                needed.add(f"{totals['physics']}-{totals['energy']}-{totals['emotions']}")
    readings = load_json("chakra-personal.json", "ru").get("energy_field", {}).get("readings", {})
    missing = sorted(needed - set(readings))
    empty = sorted(key for key in needed & set(readings) if not _filled(readings[key]))
    extra = sorted(set(readings) - needed)
    assert len(needed) == 363
    assert not missing and not empty and not extra, (
        f"энергополе: нет {len(missing)} {missing[:5]}, пустых {len(empty)}, лишних {extra[:5]}")
