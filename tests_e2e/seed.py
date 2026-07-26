#!/usr/bin/env python3
"""Засев тестовой БД для браузерных E2E (testing-plan §8).

Данные синтетические, но проходят настоящим кодом: ответы Wordstat лежат в `cache`,
поэтому `load`/`full_load` работают из кэша, а с `XMLRIVER_CACHE_ONLY=1` промах кэша в
сеть не идёт (§3.1). Выдача (`serp`) и отчёты засеяны заранее: `search` в режиме «только
кэш» берёт готовую выдачу, а `Link` и вкладка «Отчёты» получают настоящие файлы на диске.
Ни одного платного запроса и ни одного обращения к боевой semcore.db.

Деревья (каждый корень — корень-кандидат, т.е. ни у кого не ребёнок):

Засев обязан быть достижимым состоянием: `build` проверяет инвариант `FULLY_LOADED`
(design §2) и падает, если засеял ложь. Отсюда два правила по дереву A: узел ≥ `FLOOR`
внутри `FULLY_LOADED` поддерева обязан быть `queried=1`, а фронтир (`NEW`, не запрошен)
живёт **ниже** `FLOOR` — именно так его оставляет настоящий краул.

| Корень | Зачем |
|---|---|
| `убрать фон` | пайплайн: поддерево `FULLY_LOADED` + выдача; ветка «видео» — фронтир (`NEW`) |
| `виджет` | 130 детей — пагинация вширь («показать ещё») |
| `мини корень` | маленькое поддерево целиком под `drill` (выдача на все узлы) |
| `фоторедактор онлайн`, `видеоредактор онлайн` | `ANALYZED` с отчётами (`Link`, «Отчёты») |
| `категория узел` | терминал `CATEGORY` для `Fix kind` |
"""
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import wscore  # noqa: E402

TS = 1_750_000_000   # фиксированный таймстемп: снимки состояния сравнимы между прогонами

# ---------- фразы (тесты берут их отсюда, а не хардкодят) ----------

ROOT_A = "убрать фон"
A_ONLINE = "убрать фон онлайн"
A_ONLINE_FREE = "убрать фон онлайн бесплатно"
A_ONLINE_FAST = "убрать фон онлайн быстро"
A_VIDEO = "убрать фон видео"
A_VIDEO_2024 = "убрать фон видео 2024"
A_VIDEO_PHONE = "убрать фон видео телефон"
A_PNG = "убрать фон png"

ROOT_B = "виджет"
B_KIDS = 130                       # больше 120 — первая страница детей во фронте
B_FIRST = "виджет 1"
B_LAST = f"виджет {B_KIDS}"

ROOT_C = "мини корень"
C_ONLINE = "мини корень онлайн"
C_FREE = "мини корень бесплатно"
C_ALL = (ROOT_C, C_ONLINE, C_FREE)

REP_HI = "фоторедактор онлайн"
REP_LO = "видеоредактор онлайн"
REP_HI_ID = "e2e-report-hi"
REP_LO_ID = "e2e-report-lo"
REP_HI_SCORE = 91
REP_LO_SCORE = 42

ROOT_E = "категория узел"

# корни-кандидаты: узлы, ни разу не встречавшиеся как чей-то ребёнок (tech §6.2)
ROOT_CANDIDATES = (ROOT_B, ROOT_A, ROOT_C, REP_HI, REP_LO, ROOT_E)

# обязательные разделы отчёта (templates/report.html) — проверяются в сценарии 12
REPORT_SECTIONS = ("Скоркарта", "Спрос и рынок", "Конкуренция в выдаче", "Незакрытая потребность",
                   "Реализация", "Экономика и монетизация", "Дистрибуция", "Риски",
                   "Вывод", "Опорная выдача")

# ---------- кэш Wordstat: только то, что тест реально грузит ----------
# первая пара — сама фраза (своя частота), остальные — уточнения (супермножества слов).
# Фраз, которых здесь нет, в кэше нет намеренно: в режиме «только кэш» они станут листьями.

