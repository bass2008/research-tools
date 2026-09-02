#!/usr/bin/env python
"""Собрать подписываемые golden-векторы и полный parity-снимок.

    PYTHONPATH=.. python scripts/make-golden.py

Источник перечня кармических хвостов — ``spec/method.json``. Большие JSON-файлы создаются
механически, но не становятся истиной сами по себе: unit-тесты проверяют ручные контрольные
значения и граф контракта до сравнения с эталоном.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import shutil
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
PROJECT = WEB.parent
SPEC = PROJECT / "spec"
sys.path.insert(0, str(PROJECT))

from engine.matrix import calculate  # noqa: E402
from engine.sections import build  # noqa: E402

METHOD_FILE = SPEC / "method.json"
GOLDEN_FILE = SPEC / "golden.json"
WEB_GOLDEN_FILE = WEB / "lib" / "__fixtures__" / "golden.json"
PARITY_FILE = SPEC / "parity-digests.json"
WEB_PARITY_FILE = WEB / "lib" / "__fixtures__" / "parity-digests.json"
WEB_METHOD_FILE = WEB / "lib" / "__fixtures__" / "method.json"
# Отдельный маленький срез для браузерного движка: он берёт из спецификации только семь
# уровней чакр, а импорт всего снимка тянул в клиентский чанк подписи и формулы всех точек
# вместе с признаком access. Webpack вырезал лишнее сам, Turbopack — нет.
WEB_CHAKRAS_FILE = WEB / "lib" / "__fixtures__" / "chakras.json"
SECTIONS_FILE = SPEC / "sections.json"
WEB_SECTIONS_FILE = WEB / "lib" / "__fixtures__" / "sections.json"


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def selected_inputs(method: dict) -> list[tuple[str, str, str]]:
    """birth, sex, reason; порядок стабилен и сам документирует покрытие."""
    rows: list[tuple[str, str, str]] = [
        (item["sample_birth"], "f", f"reachable_tail:{item['triple']}")
        for item in method["reachable_karmic_tails"]
    ]
    rows.extend((f"1993-03-{day:02d}", "m" if day % 2 else "f", f"day_reduction:{day}")
                for day in range(23, 32))
    rows.extend([
        ("1993-03-31", "f", "same_date_both_sexes"),
        ("1904-02-29", "m", "leap_day"),
        ("1996-02-29", "f", "leap_day"),
        ("2000-02-29", "m", "leap_day_and_century"),
        ("2004-02-29", "f", "leap_day"),
        ("2024-02-29", "m", "leap_day"),
        (dt.date.today().isoformat(), "f", "current_date_boundary"),
    ])
    # Одна дата может одновременно доказывать хвост и границу — сохраняем первое объяснение,
    # но обязательно добавляем второй пол контрольной даты.
    unique: dict[tuple[str, str], str] = {}
    for birth, sex, reason in rows:
        unique.setdefault((birth, sex), reason)
    return [(birth, sex, reason) for (birth, sex), reason in unique.items()]


def golden_case(birth: str, sex: str, reason: str) -> dict:
    matrix = calculate(birth, sex)
    return {
        "birth": birth,
        "sex": sex,
        "reason": reason,
        "contract": "spec/method.json",
        "review": "engineering_cross_check_pending_human_signoff",
        "matrix": matrix.to_dict(),
        "sections_locked": build(matrix, unlocked=False),
        "sections_unlocked": build(matrix, unlocked=True),
    }


def parity_digests() -> dict:
    today = dt.date.today()
    years: dict[str, dict] = {}
    overall = hashlib.sha256()
    total = 0
    for year in range(1900, today.year + 1):
        end = today if year == today.year else dt.date(year, 12, 31)
        cursor = dt.date(year, 1, 1)
        digest = hashlib.sha256()
        count = 0
        while cursor <= end:
            for sex in ("f", "m"):
                row = canonical(calculate(cursor, sex).to_dict()) + b"\n"
                digest.update(row)
                overall.update(row)
                count += 1
                total += 1
            cursor += dt.timedelta(days=1)
        years[str(year)] = {"cases": count, "sha256": digest.hexdigest()}
    return {
        "from": "1900-01-01",
        "through": today.isoformat(),
        "sex_order": ["f", "m"],
        "serialization": "UTF-8 JSON sorted recursively, compact separators, LF after each case",
        "cases": total,
        "sha256": overall.hexdigest(),
        "years": years,
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    method = json.loads(METHOD_FILE.read_text())
    cases = [golden_case(*row) for row in selected_inputs(method)]
    write_json(GOLDEN_FILE, cases)
    shutil.copyfile(GOLDEN_FILE, WEB_GOLDEN_FILE)

    digests = parity_digests()
    write_json(PARITY_FILE, digests)
    shutil.copyfile(PARITY_FILE, WEB_PARITY_FILE)
    shutil.copyfile(METHOD_FILE, WEB_METHOD_FILE)
    write_json(WEB_CHAKRAS_FILE, json.loads(METHOD_FILE.read_text("utf-8"))["chakras"])
    shutil.copyfile(SECTIONS_FILE, WEB_SECTIONS_FILE)

    free = sum(1 for section in cases[0]["sections_locked"] if section["access"] == "free")
    print(
        f"golden: {len(cases)} случаев, {len(cases[0]['sections_locked'])} разделов, "
        f"бесплатных {free}; parity: {digests['cases']} расчёта до {digests['through']}"
    )


if __name__ == "__main__":
    main()
