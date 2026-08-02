"""Контракты HTTP-команд (tech §6.1): тела запросов и ответов, коды 404 / 409 / 422.

Сервер поднят на БД-снимке по статусам, XMLRiver в режиме «только кэш», LLM не запущена —
проверяется именно поверхность API, а не работа операций.
"""
import asyncio

import pytest

import wscore
from conftest import SNAP, SNAP_REPORT_ID, node_row, seed_cache, task_done, task_row

def make_busy(con, phrase, task_id="busy-0001"):
    """Занять узел «чужой» операцией — источник 409 (tech §6.1)."""
    con.execute("INSERT OR REPLACE INTO task(id, type, status, node, created_at) "
                "VALUES (?, 'full_load', 'RUNNING', ?, 0)", (task_id, phrase))
    con.execute("UPDATE node SET task_id = ? WHERE phrase = ?", (task_id, phrase))
    con.commit()
    return task_id


# ---------------------------------------------------------------- ack-команды

def test_load_returns_task_id_and_runs(client, snap_con):
    r = client.post("/api/node/load", json={"phrase": SNAP["NEW"]})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"task_id"}, "ответ команды — ровно {task_id} (ack)"

    row = task_done(snap_con, body["task_id"])
    assert (row["type"], row["status"], row["node"]) == ("load", "DONE", SNAP["NEW"])
    assert node_row(snap_con, SNAP["NEW"])["status"] == "LOADED"
    assert node_row(snap_con, SNAP["NEW"])["task_id"] is None, "блокировка снята"


def test_add_root_creates_independent_node_and_loads_it(client, snap_con):
    """Новый корень: единственный вход для фразы, которой в дереве нет.

    Корни независимы — у нового узла нет родителя, он не привязан к уже существующим."""
    seed_cache(snap_con, {"телеграм": [("телеграм", 900), ("телеграм каналы", 300)]})

    r = client.post("/api/node/root", json={"phrase": "  Телеграм  "})
    assert r.status_code == 200
    row = task_done(snap_con, r.json()["task_id"])
    assert (row["type"], row["node"]) == ("load", "телеграм"), "фраза нормализована"

    node = node_row(snap_con, "телеграм")
    assert node["status"] == "LOADED" and node["freq"] == 900
    assert snap_con.execute("SELECT COUNT(*) FROM edge WHERE child = 'телеграм'").fetchone()[0] == 0, \
        "корень ни от кого не зависит"
    assert "телеграм" in [n["phrase"] for n in wscore.root_candidates(snap_con, 50)]


def test_add_root_rejects_existing_phrase_and_empty(client):
    assert client.post("/api/node/root", json={"phrase": SNAP["NEW"]}).status_code == 409
    assert client.post("/api/node/root", json={"phrase": "   "}).status_code == 422


def test_full_load_marks_subtree_fully_loaded(client, snap_con):
    r = client.post("/api/node/full-load", json={"phrase": SNAP["LOADED"]})
    assert r.status_code == 200
    row = task_done(snap_con, r.json()["task_id"])

    assert row["status"] == "DONE"
    assert node_row(snap_con, SNAP["LOADED"])["status"] == "FULLY_LOADED"
    # узлы, ушедшие дальше по пайплайну, краул не откатывает
    assert node_row(snap_con, SNAP["ANALYZED"])["status"] == "ANALYZED"


# ---------------------------------------------------------------- стоп-слова

