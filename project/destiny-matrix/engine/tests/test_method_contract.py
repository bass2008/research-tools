"""Контракт метода — отдельный сторож над двумя исполняемыми реализациями."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

from engine.matrix import calculate, fold
from engine.sections import build

ROOT = Path(__file__).resolve().parents[2]
METHOD = json.loads((ROOT / "spec" / "method.json").read_text())
GOLDEN = json.loads((ROOT / "spec" / "golden.json").read_text())
PARITY = json.loads((ROOT / "spec" / "parity-digests.json").read_text())
# Снимок датируется днём сборки, а проверка на точное равенство краснела каждую полночь.
PARITY_GRACE_DAYS = 31


def _canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def test_reduction_contract_examples():
    assert {int(raw): fold(int(raw)) for raw in METHOD["reduction"]["examples"]} == {
        int(raw): expected for raw, expected in METHOD["reduction"]["examples"].items()
    }


def test_browser_contract_fixtures_are_exact_copies():
    """Docker web-context не видит ../spec, поэтому копии обязательны, но расходиться не могут."""
    fixture = ROOT / "web" / "lib" / "__fixtures__"
    for name in ("method.json", "sections.json", "golden.json", "parity-digests.json"):
        assert (ROOT / "spec" / name).read_bytes() == (fixture / name).read_bytes(), name


def test_point_graph_is_unique_acyclic_and_resolved():
    points = METHOD["points"]
    symbols = [point["symbol"] for point in points]
    assert len(symbols) == len(set(symbols))
    assert len([point["key"] for point in points]) == len(set(point["key"] for point in points))
    known: set[str] = set()
    for point in points:
        assert set(point["depends_on"]) <= known, f"{point['symbol']} зависит от будущей точки"
        known.add(point["symbol"])
    assert {"A", "B", "C", "D", "E", "M", "N", "R", "R1", "R2"} <= known


def test_all_26_declared_tails_have_real_witness_and_order():
    declared = METHOD["reachable_karmic_tails"]
    assert len(declared) == 26
    assert len({item["triple"] for item in declared}) == 26
    for item in declared:
        actual = "-".join(map(str, calculate(item["sample_birth"]).karmic_tail))
        assert actual == item["triple"], item


def test_declared_tail_set_is_exhaustive_for_supported_dates():
    expected = {item["triple"] for item in METHOD["reachable_karmic_tails"]}
    seen: set[str] = set()
    cursor = dt.date.fromisoformat(METHOD["scope"]["minimum_birth_date"])
    while cursor <= dt.date.today():
        seen.add("-".join(map(str, calculate(cursor).karmic_tail)))
        cursor += dt.timedelta(days=1)
    assert seen == expected


def test_golden_coverage_and_every_named_value():
    assert len(GOLDEN) >= 30
    assert {int(case["birth"][-2:]) for case in GOLDEN} >= set(range(23, 32))
    assert any(case["birth"] == "1900-01-01" for case in GOLDEN)
    assert sum(case["birth"].endswith("-02-29") for case in GOLDEN) >= 5
    control = [case for case in GOLDEN if case["birth"] == "1993-03-31"]
    assert {case["sex"] for case in control} == {"f", "m"}
    for case in GOLDEN:
        matrix = calculate(case["birth"], case["sex"])
        assert matrix.to_dict() == case["matrix"], (case["birth"], case["sex"])
        assert build(matrix, unlocked=False) == case["sections_locked"]
        assert build(matrix, unlocked=True) == case["sections_unlocked"]
        assert all(1 <= value <= 22 for value in matrix.values())


def test_control_date_and_sex_contract():
    female = calculate("1993-03-31", "f")
    male = calculate("1993-03-31", "m")
    assert female.karmic_tail == [15, 8, 11]
    assert female.money == [8, 13, 5]
    assert female.love == [15, 20, 5]
    assert female.talent == [3, 10, 7]
    female.sex = male.sex
    assert female.to_dict() == male.to_dict()


def test_python_full_range_matches_locked_parity_snapshot():
    through = dt.date.fromisoformat(PARITY["through"])
    today = dt.date.today()
    assert through <= today, f"снимок датирован будущим ({through}) — пересоберите npm run golden"
    assert (today - through).days <= PARITY_GRACE_DAYS, (
        f"снимок покрывает даты до {through}, сегодня {today} — пересоберите npm run golden"
    )
    overall = hashlib.sha256()
    total = 0
    for year, expected in PARITY["years"].items():
        year_number = int(year)
        end = through if year_number == through.year else dt.date(year_number, 12, 31)
        cursor = dt.date(year_number, 1, 1)
        digest = hashlib.sha256()
        count = 0
        while cursor <= end:
            for sex in PARITY["sex_order"]:
                row = _canonical(calculate(cursor, sex).to_dict()) + b"\n"
                digest.update(row)
                overall.update(row)
                count += 1
                total += 1
            cursor += dt.timedelta(days=1)
        assert count == expected["cases"]
        assert digest.hexdigest() == expected["sha256"], f"первое расхождение находится в {year}"
    assert total == PARITY["cases"]
    assert overall.hexdigest() == PARITY["sha256"]
