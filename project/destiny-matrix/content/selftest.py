"""Проверка самого валидатора: он должен падать на испорченном контенте.

    python -m content.selftest

Без этой проверки «ошибок: 0» ничего не значит — валидатор мог бы молчать всегда.
Порча делается на копии в /tmp, боевые JSON не трогаются.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "web" / "content"


def _run(content_dir: Path) -> tuple[int, str]:
    env = dict(os.environ, ENCYCLOPEDIA_CONTENT_DIR=str(content_dir))
    done = subprocess.run([sys.executable, "-m", "content.validate", "--all"],
                          cwd=ROOT, env=env, capture_output=True, text=True)
    return done.returncode, done.stdout + done.stderr


def _patch(content_dir: Path, name: str, fn) -> None:
    path = content_dir / name
    payload = json.loads(path.read_text(encoding="utf-8"))
    path.write_text(json.dumps(fn(payload), ensure_ascii=False), encoding="utf-8")


def _drop_pair(payload: dict) -> dict:
    return {"count": payload["count"] - 1, "items": payload["items"][:-1]}


def _blank_position(payload: dict) -> dict:
    payload["items"][0]["in_positions"]["money"] = ""
    return payload


def _duplicate_text(payload: dict) -> dict:
    payload["items"][5]["paragraphs"][0] = payload["items"][0]["paragraphs"][0]
    return payload


def _break_href(payload: dict) -> dict:
    payload["items"][0]["combinations"][0]["href"] = "/encyclopedia/combination/1-99"
    return payload


def _add_clerk(payload: dict) -> dict:
    payload["items"][0]["level"][0] += " Данный уровень является ключевым в рамках системы."
    return payload


def _same_opening(payload: dict) -> dict:
    start = payload["items"][0]["paragraphs"][1]
    for item in payload["items"][1:8]:
        item["paragraphs"][1] = start.replace("Спорят", "Спорили") + " Ещё одна фраза для длины."
    return payload


CASES = (
    ("убрано одно сочетание", "combinations.json", _drop_pair),
    ("стёрт текст позиции", "arcana.json", _blank_position),
    ("продублирован абзац", "combinations.json", _duplicate_text),
    ("ссылка в никуда", "arcana.json", _break_href),
    ("канцелярит в тексте", "chakras.json", _add_clerk),
    ("одинаковые зачины", "combinations.json", _same_opening),
)


def main() -> int:
    code, out = _run(CONTENT)
    last = out.strip().splitlines()[-1] if out.strip() else "валидатор не вывел результат"
    print(f"чистый контент: код {code} — {last}")
    if code != 0:
        print(out)
        return 1

    failures = 0
    for title, name, breaker in CASES:
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "content"
            shutil.copytree(CONTENT, copy)
            _patch(copy, name, breaker)
            code, out = _run(copy)
            errors = [line.strip() for line in out.splitlines() if line.strip().startswith("✗")]
            first = errors[0][:100] if errors else "ни одной ошибки"
            print(f"{title}: код {code}, ошибок {len(errors)} — {first}")
            if code == 0:
                failures += 1
                print(f"  ! валидатор пропустил: {title}")
    print("валидатор ловит все случаи" if not failures else f"пропущено случаев: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
