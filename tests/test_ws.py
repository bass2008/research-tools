"""Контракты чтения по WebSocket (tech §6.2).

`subscribe` -> `roots` + хвост лога; `root` -> `snapshot`; `expand` -> `children`; форма
каждого события; чтение ничего не подгружает и не мутирует (CQRS, инвариант §10.7).
"""
import pytest

import tasks
import wscore
from conftest import (SNAP, check_node, counts, covered_roots, drain, log_lines, node_row,
                     only, open_probe, recv, reset_subtree, task_done)


# ---------------------------------------------------------------- subscribe

def test_subscribe_sends_roots_log_tail_tasks_and_llm_status(client, log_file):
    log_lines(log_file, timeout=5.0)             # сервер уже записал строку о старте
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "subscribe"})
        events = drain(ws)

    kinds = [k for k, _ in events]
    assert kinds[0] == "roots", "первым идёт список корней-кандидатов"
    roots = only(events, "roots")[0]["roots"]
    assert [r["phrase"] for r in roots] == [SNAP["NEW"]], "корень — узел, который никому не ребёнок"
    check_node(roots[0])
    assert "children" not in roots[0], "roots идёт без вложенных детей (tech §6.2)"

    tail = only(events, "log")[0]
    rows = tail if isinstance(tail, list) else [tail]
    assert rows and all(set(r) == {"ts", "level", "stage", "node", "msg"} for r in rows)

    task_rows = only(events, "task")[0]
    rows = task_rows if isinstance(task_rows, list) else [task_rows]
    assert {"id", "type", "node", "status", "created_at", "started_at", "finished_at",
            "error"} <= set(rows[0])
    assert {r["status"] for r in rows} <= {"QUEUED", "WAITING", "RUNNING", "DONE", "FAILED"}
    assert not any(k == "report" for k, _ in events), "события report больше нет: отчёт у работы"

    status = only(events, "llm_status")[0]
    assert set(status) == {"online", "last_seen_at"} and status["online"] is False


# ---------------------------------------------------------------- root / expand

def test_root_returns_snapshot(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "root", "phrase": SNAP["FULLY_LOADED"]})
        kind, data = recv(ws)

    assert kind == "snapshot"
    assert set(data) == {"root", "children"}
    assert check_node(data["root"])["phrase"] == SNAP["FULLY_LOADED"]
    phrases = {c["phrase"] for c in data["children"]}
    assert SNAP["TRANSACTIONAL"] in phrases and SNAP["ANALYZED"] in phrases
    for child in data["children"]:
        check_node(child)
        assert isinstance(child["children"], list)


def test_expand_returns_children_of_that_node(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "expand", "phrase": SNAP["LOADED"]})
        kind, data = recv(ws)

    assert kind == "children"
    assert data["parent"] == SNAP["LOADED"]
    assert {c["phrase"] for c in data["children"]} == {SNAP["FULLY_LOADED"], SNAP["HEAD"]}


def test_root_of_unknown_phrase_is_missing_not_a_made_up_node(client):
    """Чистое чтение и без выдумывания: фразы нет в дереве — `root: null`, а не узел `NEW`.

    Сочинённый узел выглядел живым (статус `NEW`, кнопки `Load`/`Full load`/`Drill`), то есть
    на опечатке предлагал уйти в платный запрос по несуществующей фразе. Фронтир — это узел,
    который в дереве ЕСТЬ, но не запрошен; ему кнопки загрузки и положены."""
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "root", "phrase": "неизвестная фраза для чтения"})
        kind, data = recv(ws)

    assert kind == "snapshot"
    assert data["root"] is None
    assert data["missing"] == "неизвестная фраза для чтения"
    assert data["children"] == []


def test_root_of_known_but_unloaded_phrase_still_works(client):
    """Фронтир не задет: узел в дереве есть, но не запрошен — отдаётся как обычно."""
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "root", "phrase": SNAP["NEW"]})
        kind, data = recv(ws)

    assert kind == "snapshot"
    assert data["root"] is not None and data["root"]["phrase"] == SNAP["NEW"]
    assert data["root"]["status"] == "NEW"