# Частоты ветки «видео» — ниже FLOOR: краул туда не идёт, поэтому она законно остаётся
# фронтиром внутри загруженного поддерева (см. правила в docstring модуля).
CACHE = {
    ROOT_A: [(ROOT_A, 1000), (A_ONLINE, 500), (A_ONLINE_FREE, 200),
             (A_VIDEO, 40), (A_VIDEO_2024, 30), (A_PNG, 40)],
    A_ONLINE: [(A_ONLINE, 500), (A_ONLINE_FREE, 200), (A_ONLINE_FAST, 90)],
    A_VIDEO: [(A_VIDEO, 40), (A_VIDEO_2024, 30), (A_VIDEO_PHONE, 20)],
}

# ---------- модель: (фраза, freq, status, queried, total_refinements, доп. колонки) ----------

NODES = [
    # A: пайплайн. Ветка «онлайн» загружена (синий +), ветка «видео» — фронтир (серый +)
    (ROOT_A, 1000, "FULLY_LOADED", 1, 5, {}),
    (A_ONLINE, 500, "FULLY_LOADED", 1, 2, {}),
    (A_ONLINE_FREE, 200, "FULLY_LOADED", 1, 0, {}),   # >= FLOOR -> обязан быть запрошен
    (A_ONLINE_FAST, 90, "FULLY_LOADED", 1, 0, {}),    # то же
    (A_VIDEO, 40, "NEW", 0, 0, {}),                   # < FLOOR -> законный фронтир
    (A_VIDEO_2024, 30, "NEW", 0, 0, {}),
    (A_PNG, 40, "FULLY_LOADED", 0, 0, {}),            # < FLOOR: лист, краул его не фетчит
    # B: пагинация вширь
    (ROOT_B, 5000, "LOADED", 1, B_KIDS, {}),
    # C: поддерево под drill — уже загружено, вся выдача есть
    (ROOT_C, 900, "FULLY_LOADED", 1, 2, {}),
    (C_ONLINE, 400, "FULLY_LOADED", 1, 0, {}),
    (C_FREE, 300, "FULLY_LOADED", 1, 0, {}),
    # D: готовые отчёты
    (REP_HI, 700, "ANALYZED", 1, 0,
     {"kind": "transactional", "score": 88.0, "verdict": "BUILD", "verdict_score": REP_HI_SCORE,
      "description": "спрос есть, в топе только статьи", "classified_at": TS, "analyzed_at": TS}),
    (REP_LO, 600, "ANALYZED", 1, 0,
     {"kind": "transactional", "score": 70.0, "verdict": "MAYBE", "verdict_score": REP_LO_SCORE,
      "description": "нишу закрывают два профильных сервиса", "classified_at": TS, "analyzed_at": TS}),
    # E: терминал для Fix kind
    (ROOT_E, 500, "CATEGORY", 1, 0,
     {"kind": "category", "classify_conf": 0.9, "classify_reason": "зонтик: дети разного интента",
      "classified_at": TS}),
]
NODES += [(f"виджет {i}", 200 + B_KIDS - i, "NEW", 0, 0, {}) for i in range(1, B_KIDS + 1)]

EDGES = [
    (ROOT_A, A_ONLINE), (ROOT_A, A_ONLINE_FREE), (ROOT_A, A_VIDEO),
    (ROOT_A, A_VIDEO_2024), (ROOT_A, A_PNG),
    (A_ONLINE, A_ONLINE_FREE), (A_ONLINE, A_ONLINE_FAST),
    (ROOT_C, C_ONLINE), (ROOT_C, C_FREE),
]
EDGES += [(ROOT_B, f"виджет {i}") for i in range(1, B_KIDS + 1)]

# выдача засеяна на всё, что тест ведёт через search (иначе «только кэш» — законный отказ)
SERP_PHRASES = (ROOT_A, *C_ALL)


