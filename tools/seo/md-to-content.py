#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC_ROOT = ROOT / "tools/seo/content"
METHOD = ROOT / "project/destiny-matrix/spec/method.json"
FAQ_TITLES = ("частые вопросы", "вопросы и ответы", "faq", "frequently asked questions")

LEAD_LABEL = re.compile(r"^\*\*[^*]{1,30}?[.:]\*\*\s*")
LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
ITALIC = re.compile(r"(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)")
CODE = re.compile(r"`([^`]+)`")
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
LIST_ITEM = re.compile(r"^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$")
TABLE_SEP = re.compile(r"^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$")
RULE = re.compile(r"^((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$")
MARKER = re.compile(r"^>?\s*\*{1,2}\[(?P<label>(?:Блок|Вставка|Визуализация)[^\]]*)\]\*{1,2}\s*(?P<rest>.*)$")
COMMENT = re.compile(r"^<!--(?P<label>.*)-->$")


class Report:
    def __init__(self) -> None:
        self.notes: list[str] = []

    def warn(self, text: str) -> None:
        self.notes.append(text)


def plain(text: str) -> str:
    return text.replace("**", "")


# Статьи арканов держат внутренние ссылки `[текст](/путь)`: сайт рисует их сам, адреса проверяет сборка.
KEEP_INTERNAL_LINKS = False


