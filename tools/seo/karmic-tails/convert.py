#!/usr/bin/env python3
import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = Path("/home/sergey/Personal")
NAME = {"ru": "example-{key}-opus.md", "en": "example-{key}-opus-en.md"}
SHORT = {"ru": "example-{key}-short.md", "en": "example-{key}-short-en.md"}
UNIT = {"ru": "example-{key}-unit.json", "en": "example-{key}-unit-en.json"}
OUT = ROOT / "tools/seo/content/{lang}/karmic-tails/{key}.json"
PAIR_OUT = ROOT / "tools/seo/content/{lang}/compatibility-karmic-tails/{key}.json"
PAIR_REGISTRY = HERE / "pair-tails.json"
METHOD = ROOT / "project/destiny-matrix/spec/method.json"

POINT_HEAD = {"ru": ["Точка", "Аркан", "Как получается"], "en": ["Point", "Arcanum", "How it is derived"]}
POINT = re.compile(r"^([A-ZА-Я])\s*·\s*(.+?)\s*·{2,}\s*(\d+)\s+(.+?)(?:\s{2,}(\S.*))?$")
FIXES = {
    "ru": {"18-9-9": {"\nСложите три числа.\n": "\nТеперь сложите три числа.\n"}},
    "en": {},
}


def pair_base(key: str, lang: str) -> dict:
    tail = json.loads(PAIR_REGISTRY.read_text())["tails"][key]
    primary = tail["primary_query"] if lang == "ru" else tail["en_primary_query"]
    queries = [primary] + ([p for p, _ in tail["phrases"]] if lang == "ru" else [])
    publication = {"index": True, "follow": True, "primary_query": primary}
    if lang == "ru" and tail.get("frequency_30d"):
        publication["exact_frequency"] = tail["frequency_30d"]
    return {"key": key, "entity_type": "pair_karmic_tail", "publication": publication,
            "arcana": [int(n) for n in key.split("-")], "seo": {"queries": queries}, "related": []}