def _docs(phrase, engine):
    """Топ-10 выдачи: форма как у _parse_serp (rank/url/title/snippet)."""
    return [{"rank": i,
             "url": f"https://{engine}-{i}.example/{i}",
             "title": f"{phrase} — результат {i} ({engine})",
             "snippet": f"страница {i} по запросу «{phrase}»: обзор и инструкция"}
            for i in range(1, 11)]


def report_html(phrase, verdict="BUILD", verdict_score=77):
    """HTML отчёта по структуре templates/report.html: те же обязательные разделы.
    Используется и для засева готовых отчётов, и как ответ фальшивого воркера."""
    body = "\n".join(f"<h2>{s}</h2>\n<p>Раздел «{s}» по нише «{phrase}» (тестовые данные).</p>"
                     for s in REPORT_SECTIONS)
    return (f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Ниша: {phrase}</title></head>
<body>
<h1>{phrase}</h1>
<p class="hero"><span class="verdict {verdict}">{verdict}</span>
<span class="bigscore">{verdict_score}</span></p>
<p class="tldr">Короткий вывод по нише «{phrase}»: тестовый отчёт E2E.</p>
{body}
</body></html>
""")


REPORT_FILES = {
    f"{REP_HI_ID}.html": report_html(REP_HI, "BUILD", REP_HI_SCORE),
    f"{REP_LO_ID}.html": report_html(REP_LO, "MAYBE", REP_LO_SCORE),
}


def build(db_path):
    """Собрать засеянную БД по пути db_path (файла ещё нет). Схему заводит wscore."""
    con = wscore.connect(db_path, backfill=False)   # бэкфилл выключен: дерево задаём сами
    try:
        for phrase, pool in CACHE.items():
            resp = {"popular": [{"text": p, "value": f} for p, f in pool]}
            con.execute("INSERT OR REPLACE INTO cache(query, response, ts) VALUES (?, ?, ?)",
                        (phrase, json.dumps(resp, ensure_ascii=False), TS))
        for phrase, freq, status, queried, total, extra in NODES:
            cols = {"phrase": phrase, "freq": freq, "status": status, "queried": queried,
                    "total_refinements": total, "queried_at": TS if queried else None, **extra}
            names = ", ".join(cols)
            con.execute(f"INSERT OR REPLACE INTO node({names}) "
                        f"VALUES ({', '.join('?' * len(cols))})", tuple(cols.values()))
        con.executemany("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)", EDGES)
        con.commit()
        for phrase in SERP_PHRASES:
            wscore.save_serp(con, phrase, {e: {"found": 10_000, "docs": _docs(phrase, e)}
                                           for e in wscore.SERP_ENGINES})
        wscore.save_report(con, REP_HI_ID, REP_HI, f"reports/{REP_HI_ID}.html", created_at=TS)
        wscore.save_report(con, REP_LO_ID, REP_LO, f"reports/{REP_LO_ID}.html", created_at=TS + 1)
        con.commit()
        # Засеяли достижимое состояние? Сервер чинит инвариант FULLY_LOADED на старте, и
        # незаметно переписанный засев ломает браузерные сценарии таймаутами вместо
        # понятной ошибки. Ловим здесь: тронутые строки = засев соврал.
        lied = wscore.repair_fully_loaded(con)
        if lied:
            raise AssertionError(
                f"засев нарушает инвариант FULLY_LOADED: {lied} узлов; "
                f"узел >= FLOOR={wscore.FLOOR} внутри загруженного поддерева должен быть "
                f"queried=1, фронтир (NEW) — ниже FLOOR")
    finally:
        con.close()
    return db_path


def counts(db_path):
    """Сводка засева — для отладки: сколько чего в БД."""
    con = sqlite3.connect(db_path)
    try:
        return {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                for t in ("cache", "node", "edge", "serp", "report", "task")}
    finally:
        con.close()


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/e2e-seed.db")
    out.unlink(missing_ok=True)
    build(out)
    print(out, counts(out), sep="\n")