def inline(text: str, rep: Report) -> str:
    if LINK.search(text):
        def drop(match: re.Match) -> str:
            if KEEP_INTERNAL_LINKS and match.group(0).split("](", 1)[1].startswith("/"):
                return match.group(0)
            rep.warn(f"ссылка заменена своим текстом: «{match.group(0)[:60]}»")
            return match.group(1)
        text = LINK.sub(drop, text)
    text = CODE.sub(r"\1", text)
    text = ITALIC.sub(r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def front_matter(lines: list[str]) -> tuple[dict[str, str], list[str]]:
    if not lines or lines[0].strip() != "---":
        return {}, lines
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        return {}, lines
    meta: dict[str, str] = {}
    for line in lines[1:end]:
        match = re.match(r"^(\w+):\s*(.*)$", line)
        if not match:
            continue
        value = match.group(2).strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        meta[match.group(1)] = value
    return meta, lines[end + 1:]


def starts_block(line: str) -> bool:
    stripped = line.strip()
    return (stripped.startswith(("#", "|", "```", ">", "<!--")) or bool(MARKER.match(stripped))
            or bool(LIST_ITEM.match(line))
            or bool(RULE.match(stripped)))


def same_list(match: re.Match | None, ordered: bool, indent: int) -> bool:
    return (bool(match) and len(match.group(1).expandtabs(4)) == indent
            and (match.group(2) is not None) == ordered)


def tokens(lines: list[str], rep: Report) -> list[tuple[str, object]]:
    out: list[tuple[str, object]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if stripped.startswith("```"):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                i += 1
            i += 1
            rep.warn("блок кода выброшен: шаблон сайта такого не выводит")
            continue
        heading = HEADING.match(stripped)
        if heading:
            out.append((f"h{len(heading.group(1))}", heading.group(2).strip()))
            i += 1
            continue
        if RULE.match(stripped):
            i += 1
            continue
        if stripped.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            out.append(("table", rows))
            continue
        marker = MARKER.match(stripped) or COMMENT.match(stripped)
        if marker:
            label = marker.group("label")
            rest = marker.groupdict().get("rest") or ""
            i += 1
            if rest.strip():
                out.append(("p", rest.strip()))
            if "Чакры и ваши арканы" in label or "Визуализация" in label:
                rep.warn("метка таблицы чакр выброшена: таблицу ставит шаблон после вводки")
            elif "схем" in label:
                rep.warn(f"метка схемы выброшена, схему рисует шаблон: «{label.strip()[:60]}»")
            elif marker.re is COMMENT and "Вставка" not in label:
                rep.warn(f"HTML-комментарий выброшен: «{label.strip()[:60]}»")
            else:
                out.append(("slot", "calc"))
            continue
        if stripped.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            out.append(("p", " ".join(quote)))
            continue
        item = LIST_ITEM.match(line)
        if item:
            ordered = item.group(2) is not None
            indent = len(item.group(1).expandtabs(4))
            items: list[str] = []
            while i < len(lines):
                current = lines[i]
                match = LIST_ITEM.match(current)
                if same_list(match, ordered, indent):
                    items.append(match.group(3))
                    i += 1
                    continue
                if not current.strip():
                    j = i
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    if j < len(lines) and (same_list(LIST_ITEM.match(lines[j]), ordered, indent)
                                           or len(lines[j]) - len(lines[j].lstrip()) > indent):
                        i = j
                        continue
                    break
                if match:
                    if len(match.group(1).expandtabs(4)) <= indent:
                        break
                    rep.warn(f"вложенный список влит в пункт: «{match.group(3)[:50]}»")
                    items[-1] += " " + match.group(3)
                    i += 1
                    continue
                if len(current) - len(current.lstrip()) > indent or not starts_block(current):
                    items[-1] += " " + current.strip()
                    i += 1
                    continue
                break
            out.append(("ol" if ordered else "ul", items))
            continue
        paragraph = []
        while i < len(lines) and lines[i].strip() and not (paragraph and starts_block(lines[i])):
            paragraph.append(lines[i].strip())
            i += 1
        out.append(("p", " ".join(paragraph)))
    return out


def table_cells(row: str) -> list[str]:
    line = row.strip()
    cells, cell = [], []
    i = 0
    ended_with_separator = False
    while i < len(line):
        char = line[i]
        ended_with_separator = False
        if char == "\\" and i + 1 < len(line) and line[i + 1] in ("\\", "|"):
            # An escaped pipe belongs to its cell. Preserve other Markdown escapes.
            cell.append("|" if line[i + 1] == "|" else "\\\\")
            i += 2
            continue
        if char == "|":
            cells.append("".join(cell).strip())
            cell = []
            ended_with_separator = True
        else:
            cell.append(char)
        i += 1
    cells.append("".join(cell).strip())
    # Remove exactly the optional outside delimiters, retaining empty edge cells.
    if line.startswith("|"):
        cells.pop(0)
    if ended_with_separator:
        cells.pop()
    return cells


def table(rows: list[str], rep: Report) -> dict:
    cells = [table_cells(row) for row in rows]
    if len(cells) > 1 and TABLE_SEP.match(rows[1]):
        head, body = cells[0], cells[2:]
    else:
        rep.warn("у таблицы нет строки-разделителя: первая строка взята заголовком")
        head, body = cells[0], cells[1:]
    for row in body:
        if len(row) != len(head):
            rep.warn(f"строка таблицы другой ширины выровнена: «{' | '.join(row)[:60]}»")
    body = [(row + [""] * len(head))[:len(head)] for row in body]
    return {"table": {
        "head": [plain(inline(cell, rep)) for cell in head],
        "rows": [[inline(cell, rep) for cell in row] for row in body],
    }}


def block(kind: str, value: object, rep: Report) -> str | dict:
    if kind == "p":
        text = inline(str(value), rep)
        if len(plain(text)) <= 20:
            label = plain(text).rstrip(":").strip()
            if re.fullmatch(r"\*\*[^*]+\*\*:?", text) or text.endswith(":"):
                return {"h3": label}
            rep.warn(f"абзац короче 21 знака, сборка упадёт: «{text}»")
        return text
    if kind.startswith("h"):
        return {"h3": plain(inline(str(value), rep))}
    if kind in ("ul", "ol"):
        return {kind: [inline(item, rep) for item in value]}
    if kind == "slot":
        return {"slot": value}
    return table(value, rep)


def flat(kind: str, value: object, rep: Report) -> str:
    if kind == "p":
        return inline(str(value), rep)
    if kind in ("ul", "ol"):
        rep.warn("список в ответе FAQ развёрнут в строку: ответ — только текст")
        return " ".join(inline(item, rep) for item in value)
    rep.warn(f"{kind} в ответе FAQ выброшен: ответ — только текст")
    return ""


def convert(md: str, base: dict, rep: Report, keep_intro: bool = False) -> dict:
    meta, lines = front_matter(md.splitlines())
    title = ""
    lead: list[str | dict] = []
    sections: list[dict] = []
    faq: list[dict] = []
    current: dict | None = None
    in_faq = False
    for kind, value in tokens(lines, rep):
        if kind == "h1":
            title = plain(inline(str(value), rep))
            continue
        if kind == "h2":
            h2 = plain(inline(str(value), rep))
            in_faq = h2.lower().startswith(FAQ_TITLES)
            current = None if in_faq else {"h2": h2, "paragraphs": []}
            if current:
                sections.append(current)
            continue
        if in_faq:
            if kind.startswith("h"):
                faq.append({"q": plain(inline(str(value), rep)), "a": ""})
            elif faq:
                faq[-1]["a"] = f"{faq[-1]['a']} {flat(kind, value, rep)}".strip()
            else:
                rep.warn("текст в FAQ до первого вопроса пропущен")
            continue
        (current["paragraphs"] if current is not None else lead).append(block(kind, value, rep))

    if not lead or not isinstance(lead[0], str):
        rep.warn("перед первым ## нет вводного абзаца: short не заполнен")
        short = ""
    else:
        short = plain(LEAD_LABEL.sub("", lead.pop(0)))
    if lead and not keep_intro:
        if sections:
            rep.warn(f"{len(lead)} блок(а) между вводкой и первым ## перенесены в начало раздела "
                     f"«{sections[0]['h2']}»")
            sections[0]["paragraphs"][:0] = lead
        else:
            rep.warn("в статье нет ни одного ## — вводные блоки потеряны")

    item = dict(base)
    seo = dict(item.get("seo") or {})
    for field in ("title", "description"):
        if meta.get(field):
            seo[field] = meta[field]
    item.update({"title": title or item.get("title", ""), "seo": seo, "short": short,
                 "sections": sections})
    if keep_intro:
        item["intro"] = lead
    if faq:
        item["faq"] = faq
    else:
        item.pop("faq", None)
    return item


def convert_arcanum(md: str, base: dict, rep: Report) -> dict:
    body = convert(md, {}, rep)
    if body.get("faq"):
        rep.warn("у арканов FAQ нет (content-format.md, «Разметка»): вопросы-ответы выброшены")
    article = {"title": body["title"], "short": body["short"],
               "seo": {k: v for k, v in body.get("seo", {}).items() if k in ("title", "description")},
               "sections": body["sections"]}
    return {**base, "article": article}


def load_build_content():
    spec = importlib.util.spec_from_file_location("build_content", ROOT / "tools/seo/build-content.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check(item: dict, category: str, lang: str) -> tuple[list[str], list[str]]:
    build = load_build_content()
    problems: list[str] = []
    warnings: list[str] = []
    where = f"{category}/{item.get('key', item.get('n', '?'))}"
    if category == "arcana":
        build.check_article(item["article"], where, problems)
        build.check_links(item["article"], where, problems, build.known_paths(lang))
        build.hygiene(item["article"], where, "", warnings, lang)
        return problems, warnings
    build.check_article(item, where, problems)
    if category == "karmic-tails":
        allowed = {t["triple"] for t in json.loads(METHOD.read_text())["reachable_karmic_tails"]}
        build.check_tail(item, where, allowed, problems)
    if category == "compatibility-karmic-tails":
        build.check_pair_tail(item, where, build.pair_tail_keys(), problems)
    build.hygiene(item, where, "", warnings, lang)
    return problems, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description="Markdown-статья → JSON-источник tools/seo/content")
    parser.add_argument("markdown", type=Path)
    parser.add_argument("--key", help="ключ статьи; по умолчанию тройка вида 3-7-22 из имени файла")
    parser.add_argument("--category", default="karmic-tails")
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--out", type=Path, help="куда записать JSON; без флага — в stdout")
    args = parser.parse_args()

    key = args.key
    if not key:
        found = re.search(r"\d+-\d+-\d+", args.markdown.stem)
        if not found:
            parser.error("не удалось взять ключ из имени файла — передайте --key")
        key = found.group(0)
    base_path = SRC_ROOT / args.lang / args.category / f"{key}.json"
    base = json.loads(base_path.read_text()) if base_path.exists() else {"key": key}

    rep = Report()
    if args.category == "arcana":
        global KEEP_INTERNAL_LINKS
        KEEP_INTERNAL_LINKS = True
        item = convert_arcanum(args.markdown.read_text(), base, rep)
    else:
        item = convert(args.markdown.read_text(), base, rep, keep_intro=args.category == "chakras")
    problems, warnings = check(item, args.category, args.lang)

    payload = json.dumps(item, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(payload)
    else:
        sys.stdout.write(payload)
    for note in rep.notes:
        print(f"  ~ {note}", file=sys.stderr)
    for warning in warnings:
        print(f"  ! {warning} — сайт выведет как есть, проверьте смысл", file=sys.stderr)
    for problem in problems:
        print(f"  ✗ {problem}", file=sys.stderr)
    if not base_path.exists():
        print(f"  ~ {base_path} не найден: publication, arcana и related не перенесены", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
