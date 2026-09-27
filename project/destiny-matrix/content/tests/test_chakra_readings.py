"""Редакционный справочник сверяется с достижимыми числами реального расчёта."""
import datetime as dt
import json
from pathlib import Path

from content.text_policy import blocked_match
from engine.matrix import calculate


SOURCE = Path(__file__).resolve().parents[1] / "data" / "ru" / "chakras.json"
COLUMNS = ("physics", "energy", "emotions")


def test_chakra_dictionary_covers_reachable_columns_without_impossible_entries():
    articles = json.loads(SOURCE.read_text())
    reachable = {a["key"]: {col: set() for col in COLUMNS} for a in articles}
    day = dt.date(1900, 1, 1)
    while day <= dt.date.today():
        for row in calculate(day).chakras:
            for col in COLUMNS:
                reachable[row.key][col].add(getattr(row, col))
        day += dt.timedelta(days=1)

    for article in articles:
        rows = article["readings"]
        assert len({r["n"] for r in rows}) == len(rows)
        for col in COLUMNS:
            actual = {r["n"] for r in rows if col in r}
            assert actual == reachable[article["key"]][col], (article["key"], col)


def test_editorial_examples_match_birth_date_and_dictionary():
    for article in json.loads(SOURCE.read_text()):
        dictionary = {r["n"]: r for r in article["readings"]}
        for example in article["examples"]:
            row = next(r for r in calculate(example["birth"]).chakras if r.key == article["key"])
            assert example["numbers"] == [getattr(row, col) for col in COLUMNS]
            for col, number in zip(COLUMNS, example["numbers"], strict=True):
                assert col in dictionary[number]


def test_new_chakra_text_is_not_silently_filtered_on_the_site():
    def check(value):
        if isinstance(value, str):
            assert blocked_match(value, "content", "ru") is None, value
        elif isinstance(value, dict):
            for item in value.values():
                check(item)
        elif isinstance(value, list):
            for item in value:
                check(item)

    check(json.loads(SOURCE.read_text()))
