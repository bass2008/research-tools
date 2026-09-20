"""Контракты HTTP-команд (tech §6.1): тела запросов и ответов, коды 404 / 409 / 422.

Сервер поднят на БД-снимке по статусам, XMLRiver в режиме «только кэш», LLM не запущена —
проверяется именно поверхность API, а не работа операций.
"""
import asyncio
import json

import pytest

import wscore
from conftest import (SNAP, SNAP_REPORT_ID, drain, node_row, only, seed_cache, task_done,
                      task_row)

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


def test_tasks_clear_deletes_entire_journal(client, snap_con):
    snap_con.execute(
        "INSERT INTO task(id, type, status, node, created_at) "
        "VALUES ('task-running', 'full_load', 'RUNNING', ?, 0)",
        (SNAP["LOADED"],),
    )
    snap_con.commit()

    r = client.post("/api/tasks/clear")

    assert r.status_code == 200
    assert r.json() == {"ok": True, "deleted": 3}
    assert snap_con.execute("SELECT COUNT(*) FROM task").fetchone()[0] == 0


def test_cancel_removes_a_task_nobody_took(client, snap_con):
    """`WAITING` — джоб лежит в очереди, работы не идёт: снять его безопасно.

    Так снимают задачу, поставленную не на то семейство модели: нужной петли нет на связи,
    и без отмены задача просто досидит до таймаута операции."""
    snap_con.execute(
        "INSERT INTO task(id, type, status, node, created_at, params) "
        "VALUES ('task-waiting', 'needs_analyze_adv', 'WAITING', 'работа', 0, "
        "'{\"tree_id\": \"t\", \"work\": \"работа\", \"model_family\": \"codex\"}')")
    snap_con.commit()

    r = client.post("/api/task/task-waiting/cancel")

    assert r.status_code == 200, r.text
    row = snap_con.execute("SELECT status, error FROM task WHERE id = 'task-waiting'").fetchone()
    assert row["status"] == "FAILED" and "отменена" in row["error"]


def test_cancel_refuses_a_task_that_is_already_working(client, snap_con):
    """`RUNNING` не отменяем: агент уже работает и вернёт результат, которому некуда лечь."""
    snap_con.execute(
        "INSERT INTO task(id, type, status, node, created_at) "
        "VALUES ('task-run', 'needs_analyze', 'RUNNING', 'работа', 0)")
    snap_con.commit()

    assert client.post("/api/task/task-run/cancel").status_code == 409
    assert client.post("/api/task/нет-такой/cancel").status_code == 404


def test_retry_reruns_the_same_task_row(client, snap_con):
    """Повтор — продолжение той же попытки, а не новая задача.

    Новая строка плодила в журнале двойников, а вкладка считала единицу свободной и кнопку
    не гасила. Проверки при этом те же, что при первом запуске (см. соседние тесты)."""
    snap_con.execute(
        "INSERT INTO task(id, type, status, node, created_at, started_at, finished_at, error) "
        "VALUES ('task-failed', 'full_load', 'FAILED', ?, 0, 1, 2, 'таймаут')",
        (SNAP["LOADED"],),
    )
    snap_con.commit()
    before = snap_con.execute("SELECT COUNT(*) FROM task").fetchone()[0]

    r = client.post("/api/task/task-failed/retry")

    assert r.status_code == 200, r.text
    assert r.json()["task_id"] == "task-failed", "повтор не заводит вторую строку"
    assert snap_con.execute("SELECT COUNT(*) FROM task").fetchone()[0] == before
    row = snap_con.execute(
        "SELECT type, node, status, started_at, finished_at, error FROM task "
        "WHERE id = 'task-failed'").fetchone()
    assert (row["type"], row["node"]) == ("full_load", SNAP["LOADED"])
    assert row["status"] in ("QUEUED", "RUNNING", "DONE", "FAILED")
    assert row["error"] is None and row["finished_at"] is None, "след прошлого падения стёрт"


def test_retry_refuses_a_task_that_did_not_fail(client, snap_con):
    """Повторяем только упавшую: у DONE повтор — это новый запуск руками, а не «ещё раз»."""
    snap_con.execute(
        "INSERT INTO task(id, type, status, node, created_at) "
        "VALUES ('task-ok', 'full_load', 'DONE', ?, 0)", (SNAP["LOADED"],))
    snap_con.commit()

    assert client.post("/api/task/task-ok/retry").status_code == 409
    assert client.post("/api/task/нет-такой/retry").status_code == 404