def test_stopwords_are_saved_by_the_user_and_filter_the_crawl(client, snap_con):
    """Список исключений наполняет человек, а краул по нему НЕ покупает узлы."""
    assert client.get("/api/stopwords").json()["saved"] == []

    r = client.post("/api/stopwords", json={"words": [{"word": "Проститутки", "kind": "stop"},
                                                      {"word": "подоляка", "kind": "brand"}]})
    assert r.status_code == 200 and r.json()["added"] == 2
    assert {w["word"] for w in r.json()["saved"]} == {"проститутки", "подоляка"}

    # сравнение по основе слова: в фразе другая словоформа
    stems = wscore.stop_stems(snap_con)
    assert wscore.is_stopped("телеграм москва проститутка", stems)
    assert not wscore.is_stopped("телеграм москва", stems)

    r = client.request("DELETE", "/api/stopwords", json={"words": ["проститутки"]})
    assert r.json()["removed"] == 1
    assert [w["word"] for w in r.json()["saved"]] == ["подоляка"]


def test_stopwords_reject_unknown_kind(client):
    r = client.post("/api/stopwords", json={"words": [{"word": "новости", "kind": "мусор"}]})
    assert r.status_code == 422
    assert client.get("/api/stopwords").json()["saved"] == []


def test_stopword_phrases_are_not_bought_and_do_not_break_fully_loaded(snap_con, tmp_path):
    """Узел под стоп-словом остаётся в дереве фактом, но фронтиром не считается:
    иначе краул гонялся бы за ним по кругу, а починка снимала бы FULLY_LOADED."""
    con = wscore.connect(tmp_path / "stop.db")
    seed_cache(con, {"телеграм": [("телеграм", 1000), ("телеграм каналы", 400),
                                  ("телеграм проститутки", 300)]})
    wscore.add_stopwords(con, [("проститутки", "stop")])

    res = asyncio.run(wscore.crawl_subtree(con, "телеграм"))

    assert res["skipped"] == 1, "узел под стоп-словом не покупается"
    assert wscore.unqueried_frontier(con, "телеграм") == [], "и фронтиром не считается"
    assert node_row(con, "телеграм проститутки")["queried"] == 0
    assert node_row(con, "телеграм проститутки")["freq"] == 300, "как факт узел остаётся"
    assert node_row(con, "телеграм")["status"] == "FULLY_LOADED"
    assert wscore.repair_fully_loaded(con) == 0, "починка не откатывает статус"
    con.close()


def test_stopped_phrase_costs_nothing_and_closes_the_question(client, snap_con, tmp_path):
    """Фраза под стоп-словом не покупается — ни одного запроса, даже за её собственным пулом.

    Уточнения такой фразы содержат её слова, значит тоже под запретом. Статус при этом
    ставится: вопрос по ветке закрыт, висеть в NEW ей незачем."""
    wscore.add_stopwords(snap_con, [("фон", "stop")])
    r = client.post("/api/node/full-load", json={"phrase": SNAP["NEW"]})
    assert r.status_code == 200
    task_done(snap_con, r.json()["task_id"])
    assert node_row(snap_con, SNAP["NEW"])["status"] == "FULLY_LOADED"
    assert node_row(snap_con, SNAP["NEW"])["queried"] == 0, "пул не покупали"
    # завести корнем фразу, которая сама под запретом, по-прежнему нельзя
    assert client.post("/api/node/root", json={"phrase": "убрать фон совсем"}).status_code == 422

    # краул на стоп-корне не тратит фетчей и возвращает узел под запретом
    con = wscore.connect(tmp_path / "stopped.db")
    seed_cache(con, {"фон": [("фон", 1000), ("фон видео", 400)]})
    wscore.upsert_node(con, "фон", freq=1000)
    wscore.add_stopwords(con, [("фон", "stop")])
    res = asyncio.run(wscore.crawl_subtree(con, "фон"))
    assert res["fetched"] == 0 and res["skipped"] == 1
    assert node_row(con, "фон")["queried"] == 0

    # сняли слово — ветка снова просится в краул: починка инварианта вернёт её в LOADED
    wscore.remove_stopwords(con, ["фон"])
    assert wscore.repair_fully_loaded(con) == 1
    assert node_row(con, "фон")["status"] == "LOADED"
    con.close()


