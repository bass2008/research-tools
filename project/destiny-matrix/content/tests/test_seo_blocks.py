"""The Markdown importer preserves supported blocks and rejects invalid article structure."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

import pytest


SEO = Path(__file__).resolve().parents[4] / "tools" / "seo"


def _tool(name: str):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), SEO / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MD = _tool("md-to-content")
BUILD = _tool("build-content")


@pytest.mark.parametrize("indent", ["", "  "])
@pytest.mark.parametrize("gap", ["\n", "\n\n"])
def test_markdown_keeps_adjacent_bullet_and_numbered_lists_separate(indent, gap):
    text = (f"{indent}- Первый пункт\n{indent}- Второй пункт{gap}"
            f"{indent}1. Первый шаг\n{indent}2. Второй шаг")
    report = MD.Report()
    blocks = [MD.block(kind, value, report) for kind, value in MD.tokens(text.splitlines(), report)]
    assert blocks == [{"ul": ["Первый пункт", "Второй пункт"]},
                      {"ol": ["Первый шаг", "Второй шаг"]}]
    assert report.notes == []


def test_markdown_still_flattens_nested_list_with_explicit_warning():
    report = MD.Report()
    tokens = MD.tokens(["- Первый пункт", "  - Уточнение", "- Второй пункт"], report)
    assert tokens == [("ul", ["Первый пункт Уточнение", "Второй пункт"])]
    assert len(report.notes) == 1


def test_indented_heading_after_indented_list_remains_a_heading():
    report = MD.Report()
    tokens = MD.tokens(["  - Первый пункт", "  ### Новый раздел"], report)
    assert tokens == [("ul", ["Первый пункт"]), ("h3", "Новый раздел")]


def test_markdown_table_keeps_empty_edge_cells_and_escaped_pipe_text():
    report = MD.Report()
    result = MD.table(["||Значение||", "|---|---|---|", r"||один \| два||"], report)
    assert result == {"table": {"head": ["", "Значение", ""],
                                "rows": [["", "один | два", ""]]}}
    assert report.notes == []


@pytest.mark.parametrize("h2", [" ", 42, None])
def test_article_validation_rejects_empty_or_nontext_heading(h2):
    item = json.loads((SEO / "content/ru/karmic-tails/3-7-22.json").read_text())
    item["sections"][0]["h2"] = h2
    problems = []
    BUILD.check_article(item, "fixture", problems)
    assert any("sections[0]" in problem for problem in problems)


@pytest.mark.parametrize("question,answer", [
    (" 1234567 ", "А" * 41),
    ("123456789", " " + "А" * 39 + " "),
    (123456789, "А" * 41),
    ("123456789", ["А" * 41]),
])
def test_article_validation_matches_trimmed_faq_lengths(question, answer):
    item = json.loads((SEO / "content/ru/karmic-tails/3-7-22.json").read_text())
    item["faq"] = [{"q": question, "a": answer}]
    problems = []
    BUILD.check_article(item, "fixture", problems)
    assert any("faq[0]" in problem for problem in problems)


def test_article_accepts_valid_blocks_and_exact_faq_minimums():
    item = json.loads((SEO / "content/ru/karmic-tails/3-7-22.json").read_text())
    item = copy.deepcopy(item)
    item["sections"] = [{"h2": "Допустимые блоки", "paragraphs": [
        "Абзац с **важной мыслью** длиннее двадцати знаков.",
        {"h3": "Подзаголовок"}, {"ul": ["Пункт"]}, {"ol": ["Шаг"]},
        {"table": {"head": ["", "Значение"], "rows": [["", "**Текст**"]]}},
    ]}]
    item["faq"] = [{"q": " " + "А" * 9 + " ", "a": " " + "Б" * 41 + " "}]
    problems = []
    BUILD.check_article(item, "fixture", problems)
    assert problems == []


@pytest.mark.parametrize("heading,paragraph", [
    (" " * 10, "Содержательный абзац длиннее двадцати знаков."),
    (1234567890, "Содержательный абзац длиннее двадцати знаков."),
    ("Корректный заголовок", "коротко"),
])
def test_enrichment_rejects_sections_that_reader_cannot_load(heading, paragraph):
    item = json.loads((SEO / "content/ru/positions/chakras.json").read_text())
    item["article_sections"] = [{"h2": heading, "paragraphs": [paragraph]}]
    problems = []
    BUILD.check_enrichment(item, "positions/chakras.json", {"chakras"}, "chakras", problems)
    assert any("article_sections" in problem for problem in problems)


@pytest.mark.parametrize("answer", ["А" * 40, " " + "А" * 39 + " "])
def test_enrichment_rejects_short_faq_answers(answer):
    item = json.loads((SEO / "content/ru/positions/chakras.json").read_text())
    item["faq"] = [{"q": "123456789", "a": answer}]
    problems = []
    BUILD.check_enrichment(item, "positions/chakras.json", {"chakras"}, "chakras", problems)
    assert any("faq" in problem for problem in problems)