def test_report_is_served_as_static(client, reports_dir):
    """Отчёт — файл на диске, раздаётся статикой (tech §6 «Правила»)."""
    (reports_dir / f"{SNAP_REPORT_ID}.html").write_text("<h1>отчёт</h1>", encoding="utf-8")
    r = client.get(f"/reports/{SNAP_REPORT_ID}.html")
    assert r.status_code == 200 and "отчёт" in r.text
    assert client.get("/reports/нет-такого.html").status_code == 404


# ---------------------------------------------------------------- области списка и домены

def test_stopwords_api_addresses_a_node_and_leaves_other_branches_alone(client, snap_con):
    """Список адресуется узлу: чужая ветка тем же словом не задета."""
    st = client.get("/api/stopwords").json()
    assert {"saved", "suggestion", "scopes", "kinds"} <= set(st)
    assert st["scopes"][0]["scope_kind"] == "global"

    r = client.post("/api/stopwords", json={"words": [{"word": "фон", "kind": "unwanted"}],
                                            "scope_kind": "node", "scope_id": SNAP["LOADED"]})
    assert r.status_code == 200 and r.json()["added"] == 1
    saved = r.json()["saved"]
    assert saved[0]["scope_kind"] == "node" and saved[0]["scope_id"] == SNAP["LOADED"]

    stops = wscore.stop_filter(snap_con)
    assert wscore.is_stopped(SNAP["FULLY_LOADED"], stops), "внутри своей ветки — запрет"
    assert not wscore.is_stopped("телеграм фон", stops), "снаружи слово не действует"

    # удаление адресное: тот же вызов без области ничего не находит
    assert client.request("DELETE", "/api/stopwords",
                          json={"words": ["фон"]}).json()["removed"] == 0
    assert client.request("DELETE", "/api/stopwords",
                          json={"words": ["фон"], "scope_kind": "node",
                                "scope_id": SNAP["LOADED"]}).json()["removed"] == 1


def test_stopwords_api_rejects_unknown_owner(client):
    """Адресат должен существовать — иначе список повис бы в никуда (И5)."""
    for scope in ({"scope_kind": "node", "scope_id": "такой фразы нет"},
                  {"scope_kind": "domain", "scope_id": "нет-домена"},
                  {"scope_kind": "мусор", "scope_id": "x"}):
        r = client.post("/api/stopwords",
                        json={"words": [{"word": "новости", "kind": "unwanted"}], **scope})
        assert r.status_code == 422, scope
    assert client.get("/api/stopwords").json()["saved"] == []


def test_domain_is_made_from_a_node_and_takes_its_stopwords(client, snap_con):
    """Домен из узла: узел уходит из отдельных корней, его список переезжает домену (И3)."""
    client.post("/api/stopwords", json={"words": [{"word": "фон", "kind": "unwanted"}],
                                        "scope_kind": "node", "scope_id": SNAP["NEW"]})

    r = client.post("/api/domains", json={"phrase": SNAP["NEW"], "name": "Фоны"})
    assert r.status_code == 200, r.text
    did = r.json()["id"]
    assert r.json()["members"] == [SNAP["NEW"]] and r.json()["stopwords_moved"] == 1

    saved = client.get("/api/stopwords").json()["saved"]
    assert [(w["scope_kind"], w["scope_id"]) for w in saved] == [("domain", did)]
    assert wscore.domain_of(snap_con, SNAP["NEW"]) == did
    assert SNAP["NEW"] not in [n["phrase"] for n in wscore.root_candidates(snap_con)], \
        "член домена не дублируется отдельным корнем"

    # второй раз тот же узел в домен не принять
    assert client.post("/api/domains", json={"phrase": SNAP["NEW"]}).status_code == 422
    assert client.post("/api/domains/member",
                       json={"domain_id": did, "phrase": SNAP["NEW"]}).status_code == 422
    assert client.post("/api/domains/member",
                       json={"domain_id": "нет-такого", "phrase": SNAP["HEAD"]}).status_code == 422
    assert client.post("/api/domains", json={"phrase": "фразы нет в дереве"}).status_code == 404


