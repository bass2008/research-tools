#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PERSONAL = ROOT / "tools/seo/content/ru/karmic-tails"
CSV = ROOT / "project/destiny-matrix/reports/seo-product-coverage-2026-10-26-1657/pair-tails-97.csv"
SEMCORE = ROOT / "semcore.db"
OUT = ROOT / "tools/seo/karmic-tails/pair-tails.json"
PAIR_WORDS = re.compile(r"совмест|пар[аыеу]?\b|партн")


def phrases(db, key: str, personal: bool) -> list[list]:
    spaced = key.replace("-", " ")
    rows = db.execute("select phrase, freq from node where freq is not null and phrase like ? order by freq desc",
                      (f"%{spaced}%",)).fetchall()
    exact = re.compile(rf"(?<!\d){re.escape(spaced)}(?!\d)")
    out = [[p, f] for p, f in rows if exact.search(p) and not re.search(r"(19|20)\d\d", p)]
    return [x for x in out if PAIR_WORDS.search(x[0])] if personal else out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("facts", type=Path, help="вывод web/scripts/pair-tail-facts.ts")
    args = parser.parse_args()
    facts = json.loads(args.facts.read_text())
    personal = {p.stem for p in PERSONAL.glob("*.json")}
    freq = {r["triple"]: int(r["frequency_30d"]) for r in csv.DictReader(CSV.open(encoding="utf-8"))}
    db = sqlite3.connect(f"file:{SEMCORE}?mode=ro", uri=True)
    tails = {}
    for key, f in facts["tails"].items():
        spaced = key.replace("-", " ")
        primary = f"кармический хвост совместимость {spaced}"
        tails[key] = {
            "personal": key in personal,
            "primary_query": primary,
            "frequency_30d": freq.get(key),
            "phrases": phrases(db, key, key in personal)[:4],
            "en_primary_query": f"karmic tail {spaced} compatibility",
            **f,
        }
    order = sorted(tails, key=lambda k: -(tails[k]["frequency_30d"] or 0))
    OUT.write_text(json.dumps({"source": {"wordstat": "XMLRiver New, Россия, 08.09–07.10.2026, маска «кармический хвост совместимость [A B C]»",
                                          "facts": "web/scripts/pair-tail-facts.ts, все даты 1900–26.10.2026"},
                               "personal_centers": facts["personal_centers"],
                               "tails": {k: tails[k] for k in order}}, ensure_ascii=False, indent=1) + "\n")
    print(f"{OUT}: {len(tails)} хвостов, личных {sum(t['personal'] for t in tails.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
