"""Контракты HTTP-команд (tech §6.1): тела запросов и ответов, коды 404 / 409 / 422.

Сервер поднят на БД-снимке по статусам, XMLRiver в режиме «только кэш», LLM не запущена —
проверяется именно поверхность API, а не работа операций.
"""
import pytest

import wscore
from conftest import SNAP, SNAP_REPORT_ID, node_row, task_done, task_row

OPS = ("classify", "search", "score", "analyze")


def make_busy(con, phrase, task_id="busy-0001"):
    """Занять узел «чужой» операцией — источник 409 (tech §6.1)."""
    con.execute("INSERT OR REPLACE INTO task(id, type, status, node, created_at) "
                "VALUES (?, 'classify', 'RUNNING', ?, 0)", (task_id, phrase))
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


def test_full_load_marks_subtree_fully_loaded(client, snap_con):
    r = client.post("/api/node/full-load", json={"phrase": SNAP["LOADED"]})
    assert r.status_code == 200
    row = task_done(snap_con, r.json()["task_id"])

    assert row["status"] == "DONE"
    assert node_row(snap_con, SNAP["LOADED"])["status"] == "FULLY_LOADED"
    # узлы, ушедшие дальше по пайплайну, краул не откатывает
    assert node_row(snap_con, SNAP["ANALYZED"])["status"] == "ANALYZED"


def test_op_accepts_only_known_ops(client):
    assert client.post("/api/node/op", json={"phrase": SNAP["TRANSACTIONAL"],
                                             "op": "мусор"}).status_code == 422
    r = client.post("/api/node/op", json={"phrase": SNAP["TRANSACTIONAL"], "op": "search"})
    assert r.status_code == 200 and set(r.json()) == {"task_id"}


def test_drill_returns_task_id(client, snap_con):
    r = client.post("/api/node/drill", json={"phrase": SNAP["FULLY_LOADED"]})
    assert r.status_code == 200
    assert task_row(snap_con, r.json()["task_id"])["type"] == "drill"


def test_kind_is_synchronous_and_creates_no_task(client, snap_con):
    """Fix kind — синхронно, без задачи: kind и статус меняются вместе (tech §6.1)."""
    before = snap_con.execute("SELECT COUNT(*) FROM task").fetchone()[0]
    r = client.post("/api/node/kind", json={"phrase": SNAP["CATEGORY"], "kind": "transactional"})

    assert r.status_code == 200
    assert r.json() == {"phrase": SNAP["CATEGORY"], "kind": "transactional",
                        "status": "TRANSACTIONAL"}
    assert snap_con.execute("SELECT COUNT(*) FROM task").fetchone()[0] == before
    row = node_row(snap_con, SNAP["CATEGORY"])
    assert (row["kind"], row["status"]) == ("transactional", "TRANSACTIONAL")


@pytest.mark.parametrize("kind", ["transactional", "informational", "navigational", "category"])
def test_kind_accepts_all_four_kinds(client, kind):
    r = client.post("/api/node/kind", json={"phrase": SNAP["TRANSACTIONAL"], "kind": kind})
    assert r.status_code == 200
    assert r.json()["status"] == wscore.KIND_STATUS[kind]


# ---------------------------------------------------------------- 404 / 409 / 422

@pytest.mark.parametrize("path,body", [
    ("/api/node/load", {"phrase": "нет такой фразы"}),
    ("/api/node/full-load", {"phrase": "нет такой фразы"}),
    ("/api/node/op", {"phrase": "нет такой фразы", "op": "search"}),
    ("/api/node/drill", {"phrase": "нет такой фразы"}),
    ("/api/node/kind", {"phrase": "нет такой фразы", "kind": "transactional"}),
])
def test_unknown_phrase_is_404(client, path, body):
    r = client.post(path, json=body)
    assert r.status_code == 404
    assert r.json()["error"] == "not_found" and r.json()["detail"]


def test_busy_node_is_409(client, snap_con):
    make_busy(snap_con, SNAP["TRANSACTIONAL"])
    r = client.post("/api/node/op", json={"phrase": SNAP["TRANSACTIONAL"], "op": "search"})
    assert r.status_code == 409
    assert r.json()["error"] == "conflict"


def test_busy_ancestor_is_409(client, snap_con):
    """Занят предок — заняты и его потомки (tech §6 «Правила»)."""
    make_busy(snap_con, SNAP["LOADED"])
    r = client.post("/api/node/op", json={"phrase": SNAP["SEARCHED"], "op": "score"})
    assert r.status_code == 409
    assert "предок" in r.json()["detail"]


def test_disallowed_transition_is_422(client):
    r = client.post("/api/node/op", json={"phrase": SNAP["NEW"], "op": "classify"})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid" and "NEW" in r.json()["detail"]


def test_unknown_kind_is_422(client):
    r = client.post("/api/node/kind", json={"phrase": SNAP["CATEGORY"], "kind": "мусор"})
    assert r.status_code == 422
    assert r.json()["error"] == "invalid"


def test_malformed_body_is_422_with_same_error_shape(client):
    r = client.post("/api/node/op", json={"op": "search"})
    assert r.status_code == 422
    assert set(r.json()) == {"error", "detail"} and r.json()["error"] == "invalid"


def test_409_beats_422(client, snap_con):
    """Занятость проверяется раньше допустимости перехода — иначе 422 маскирует конфликт."""
    make_busy(snap_con, SNAP["NEW"])
    assert client.post("/api/node/op",
                       json={"phrase": SNAP["NEW"], "op": "classify"}).status_code == 409


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
