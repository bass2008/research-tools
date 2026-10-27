#!/usr/bin/env python3
import argparse
import json
import re
import statistics
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "tools/seo/content"
MAX_OVERLAP, MIN_OWN = 0.11, 0.80


def flat(value, out: list[str]) -> None:
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, list):
        for item in value:
            flat(item, out)
    elif isinstance(value, dict):
        for item in value.values():
            flat(item, out)


def shingles(item: dict, n: int = 5) -> set[tuple]:
    out: list[str] = []
    flat({k: item.get(k) for k in ("intro", "sections", "faq")}, out)
    words = re.findall(r"[а-яёa-z0-9]+", " ".join(out).lower())
    return {tuple(words[i:i + n]) for i in range(len(words) - n + 1)}


def load(lang: str, category: str) -> dict[str, set[tuple]]:
    return {p.stem: shingles(json.loads(p.read_text())) for p in sorted((CONTENT / lang / category).glob("*.json"))}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--show", type=int, default=5, help="сколько совпавших фрагментов печатать у статьи вне порога")
    args = parser.parse_args()
    pair = {f"пара {k}": v for k, v in load(args.lang, "compatibility-karmic-tails").items()}
    personal = {f"личная {k}": v for k, v in load(args.lang, "karmic-tails").items()}
    corpus = {**pair, **personal}
    counts = Counter(s for v in corpus.values() for s in v)
    rows, bad = [], 0
    for name, own in pair.items():
        best, other = max(((len(own & v) / max(1, min(len(own), len(v))), k) for k, v in corpus.items() if k != name),
                          default=(0.0, "—"))
        unique = sum(1 for s in own if counts[s] == 1) / max(1, len(own))
        fail = best > MAX_OVERLAP or unique < MIN_OWN
        bad += fail
        rows.append((name, best, other, unique, fail))
    for name, best, other, unique, fail in sorted(rows, key=lambda r: -r[1]):
        print(f"{'✗' if fail else '✓'} {name}: совпадение {best:.1%} с «{other}», своего {unique:.0%}")
        if fail and args.show:
            common = [" ".join(s) for s in pair[name] & corpus[other]][: args.show]
            for frag in common:
                print(f"    … {frag}")
    if rows:
        print(f"\n{len(rows)} статей пары; совпадение медиана {statistics.median(r[1] for r in rows):.1%}, "
              f"максимум {max(r[1] for r in rows):.1%}; своего медиана {statistics.median(r[3] for r in rows):.0%}, "
              f"минимум {min(r[3] for r in rows):.0%}; вне порога {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