def test_domain_member_join_merges_stoplists_without_duplicates(client, snap_con):
    """Приём в домен: слова узла переезжают, повтор не создаёт дубля (И2, И3)."""
    did = client.post("/api/domains", json={"phrase": SNAP["NEW"], "name": "Фоны"}).json()["id"]
    client.post("/api/stopwords", json={"words": [{"word": "видео", "kind": "unwanted"}],
                                        "scope_kind": "domain", "scope_id": did})
    client.post("/api/stopwords", json={"words": [{"word": "видео", "kind": "unwanted"},
                                                  {"word": "капкут", "kind": "brand"}],
                                        "scope_kind": "node", "scope_id": SNAP["HEAD"]})

    r = client.post("/api/domains/member", json={"domain_id": did, "phrase": SNAP["HEAD"]})
    assert r.status_code == 200 and r.json()["stopwords_moved"] == 1, "переехало только новое"
    assert r.json()["members"] == [SNAP["NEW"], SNAP["HEAD"]]

    saved = client.get("/api/stopwords").json()["saved"]
    assert {w["word"] for w in saved} == {"видео", "капкут"}
    assert {(w["scope_kind"], w["scope_id"]) for w in saved} == {("domain", did)}
    assert wscore.stopword_violations(snap_con) == []

    # члену домена своего списка больше не завести
    assert client.post("/api/stopwords",
                       json={"words": [{"word": "фон", "kind": "unwanted"}],
                             "scope_kind": "node", "scope_id": SNAP["HEAD"]}).status_code == 422


def test_domain_change_reaches_open_clients(client, snap_con):
    """Новый домен приезжает открытым клиентам событием roots: член домена не должен
    остаться нарисованным отдельным корнем."""
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "subscribe"})
        drain(ws)
        client.post("/api/domains", json={"phrase": SNAP["NEW"], "name": "Фоны"})
        roots = only(drain(ws), "roots")

    assert roots, "события roots не было"
    data = roots[-1]
    assert [d["name"] for d in data["domains"]] == ["Фоны"]
    assert SNAP["NEW"] not in [n["phrase"] for n in data["roots"]]


def test_load_of_a_stopped_phrase_is_refused(client, snap_con):
    """`load` — покупка пула одной фразы, а список исключений именно от неё и отказывается.
    Раньше проверка стояла только на заведении корня, и узел под запретом покупался."""
    client.post("/api/stopwords", json={"words": [{"word": "фон", "kind": "unwanted"}],
                                        "scope_kind": "node", "scope_id": SNAP["LOADED"]})
    r = client.post("/api/node/load", json={"phrase": SNAP["FULLY_LOADED"]})
    assert r.status_code == 422 and "стоп-слов" in r.json()["detail"]
    assert snap_con.execute("SELECT COUNT(*) FROM task WHERE type = 'load' AND node = ?",
                            (SNAP["FULLY_LOADED"],)).fetchone()[0] == 0, "задачи на покупку нет"

    # вне области слово не мешает: соседняя ветка грузится обычным порядком
    assert client.post("/api/node/load", json={"phrase": SNAP["NEW"]}).status_code == 200


def test_stopwords_reject_a_multiword_entry(client):
    """Сравнение идёт со словом фразы: пара слов не совпадёт никогда, и принимать её —
    значит завести заведомо мёртвое исключение."""
    r = client.post("/api/stopwords",
                    json={"words": [{"word": "рабочая тетрадь", "kind": "unwanted"}]})
    assert r.status_code == 422 and "одно слово" in r.json()["detail"]
    assert client.get("/api/stopwords").json()["saved"] == []

    # по отдельности — принимаются
    r = client.post("/api/stopwords", json={"words": [{"word": "рабочая", "kind": "unwanted"},
                                                      {"word": "тетрадь", "kind": "unwanted"}]})
    assert r.json()["added"] == 2


# ---------------------------------------------------------------- сборка по нескольким веткам

def test_needs_build_takes_an_array_of_branches(client, snap_con):
    """Единица сборки — набор веток: одну работу пишут по-разному, и порознь ветки дают
    два дерева-двойника с разделённым пулом."""
    for phrase in (SNAP["LOADED"], SNAP["HEAD"]):
        snap_con.execute("UPDATE node SET status = 'FULLY_LOADED' WHERE phrase = ?", (phrase,))
    snap_con.commit()

    r = client.post("/api/needs/build", json={"phrases": [SNAP["HEAD"], SNAP["LOADED"]]})
    assert r.status_code == 200, r.text
    assert r.json()["roots"] == [SNAP["HEAD"], SNAP["LOADED"]]

    row = task_row(snap_con, r.json()["task_id"])
    assert row["type"] == "needs_build" and row["node"] == SNAP["HEAD"]
    params = json.loads(row["params"])
    assert params["roots"] == [SNAP["HEAD"], SNAP["LOADED"]]
    # заняты ОБЕ ветки: вторая сборка не должна залезть в ту же
    assert params["lock"] == [SNAP["HEAD"], SNAP["LOADED"]]
    assert client.post("/api/needs/build",
                       json={"phrases": [SNAP["LOADED"]]}).status_code == 409