def test_stopwords_scan_asks_only_about_unsaved_words(snap_con, tmp_path):
    """Уже сохранённые слова и слова самого корня повторно не классифицируются."""
    con = wscore.connect(tmp_path / "words.db")
    seed_cache(con, {"телеграм": [("телеграм", 1000), ("телеграм москва", 400),
                                  ("телеграм москва вакансии", 300)]})
    asyncio.run(wscore.crawl_subtree(con, "телеграм"))

    words, total = wscore.word_stats(con, "телеграм")
    assert "телеграм" not in [w["word"] for w in words], "слово корня разбирать незачем"
    assert {"москва", "вакансии"} <= {w["word"] for w in words}

    words, _ = wscore.word_stats(con, "телеграм", exclude=["москве"])
    assert "москва" not in [w["word"] for w in words], "исключаем по основе, не по строке"
    con.close()


# ---------------------------------------------------------------- 404 / 409 / 422

@pytest.mark.parametrize("path,body", [
    ("/api/node/load", {"phrase": "нет такой фразы"}),
    ("/api/node/full-load", {"phrase": "нет такой фразы"}),
    ("/api/stopwords/scan", {"phrase": "нет такой фразы"}),
])
def test_unknown_phrase_is_404(client, path, body):
    r = client.post(path, json=body)
    assert r.status_code == 404
    assert r.json()["error"] == "not_found" and r.json()["detail"]


def test_busy_node_is_409(client, snap_con):
    make_busy(snap_con, SNAP["NEW"])
    r = client.post("/api/node/load", json={"phrase": SNAP["NEW"]})
    assert r.status_code == 409
    assert r.json()["error"] == "conflict"


def test_busy_ancestor_is_409(client, snap_con):
    """Занят предок — заняты и его потомки (tech §6 «Правила»)."""
    make_busy(snap_con, SNAP["LOADED"])
    r = client.post("/api/node/full-load", json={"phrase": SNAP["FULLY_LOADED"]})
    assert r.status_code == 409
    assert "предок" in r.json()["detail"]


def test_disallowed_transition_is_422(client):
    """`load` — только из NEW: узел уже загружен, повторная загрузка ничего не даёт."""
    r = client.post("/api/node/load", json={"phrase": SNAP["LOADED"]})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid" and "LOADED" in r.json()["detail"]


def test_malformed_body_is_422_with_same_error_shape(client):
    r = client.post("/api/node/load", json={})
    assert r.status_code == 422
    assert set(r.json()) == {"error", "detail"} and r.json()["error"] == "invalid"


def test_409_beats_422(client, snap_con):
    """Занятость проверяется раньше допустимости перехода — иначе 422 маскирует конфликт."""
    make_busy(snap_con, SNAP["LOADED"])
    assert client.post("/api/node/load",
                       json={"phrase": SNAP["LOADED"]}).status_code == 409


# ---------------------------------------------------------------- прочие ручки

def test_estimate_returns_lower_bound(client):
    r = client.get("/api/estimate", params={"phrase": SNAP["NEW"]})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"nodes", "requests"}
    assert isinstance(body["nodes"], int) and isinstance(body["requests"], int)
    assert body["nodes"] >= 1


def test_logs_clear_truncates_file(client, log_file):
    from conftest import log_lines
    log_lines(log_file, timeout=5.0)              # сервер уже написал строку о старте
    r = client.post("/api/logs/clear")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert log_file.read_text(encoding="utf-8") == ""


def test_report_is_served_as_static(client, reports_dir):
    """Отчёт — файл на диске, раздаётся статикой (tech §6 «Правила»)."""
    (reports_dir / f"{SNAP_REPORT_ID}.html").write_text("<h1>отчёт</h1>", encoding="utf-8")
    r = client.get(f"/reports/{SNAP_REPORT_ID}.html")
    assert r.status_code == 200 and "отчёт" in r.text
    assert client.get("/reports/нет-такого.html").status_code == 404
