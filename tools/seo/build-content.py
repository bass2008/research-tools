#!/usr/bin/env python3
"""Сборка статей в источники данных сайта.

Авторы сдают по файлу на статью в `tools/seo/content/<lang>/<категория>/<ключ>.json`; сайт читает
по файлу на категорию в `web/content/<lang>/<категория>.json`. Этот скрипт переносит первое во
второе и проверяет то, что иначе выяснится молча: страница просто не появится, а причину
придётся искать глазами.

    python tools/seo/build-content.py                 # русский: проверить и собрать
    python tools/seo/build-content.py --lang en       # английский
    python tools/seo/build-content.py --check         # только проверить

Две категории не заводят новых страниц, а обогащают существующие (`arcana`, `positions`): их
статьи вливаются в готовый корпус пополю — приходят `meaning`, `seo`, `article_sections` и `faq`, всё остальное
(`short`, `keywords`, `plus`, `minus`, `in_positions`, `points`) остаётся на месте.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "project/destiny-matrix"))
from content.text_policy import blocked_match  # noqa: E402
SRC_ROOT = ROOT / "tools/seo/content"
DST_ROOT = ROOT / "project/destiny-matrix/web/content"
METHOD = ROOT / "project/destiny-matrix/spec/method.json"
DEFAULT_LANG = "ru"

BRAND = len(" — Arcana Sense")
TITLE_LIMIT = 70

# Минимумы повторяют загрузчик сайта (web/lib/content.ts): что не проходит здесь, не попадёт на
# страницу и там — только там об этом узнают после сборки.
ARTICLE = ("karmic-tails", "year-arcana", "category-hubs", "hubs")
ENRICH = {"arcana": ("arcana.json", "n"), "positions": ("positions.json", "key"),
          "chakras": ("chakras.json", "key")}
CHAKRA_ARTICLE = ("title", "short", "seo", "intro", "sections", "faq")
KEY_FIELD = {"year-arcana": "n"}


def fail(problems: list[str], where: str, text: str) -> None:
    problems.append(f"{where}: {text}")


def hygiene(value: object, where: str, path: str, warnings: list[str], lang: str) -> None:
    if isinstance(value, str):
        found = blocked_match(value, "content", lang)
        if found:
            warnings.append(f"{where}: {path} — «{found.matched}» ({found.category})")
    elif isinstance(value, list):
        for i, item in enumerate(value):
            hygiene(item, where, f"{path}[{i}]", warnings, lang)
    elif isinstance(value, dict):
        for key, item in value.items():
            hygiene(item, where, f"{path}.{key}" if path else key, warnings, lang)


def check_seo(seo: object, where: str, problems: list[str]) -> None:
    if not isinstance(seo, dict):
        return fail(problems, where, "нет объекта seo")
    title = str(seo.get("title") or "")
    description = str(seo.get("description") or "")
    if len(title) < 10:
        fail(problems, where, "seo.title короче 10 знаков")
    if len(title) > TITLE_LIMIT:
        fail(problems, where, f"seo.title {len(title)} знаков — предел {TITLE_LIMIT} (B1)")
    elif len(title) + BRAND > TITLE_LIMIT:
        # не ошибка: шаблон снимет бренд, но автору полезно знать, что так вышло
        print(f"  ~ {where}: seo.title {len(title)} — в выдаче будет без « — Arcana Sense»")
    if len(description) < 60:
        fail(problems, where, f"seo.description {len(description)} знаков, нужно от 60")



# Описание длиннее 165 знаков выдача обрезает сама, посреди фразы. Подрезаем по границе мысли:
# у девяти хвостов доходило до 267 знаков.
DESC_LIMIT = 165


def trim_description(item: dict, where: str) -> None:
    seo = item.get("seo")
    if not isinstance(seo, dict):
        return
    text = " ".join(str(seo.get("description") or "").split())
    if len(text) <= DESC_LIMIT:
        return
    head = text[: DESC_LIMIT + 1]
    cut = None
    for sep in (". ", "! ", "? "):
        # The site drops an article whose description is under 60 characters.
        if head.rfind(sep) + 1 >= 60:
            cut = head[: head.rfind(sep) + 1].strip()
            break
    if cut is None:
        for sep in (", ", "; ", " — "):
            idx = head.rfind(sep)
            if idx > DESC_LIMIT * 0.5:
                cut = head[:idx].rstrip(" ,;:—-") + "."
                break
    if cut is None:
        cut = head.rsplit(" ", 1)[0].rstrip(" ,;:—-") + "."
    seo["description"] = cut
    print(f"  ~ {where}: описание подрезано с {len(text)} до {len(cut)} знаков")

BLOCKS = ("h3", "ul", "ol", "table", "slot", "chakra_reading")
SLOTS = ("calc",)
# chakra -> triples of the paid-report corpus (chakra-personal.json); filled in main()
CHAKRA_READINGS: dict[str, set[str]] = {}


def check_marks(text: str, where: str, path: str, problems: list[str], rich: bool) -> None:
    if not rich:
        if "*" in text:
            fail(problems, where, f"{path}: здесь выводится голый текст, звёздочки останутся на странице")
        return
    # The site renders only `**bold**`; any other asterisk would be printed as is.
    if "*" in re.sub(r"\*\*[^*]+\*\*", "", text):
        fail(problems, where, f"{path}: непарные ** или одиночная * — на странице останутся звёздочки")


def strings_ok(value: object, allow_empty: bool) -> bool:
    return (isinstance(value, list) and bool(value)
            and all(isinstance(x, str) and (allow_empty or x.strip()) for x in value))


def check_chakra_reading(value: object, where: str, at: str, problems: list[str]) -> None:
    chakra = value.get("chakra") if isinstance(value, dict) else None
    triple = value.get("triple") if isinstance(value, dict) else None
    if (not isinstance(chakra, str) or not isinstance(triple, str) or set(value) - {"chakra", "triple", "note"}
            or triple not in CHAKRA_READINGS.get(chakra, ())):
        fail(problems, where, f"{at}: chakra_reading — chakra и triple из chakra-personal.json, плюс необязательный note")
        return
    note = value.get("note")
    if note is None:
        return
    if not isinstance(note, str) or not note.strip():
        fail(problems, where, f"{at}: chakra_reading.note — непустая строка")
    else:
        check_marks(note, where, f"{at}.note", problems, rich=True)


def check_reading_anchors(item: dict, where: str, problems: list[str]) -> None:
    paragraphs = [*(item.get("intro") or []), *(p for s in item.get("sections") or [] if isinstance(s, dict)
                                                for p in s.get("paragraphs") or [])]
    triples = [p["chakra_reading"].get("triple") for p in paragraphs
               if isinstance(p, dict) and isinstance(p.get("chakra_reading"), dict)]
    for triple in sorted({t for t in triples if triples.count(t) > 1}, key=str):
        fail(problems, where, f"chakra_reading {triple}: тройка повторяется — у блоков совпадут якоря")


def check_paragraphs(paragraphs: list, where: str, path: str, problems: list[str]) -> None:
    for i, p in enumerate(paragraphs):
        at = f"{path}[{i}]"
        if isinstance(p, str):
            if len(p.strip()) <= 20:
                fail(problems, where, f"{at}: абзац короче 21 знака — сайт упадёт на загрузке")
            check_marks(p, where, at, problems, rich=True)
            continue
        if not isinstance(p, dict) or len(p) != 1 or next(iter(p)) not in BLOCKS:
            fail(problems, where, f"{at}: блок — ровно один ключ из {', '.join(BLOCKS)}")
            continue
        kind, value = next(iter(p.items()))
        if kind == "slot":
            if value not in SLOTS:
                fail(problems, where, f"{at}: slot — одно из {', '.join(SLOTS)}")
        elif kind == "h3":
            if not isinstance(value, str) or not value.strip():
                fail(problems, where, f"{at}: пустой h3")
            else:
                check_marks(value, where, at, problems, rich=False)
        elif kind == "chakra_reading":
            check_chakra_reading(value, where, at, problems)
        elif kind in ("ul", "ol"):
            if not strings_ok(value, allow_empty=False):
                fail(problems, where, f"{at}: {kind} — непустой список непустых строк")
            else:
                for j, text in enumerate(value):
                    check_marks(text, where, f"{at}.{kind}[{j}]", problems, rich=True)
        else:
            head = value.get("head") if isinstance(value, dict) else None
            rows = value.get("rows") if isinstance(value, dict) else None
            if (not strings_ok(head, allow_empty=True) or not isinstance(rows, list) or not rows
                    or any(not strings_ok(row, allow_empty=True) or len(row) != len(head) for row in rows)):
                fail(problems, where, f"{at}: table — head и rows из строк одной ширины")
                continue
            for j, cell in enumerate(head):
                check_marks(cell, where, f"{at}.head[{j}]", problems, rich=False)
            for r, row in enumerate(rows):
                for c, cell in enumerate(row):
                    check_marks(cell, where, f"{at}.rows[{r}][{c}]", problems, rich=True)


def check_article(item: dict, where: str, problems: list[str]) -> None:
    if not str(item.get("title") or "").strip():
        fail(problems, where, "нет title")
    if len(str(item.get("short") or "")) < 60:
        fail(problems, where, "short короче 60 знаков — страница будет без первого экрана")
    for field in ("title", "short"):
        check_marks(str(item.get(field) or ""), where, field, problems, rich=False)
    seo = item.get("seo") if isinstance(item.get("seo"), dict) else {}
    for field in ("title", "description"):
        check_marks(str(seo.get(field) or ""), where, f"seo.{field}", problems, rich=False)
    sections = item.get("sections")
    if not isinstance(sections, list) or not sections:
        fail(problems, where, "нет sections — статья отбрасывается целиком")
    else:
        for i, s in enumerate(sections):
            if not isinstance(s, dict) or not isinstance(s.get("h2"), str) or not s["h2"].strip() \
                    or not isinstance(s.get("paragraphs"), list) \
                    or not s["paragraphs"]:
                fail(problems, where, f"sections[{i}] без h2 или без paragraphs")
                continue
            check_marks(str(s["h2"]), where, f"sections[{i}].h2", problems, rich=False)
            check_paragraphs(s["paragraphs"], where, f"sections[{i}].paragraphs", problems)
    faq = item.get("faq")
    if faq is not None and not isinstance(faq, list):
        fail(problems, where, "faq должен быть массивом (или отсутствовать: он опционален)")
        faq = []
    for i, qa in enumerate(faq or []):
        if (not isinstance(qa, dict) or not isinstance(qa.get("q"), str)
                or not isinstance(qa.get("a"), str) or len(qa["q"].strip()) < 9
                or len(qa["a"].strip()) < 41):
            fail(problems, where, f"faq[{i}]: вопрос от 9 знаков, ответ от 41 — иначе сайт упадёт на загрузке")
            continue
        check_marks(str(qa["q"]), where, f"faq[{i}].q", problems, rich=False)
        check_marks(str(qa["a"]), where, f"faq[{i}].a", problems, rich=True)
    intro = item.get("intro")
    if intro is not None:
        if not isinstance(intro, list):
            fail(problems, where, "intro должен быть списком абзацев и блоков")
        else:
            check_paragraphs(intro, where, "intro", problems)
    check_reading_anchors(item, where, problems)
    check_seo(item.get("seo"), where, problems)


def check_tail(item: dict, where: str, allowed: set[str], problems: list[str]) -> None:
    key = str(item.get("key") or "")
    report = item.get("report")
    if report is not None:
        if not isinstance(report, list) or not report:
            fail(problems, where, "report — непустой список абзацев")
        else:
            check_paragraphs(report, where, "report", problems)
            if any(isinstance(p, dict) and next(iter(p)) not in ("h3", "ul", "ol") for p in report):
                fail(problems, where, "report: только абзацы, h3 и списки")
    if key not in allowed:
        fail(problems, where, f"{key!r} не входит в ordered-реестр метода")
    expected = [int(part) for part in key.split("-")] if re.fullmatch(r"\d+-\d+-\d+", key) else []
    if item.get("arcana") != expected:
        fail(problems, where, f"arcana {item.get('arcana')!r} не совпадает с порядком ключа {expected}")
    if item.get("entity_type") != "karmic_tail":
        fail(problems, where, "entity_type должен быть karmic_tail")
    publication = item.get("publication")
    if not isinstance(publication, dict) or not isinstance(publication.get("index"), bool):
        fail(problems, where, "нет явного publication.index")
    elif publication["index"]:
        query = str(publication.get("primary_query") or "").strip().lower()
        if not query:
            fail(problems, where, "индексируемой странице нужен primary_query")
        elif query not in {str(q).strip().lower() for q in item.get("seo", {}).get("queries", [])}:
            fail(problems, where, "primary_query отсутствует в seo.queries")
    elif item.get("seo", {}).get("queries"):
        fail(problems, where, "noindex-хвост не должен публиковать SEO queries")


def check_enrichment(item: dict, where: str, base_keys: set, key: str, problems: list[str]) -> None:
    if key not in base_keys:
        fail(problems, where, f"ключа {key!r} нет в корпусе — обогащать нечего")
    meaning = item.get("meaning")
    least = 3 if where.startswith("arcana") else 2
    if not isinstance(meaning, list) or len([p for p in meaning if isinstance(p, str) and len(p) > 20]) < least:
        fail(problems, where, f"meaning: нужно минимум {least} абзаца длиннее 20 знаков")
    if "article_sections" in item:
        sections = item["article_sections"]
        if not isinstance(sections, list) or not sections:
            fail(problems, where, "article_sections должен быть непустым списком")
        elif any(
            not isinstance(section, dict)
            or not isinstance(section.get("h2"), str)
            or len(section["h2"].strip()) < 10
            or not isinstance(section.get("paragraphs"), list)
            or not section["paragraphs"]
            for section in sections
        ):
            fail(problems, where, "article_sections: у каждой главы нужны h2 и абзацы")
        elif where.startswith("arcana") and any(not isinstance(p, str) for section in sections
                                                for p in section["paragraphs"]):
            fail(problems, where, "article_sections: у арканов блоки h3/ul/ol/table не поддерживаются")
        else:
            for i, section in enumerate(sections):
                check_marks(section["h2"], where, f"article_sections[{i}].h2", problems, rich=False)
                check_paragraphs(section["paragraphs"], where, f"article_sections[{i}].paragraphs", problems)
    if "faq" in item:
        faq = item["faq"]
        if not isinstance(faq, list) or not faq:
            fail(problems, where, "faq должен быть непустым списком")
        elif any(
            not isinstance(entry, dict)
            or not isinstance(entry.get("q"), str)
            or not isinstance(entry.get("a"), str)
            or len(entry["q"].strip()) < 9
            or len(entry["a"].strip()) < 41
            for entry in faq
        ):
            fail(problems, where, "faq: у каждого пункта нужны содержательные q и a")
    if "h1" in item:
        if not isinstance(item["h1"], str) or len(item["h1"].strip()) < 10:
            fail(problems, where, "h1: строка от 10 знаков")
        else:
            check_marks(item["h1"], where, "h1", problems, rich=False)
    check_seo(item.get("seo"), where, problems)


def check_chakra_article(item: dict, where: str, base_keys: set, key: str, problems: list[str]) -> None:
    if key not in base_keys:
        fail(problems, where, f"чакры {key!r} нет в корпусе — обогащать нечего")
    check_article(item, where, problems)


def load(path: Path, problems: list[str]) -> dict | None:
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(problems, path.name, f"не разбирается как JSON — {exc}")
        return None


def base_items(dst: Path, name: str) -> list[dict]:
    raw = json.loads((dst / name).read_text())
    return raw.get("items", raw) if isinstance(raw, dict) else raw


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="только проверить, ничего не писать")
    parser.add_argument("--lang", default=DEFAULT_LANG, help="язык корпуса (ru, en)")
    args = parser.parse_args()

    src = SRC_ROOT / args.lang
    dst = DST_ROOT / args.lang
    corpus = json.loads((dst / "chakra-personal.json").read_text())
    CHAKRA_READINGS.update({key: set(chakra["readings"]) for key, chakra in corpus["chakras"].items()})
    CHAKRA_READINGS["energy_field"] = set(corpus.get("energy_field", {}).get("readings", {}))

    problems: list[str] = []
    warnings: list[str] = []
    written: list[str] = []
    method = json.loads(METHOD.read_text())
    allowed_tails = {item["triple"] for item in method["reachable_karmic_tails"]}
    tail_primary: dict[str, str] = {}

    for category in ARTICLE:
        folder = src / category
        files = sorted(folder.glob("*.json")) if folder.exists() else []
        key_field = KEY_FIELD.get(category, "key")
        items, seen = [], {}
        for path in files:
            item = load(path, problems)
            if item is None:
                continue
            where = f"{category}/{path.name}"
            key = item.get(key_field, item.get("key", item.get("n")))
            key = str(key).strip() if key is not None else ""
            if not key:
                fail(problems, where, f"нет ключа ({key_field})")
            elif key in seen:
                # ключ равен адресу страницы: второй файл молча затирал бы первый
                fail(problems, where, f"ключ {key!r} уже занят файлом {seen[key]}")
            else:
                seen[key] = path.name
            if path.stem != key and category != "karmic-tails":
                print(f"  ~ {where}: имя файла не совпадает с ключом {key!r}")
            check_article(item, where, problems)
            if category == "karmic-tails":
                check_tail(item, where, allowed_tails, problems)
                publication = item.get("publication") or {}
                primary = str(publication.get("primary_query") or "").strip().lower()
                if primary:
                    if primary in tail_primary:
                        fail(problems, where,
                             f"primary_query уже занят {tail_primary[primary]}")
                    tail_primary[primary] = where
            hygiene(item, where, "", warnings, args.lang)
            trim_description(item, where)
            items.append(item)
        target = dst / f"{category}.json"
        expected_payload = {"items": items}
        if args.check:
            if not target.exists() or load(target, problems) != expected_payload:
                fail(problems, target.name,
                     "собранный артефакт устарел — выполните tools/seo/build-content.py")
        else:
            target.write_text(json.dumps(expected_payload, ensure_ascii=False, indent=1) + "\n")
        written.append(f"{target.name}: {len(items)}")

        if category == "karmic-tails" and set(seen) != allowed_tails:
            fail(problems, category,
                 f"набор хвостов не равен реестру: нет {sorted(allowed_tails - set(seen))}, "
                 f"лишние {sorted(set(seen) - allowed_tails)}")

    for category, (base_name, key_field) in ENRICH.items():
        folder = src / category
        files = sorted(folder.glob("*.json")) if folder.exists() else []
        if not files:
            written.append(f"{base_name}: без изменений")
            continue
        base = base_items(dst, base_name)
        index = {str(x.get(key_field)): x for x in base}
        touched, seen = 0, {}
        for path in files:
            item = load(path, problems)
            if item is None:
                continue
            where = f"{category}/{path.name}"
            key = str(item.get(key_field, "")).strip()
            if key in seen:
                fail(problems, where, f"ключ {key!r} уже занят файлом {seen[key]}")
                continue
            seen[key] = path.name
            if category == "chakras":
                check_chakra_article(item, where, set(index), key, problems)
            else:
                check_enrichment(item, where, set(index), key, problems)
            hygiene(item, where, "", warnings, args.lang)
            entry = index.get(key)
            if entry is None:
                continue
            if category == "chakras":
                trim_description(item, where)
                entry["article"] = {field: item[field] for field in CHAKRA_ARTICLE if field in item}
                touched += 1
                continue
            entry["meaning"] = item["meaning"]
            if isinstance(item.get("seo"), dict):
                entry["seo"] = {**entry.get("seo", {}), **item["seo"]}
            for field in ("article_sections", "faq", "h1"):
                if field in item:
                    entry[field] = item[field]
            touched += 1
        expected_payload = {"count": len(base), "items": base}
        if args.check:
            if not (dst / base_name).exists() or load(dst / base_name, problems) != expected_payload:
                fail(problems, base_name,
                     "собранный артефакт устарел — выполните tools/seo/build-content.py")
        else:
            (dst / base_name).write_text(
                json.dumps(expected_payload, ensure_ascii=False, indent=1) + "\n"
            )
        written.append(f"{base_name}: обогащено {touched} из {len(base)}")

    if problems:
        print(f"\nне сходится, {len(problems)} проблем — ничего не записано:" if args.check
              else f"\nне сходится, {len(problems)} проблем:")
        for p in problems:
            print(f"  ✗ {p}")
        return 1

    if warnings:
        print(f"\nслова из text-policy.json ({len(warnings)}): сайт выведет их как есть, проверьте смысл:")
        for line in warnings:
            print(f"  ! {line}")

    print("\nсобрано:" if not args.check else "\nпроверка прошла, к записи готово:")
    for line in written:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