def test_needs_build_still_takes_a_single_phrase(client, snap_con):
    """Старый вход остаётся: одна фраза — это набор из одной ветки."""
    snap_con.execute("UPDATE node SET status = 'FULLY_LOADED' WHERE phrase = ?",
                     (SNAP["LOADED"],))
    snap_con.commit()
    r = client.post("/api/needs/build", json={"phrase": SNAP["LOADED"]})
    assert r.status_code == 200 and r.json()["roots"] == [SNAP["LOADED"]]
    # у набора из одной ветки служебного списка блокировок нет — блокируется сам узел
    assert "lock" not in json.loads(task_row(snap_con, r.json()["task_id"])["params"])


def test_needs_build_by_domain_collects_every_key(client, snap_con):
    """Кнопка над доменом собирает ОДНО дерево по всем его ключам."""
    did = client.post("/api/domains", json={"phrase": SNAP["LOADED"], "name": "Фоны"}).json()["id"]
    client.post("/api/domains/member", json={"domain_id": did, "phrase": SNAP["HEAD"]})
    for phrase in (SNAP["LOADED"], SNAP["HEAD"]):
        snap_con.execute("UPDATE node SET status = 'FULLY_LOADED' WHERE phrase = ?", (phrase,))
    snap_con.commit()

    r = client.post("/api/needs/build", json={"domain_id": did})
    assert r.status_code == 200, r.text
    assert r.json()["roots"] == [SNAP["LOADED"], SNAP["HEAD"]], "порядок ключей домена"
    assert client.post("/api/needs/build", json={"domain_id": "нет-домена"}).status_code == 404


def test_needs_build_refuses_a_branch_that_is_not_loaded(client, snap_con):
    """Недогруженная ветка исказила бы сравнение — отбиваем весь набор, называя виновных."""
    snap_con.execute("UPDATE node SET status = 'FULLY_LOADED' WHERE phrase = ?",
                     (SNAP["LOADED"],))
    snap_con.commit()
    r = client.post("/api/needs/build", json={"phrases": [SNAP["LOADED"], SNAP["NEW"]]})
    assert r.status_code == 422 and SNAP["NEW"] in r.json()["detail"]
    assert snap_con.execute("SELECT COUNT(*) FROM task WHERE type = 'needs_build'").fetchone()[0] == 0
    assert client.post("/api/needs/build", json={"phrases": []}).status_code == 422


# ---------------------------------------------------------------- подсказки

def test_suggest_returns_what_is_cached_and_names_empty(client, snap_con):
    """Ручка подсказок отдаёт сохранённое без единого платного вызова и отдельно называет
    корни, по которым не подсказывают ничего: это результат замера, а не ошибка."""
    wscore.save_suggest(snap_con, "google", "2840",
                        {"destiny matrix": ["destiny matrix calculator"],
                         "arcanum 7 destiny matrix": []})

    r = client.post("/api/suggest", json={"phrases": ["destiny matrix", "arcanum 7 destiny matrix"]})
    assert r.status_code == 200
    body = r.json()
    assert body["suggests"]["destiny matrix"] == ["destiny matrix calculator"]
    assert body["empty"] == ["arcanum 7 destiny matrix"]


def test_suggest_rejects_empty_list_and_unknown_source(client):
    assert client.post("/api/suggest", json={"phrases": ["  "]}).status_code == 422
    assert client.post("/api/suggest",
                       json={"phrases": ["x"], "source": "bing"}).status_code == 422


def test_suggest_does_not_buy_in_cache_only(client, snap_con):
    """Промах в режиме «только кэш» — это 502 с объяснением, а не тихая покупка."""
    r = client.post("/api/suggest", json={"phrases": ["чего в базе нет"]})
    assert r.status_code == 502
    assert "только кэш" in r.json()["detail"]
