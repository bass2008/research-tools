#!/usr/bin/env python3
"""Сборка статей в источники данных сайта.

Авторы сдают по файлу на статью в `tools/seo/content/<категория>/<ключ>.json`; сайт читает по
файлу на категорию в `web/content/<категория>.json`. Этот скрипт переносит первое во второе и
проверяет то, что иначе выяснится молча: страница просто не появится, а причину придётся искать
глазами.

    python tools/seo/build-content.py            # проверить и собрать
    python tools/seo/build-content.py --check    # только проверить

Две категории не заводят новых страниц, а обогащают существующие (`arcana`, `positions`): их
статьи вливаются в готовый корпус пополю — приходят `meaning` и `seo`, всё остальное
(`short`, `keywords`, `plus`, `minus`, `in_positions`, `points`) остаётся на месте.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools/seo/content"
DST = ROOT / "project/destiny-matrix/web/content"

BRAND = len(" — Arcana Sense")
TITLE_LIMIT = 70

# Список слово-в-слово из web/lib/content.ts: там любое поле с медицинской лексикой отбрасывается
# целиком, потому что реклама целительства требует разрешения, которого не получить. Фильтр ловит
# подстроку, а не смысл, поэтому «не гарантирует» и «время не лечит» тоже под него попадают —
# сборка обязана сказать об этом здесь, а не молча отдать сайту урезанную статью.
BANNED = (
    "лечен", "лечит", "лечи́", "лечение", "диагноз", "заболеван", "исцел", "целитель",
    "болезн", "симптом", "терапи", "препарат", "набор веса", "алкогол", "похуден",
    "выздоравл", "недуг", "иммунит", "хроническ", "врач", "клиник",
    "гарантиру", "уязвимые зоны",
)

# Минимумы повторяют загрузчик сайта (web/lib/content.ts): что не проходит здесь, не попадёт на
# страницу и там — только там об этом узнают после сборки.
ARTICLE = ("karmic-tails", "year-arcana", "category-hubs", "hubs")
ENRICH = {"arcana": ("arcana.json", "n"), "positions": ("positions.json", "key")}
KEY_FIELD = {"year-arcana": "n"}


def fail(problems: list[str], where: str, text: str) -> None:
    problems.append(f"{where}: {text}")


def hygiene(value: object, where: str, path: str, losses: list[str]) -> None:
    """Где сайт вырежет текст. Не ошибка сборки: поле уйдёт, страница останется."""
    if isinstance(value, str):
        low = value.lower()
        found = [w for w in BANNED if w in low]
        if found:
            losses.append(f"{where}: {path} — {', '.join(found)}")
    elif isinstance(value, list):
        for i, item in enumerate(value):
            hygiene(item, where, f"{path}[{i}]", losses)
    elif isinstance(value, dict):
        for key, item in value.items():
            hygiene(item, where, f"{path}.{key}" if path else key, losses)


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
        if sep in head:
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

def check_article(item: dict, where: str, problems: list[str]) -> None:
    if not str(item.get("title") or "").strip():
        fail(problems, where, "нет title")
    if len(str(item.get("short") or "")) < 60:
        fail(problems, where, "short короче 60 знаков — страница будет без первого экрана")
    sections = item.get("sections")
    if not isinstance(sections, list) or not sections:
        fail(problems, where, "нет sections — статья отбрасывается целиком")
    else:
        for i, s in enumerate(sections):
            if not isinstance(s, dict) or not s.get("h2") or not s.get("paragraphs"):
                fail(problems, where, f"sections[{i}] без h2 или без paragraphs")
    faq = item.get("faq")
    if faq is not None and not isinstance(faq, list):
        fail(problems, where, "faq должен быть массивом (или отсутствовать: он опционален)")
    for i, qa in enumerate(faq or []):
        if not isinstance(qa, dict) or len(str(qa.get("q") or "")) < 9 or len(str(qa.get("a") or "")) < 41:
            fail(problems, where, f"faq[{i}]: вопрос от 9 знаков, ответ от 41 — иначе выпадет молча")
    check_seo(item.get("seo"), where, problems)


def check_enrichment(item: dict, where: str, base_keys: set, key: str, problems: list[str]) -> None:
    if key not in base_keys:
        fail(problems, where, f"ключа {key!r} нет в корпусе — обогащать нечего")
    meaning = item.get("meaning")
    least = 3 if where.startswith("arcana") else 2
    if not isinstance(meaning, list) or len([p for p in meaning if isinstance(p, str) and len(p) > 20]) < least:
        fail(problems, where, f"meaning: нужно минимум {least} абзаца длиннее 20 знаков")
    check_seo(item.get("seo"), where, problems)


def load(path: Path, problems: list[str]) -> dict | None:
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        fail(problems, path.name, f"не разбирается как JSON — {exc}")
        return None


def base_items(name: str) -> list[dict]:
    raw = json.loads((DST / name).read_text())
    return raw.get("items", raw) if isinstance(raw, dict) else raw


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="только проверить, ничего не писать")
    args = parser.parse_args()

    problems: list[str] = []
    losses: list[str] = []
    written: list[str] = []

    for category in ARTICLE:
        folder = SRC / category
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
            hygiene(item, where, "", losses)
            trim_description(item, where)
            items.append(item)
        target = DST / f"{category}.json"
        if not args.check:
            target.write_text(json.dumps({"items": items}, ensure_ascii=False, indent=1) + "\n")
        written.append(f"{target.name}: {len(items)}")

    for category, (base_name, key_field) in ENRICH.items():
        folder = SRC / category
        files = sorted(folder.glob("*.json")) if folder.exists() else []
        if not files:
            written.append(f"{base_name}: без изменений")
            continue
        base = base_items(base_name)
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
            check_enrichment(item, where, set(index), key, problems)
            hygiene(item, where, "", losses)
            entry = index.get(key)
            if entry is None:
                continue
            entry["meaning"] = item["meaning"]
            if isinstance(item.get("seo"), dict):
                entry["seo"] = {**entry.get("seo", {}), **item["seo"]}
            touched += 1
        if not args.check:
            (DST / base_name).write_text(
                json.dumps({"items": base}, ensure_ascii=False, indent=1) + "\n"
            )
        written.append(f"{base_name}: обогащено {touched} из {len(base)}")

    if problems:
        print(f"\nне сходится, {len(problems)} проблем — ничего не записано:" if args.check
              else f"\nне сходится, {len(problems)} проблем:")
        for p in problems:
            print(f"  ✗ {p}")
        return 1

    if losses:
        print(f"\nгигиена вырежет {len(losses)} полей — секция, абзац или вопрос просто не появятся:")
        for line in losses:
            print(f"  ! {line}")
        print("  формулировку правит автор: фильтр юридический и ослаблению не подлежит")

    print("\nсобрано:" if not args.check else "\nпроверка прошла, к записи готово:")
    for line in written:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