def load_converter():
    spec = importlib.util.spec_from_file_location("md_to_content", ROOT / "tools/seo/md-to-content.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def diagrams_to_tables(lines: list[str], lang: str) -> tuple[list[str], int]:
    out: list[str] = []
    found = 0
    i = 0
    while i < len(lines):
        if not lines[i].strip().startswith("```"):
            out.append(lines[i])
            i += 1
            continue
        end = next((j for j in range(i + 1, len(lines)) if lines[j].strip().startswith("```")), len(lines))
        body = [line.strip() for line in lines[i + 1:end] if line.strip() and line.strip() != "│"]
        rows = [POINT.match(line) for line in body]
        if body and all(rows):
            found += 1
            out += ["", "| " + " | ".join(POINT_HEAD[lang]) + " |", "|---|---|---|"]
            out += [f"| {m.group(1)} · {m.group(2)} | {m.group(3)} · {m.group(4).strip()} | "
                    f"{(m.group(5) or '').lstrip('← ')} |" for m in rows]
            out.append("")
        else:
            out += lines[i:end + 1]
        i = end + 1
    return out, found


def lift_nested_tables(lines: list[str]) -> tuple[list[str], int]:
    # The converter glues indented lines into the list item, so a table inside a list would become text.
    out: list[str] = []
    found = 0
    for i, line in enumerate(lines):
        nested = line[:1].isspace() and line.lstrip().startswith("|")
        if nested and not (out and out[-1].lstrip().startswith("|")):
            found += 1
            if out and out[-1].strip():
                out.append("")
        out.append(line.lstrip() if nested else line)
        following = lines[i + 1] if i + 1 < len(lines) else ""
        if nested and following.strip() and not following.lstrip().startswith("|"):
            out.append("")
    return out, found


def faq_tables_to_sections(lines: list[str], faq_titles: tuple[str, ...]) -> tuple[list[str], int]:
    # The FAQ answer is plain text on the site, so a question answered with a table becomes a chapter.
    start = next((i for i, line in enumerate(lines)
                  if line.startswith("## ") and line[3:].strip().lower().startswith(faq_titles)), None)
    if start is None:
        return lines, 0
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    heads = [i for i in range(start + 1, end) if lines[i].startswith("### ")]
    moved: list[str] = []
    keep = lines[start:heads[0]] if heads else lines[start:end]
    for n, h in enumerate(heads):
        block = lines[h:heads[n + 1] if n + 1 < len(heads) else end]
        if any(line.lstrip().startswith("|") for line in block[1:]):
            moved += ["## " + block[0][4:].strip(), *block[1:], ""]
        else:
            keep += block
    count = sum(1 for line in moved if line.startswith("## "))
    return lines[:start] + moved + keep + lines[end:], count


def prepare(text: str, key: str, lang: str, faq_titles: tuple[str, ...]) -> tuple[str, list[str]]:
    notes = []
    for old, new in FIXES[lang].get(key, {}).items():
        if old not in text:
            raise SystemExit(f"{key}: не найдено для правки: {old.strip()}")
        text = text.replace(old, new)
    text = re.sub(r"^seo_title:", "title:", text, count=1, flags=re.M)
    lines, tables = diagrams_to_tables(text.splitlines(), lang)
    if tables:
        notes.append(f"схема точек → таблица: {tables}")
    lines, nested = lift_nested_tables(lines)
    if nested:
        notes.append(f"таблица из пункта списка вынесена отдельным блоком: {nested}")
    lines, moved = faq_tables_to_sections(lines, faq_titles)
    if moved:
        notes.append(f"вопрос с таблицей вынесен из FAQ в главу: {moved}")
    return "\n".join(lines) + "\n", notes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("keys", nargs="*")
    parser.add_argument("--lang", default="ru", choices=sorted(NAME))
    parser.add_argument("--check", action="store_true", help="только проверить, ничего не записывать")
    parser.add_argument("--pair", action="store_true", help="хвост пары: example-pair-*, compatibility-karmic-tails")
    args = parser.parse_args()

    m2c = load_converter()
    if args.pair:
        keys = args.keys or list(json.loads(PAIR_REGISTRY.read_text())["tails"])
    else:
        keys = args.keys or [t["triple"] for t in json.loads(METHOD.read_text())["reachable_karmic_tails"]]
    failed = 0
    for key in keys:
        stem = f"pair-{key}" if args.pair else key
        source = SRC / NAME[args.lang].format(key=stem)
        out = Path(str(PAIR_OUT if args.pair else OUT).format(lang=args.lang, key=key))
        if not source.exists():
            print(f"✗ {key}: нет {source}")
            failed += 1
            continue
        if out.exists():
            base = json.loads(out.read_text(encoding="utf-8"))
        elif args.pair:
            base = pair_base(key, args.lang)
        else:
            print(f"✗ {key}: нет {out}")
            failed += 1
            continue
        text, notes = prepare(source.read_text(encoding="utf-8"), key, args.lang, m2c.FAQ_TITLES)
        rep = m2c.Report()
        item = m2c.convert(text, base, rep, keep_intro=True)
        if not item["intro"]:
            del item["intro"]
        short = SRC / SHORT[args.lang].format(key=stem)
        if short.exists():
            item["report"] = [m2c.block(kind, value, rep) for kind, value in
                              m2c.tokens(short.read_text(encoding="utf-8").splitlines(), rep)]
        unit = SRC / UNIT[args.lang].format(key=stem)
        if args.pair and unit.exists():
            item["unit"] = json.loads(unit.read_text(encoding="utf-8"))
        problems, warnings = m2c.check(item, "compatibility-karmic-tails" if args.pair else "karmic-tails", args.lang)
        blocks = [p for s in item["sections"] for p in s["paragraphs"] if not isinstance(p, str)]
        tables = sum(1 for p in blocks if "table" in p)
        print(f"{'✗' if problems else '✓'} {key}: глав {len(item['sections'])}, таблиц {tables}, "
              f"вопросов {len(item.get('faq', []))}, предупреждений {len(warnings)}")
        for note in notes + [n for n in rep.notes if "перенесены в начало раздела" not in n]:
            print(f"    ~ {note}")
        for problem in problems:
            print(f"    ✗ {problem}")
        if problems:
            failed += 1
            continue
        if not args.check:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(keys) - failed} из {len(keys)} {'проверены' if args.check else 'записаны'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