def test_reading_does_not_mutate(client, snap_con):
    """`root`/`expand` ничего не подгружают и не пишут (инвариант §10.7)."""
    before = counts(snap_con)
    before_node = node_row(snap_con, SNAP["NEW"])
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "subscribe"})
        ws.send_json({"action": "root", "phrase": SNAP["NEW"]})
        ws.send_json({"action": "expand", "phrase": SNAP["NEW"]})
        ws.send_json({"action": "root", "phrase": "ещё одна незагруженная фраза"})
        drain(ws)

    assert counts(snap_con) == before
    assert node_row(snap_con, SNAP["NEW"]) == before_node
    assert wscore.net_calls() == 0


def test_unknown_action_answers_with_warning(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "полетели"})
        kind, data = recv(ws)

    assert kind == "log" and data["level"] == "WARN" and "полетели" in data["msg"]


def test_broken_message_does_not_kill_the_socket(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_text("это не json")
        ws.send_json([1, 2, 3])
        ws.send_json({"action": "expand", "phrase": SNAP["LOADED"]})
        kind, _ = recv(ws)
    assert kind == "children"


# ---------------------------------------------------------------- дельты и события

def test_log_cleared_event(client):
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "subscribe"})
        drain(ws)
        client.post("/api/logs/clear")
        events = drain(ws)

    assert only(events, "log_cleared") == [{}]


# ---------------------------------------------------------------- прогресс краула

@pytest.fixture
def crawl_client(serve, real_db, monkeypatch):
    """Сервер на копии боевой БД, где одно покрытое кэшем поддерево сброшено в «не загружено».

    Модель при этом НЕ пуста, поэтому автобэкфилл не срабатывает, а краул идёт настоящим
    кодом по кэшу — ноль сетевых обращений (testing-plan §3.1)."""
    monkeypatch.setattr(tasks, "PROGRESS_EVERY", 0.0)   # нужен каждый progress, а не раз в 0.5 с
    con = wscore.connect(real_db)
    root, phrases, need, _ = covered_roots(con, min_nodes=5)[0]
    reset_subtree(con, root)
    con.close()
    probe = open_probe(real_db)
    yield serve(real_db), root, need, phrases, probe
    probe.close()


def test_crawl_progress_flows_and_total_may_grow(crawl_client):
    """`progress` капает по ходу краула; `total` — текущая оценка и может расти (tech §6.2)."""
    client, root, need, phrases, probe = crawl_client
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "subscribe"})
        drain(ws)
        task_id = client.post("/api/node/full-load", json={"phrase": root}).json()["task_id"]
        row = task_done(probe, task_id, timeout=60.0)
        events = drain(ws)

    assert row["status"] == "DONE", row["error"]
    progress = only(events, "progress")
    assert progress, "ход краула обязан идти событиями progress"
    for p in progress:
        assert set(p) == {"stage", "node", "done", "total"}
        assert p["stage"] == "full_load" and p["node"] == root
    totals = [p["total"] for p in progress]
    dones = [p["done"] for p in progress]
    assert totals == sorted(totals), "total не должен уменьшаться"
    assert dones == sorted(dones)
    assert totals[-1] >= 2 and totals[-1] > totals[0], "total растёт по ходу краула"
    assert dones[-1] == totals[-1], "к концу краула сделано столько, сколько и планировалось"
    # Со стартовой оценкой не сверяем: частота у Вордстата ползёт в обе стороны, а решение
    # «идти вглубь» принимается по самому свежему значению — узел, ушедший ниже FLOOR,
    # законно не фетчится. Проверяемый инвариант один: после краула фронтир пуст.
    assert dones[-1] > 0 and wscore.unqueried_frontier(probe, root) == []
    assert wscore.unqueried_frontier(probe, root) == [], "поддерево осталось недогруженным"

    assert wscore.net_calls() == 0
    # завершение краула клиент получает как progress + обновление корня, а не поток дельт
    assert any(d["phrase"] == root and d["status"] == "FULLY_LOADED" for d in only(events, "node"))
    assert set(wscore.subtree_phrases(probe, root)) == set(phrases)
    assert len(only(events, "node")) <= 5, "массовую простановку статусов дельтами не шлём"
