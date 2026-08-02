"""Обмен джобами с LLM без настоящей LLM (testing-plan §5) — самый ценный слой.

Фальшивый воркер (`tests/fake_worker.py`) ходит по границе `tech §6.3` в каждом из режимов
таблицы §5, плюс здесь же: дробление операции на джобы, время жизни джоба и «в логе виден
вызывающий» (требование §1.2).
"""
import json

import pytest

import tasks
import wscore
from conftest import (SNAP, HDR, StubCtx, TOKEN, drain, log_lines, node_row, only, task_done,
                      task_row, wait_for)
from fake_worker import REPORT_SECTIONS, FakeWorker


@pytest.fixture
def worker(client):
    """Фабрика фальшивого воркера поверх поднятого сервера."""
    def _make(mode="ok", **kw):
        return FakeWorker(client, TOKEN, mode=mode, **kw)
    return _make


def start_op(client, phrase):
    """Операция-носитель для проверок транспорта: один джоб, узел не меняет.

    Раньше здесь стоял узловой `classify`; после его удаления роль носителя играет разбор
    слов — он тоже одноджобовый, но при этом ничего не пишет в дерево, поэтому проверки
    «узел остался как был» стали строже."""
    r = client.post("/api/stopwords/scan", json={"phrase": phrase})
    assert r.status_code == 200, r.text
    return r.json()["task_id"]


# ---------------------------------------------------------------- таблица режимов §5

def test_correct_answer_moves_status_and_finishes_task(client, snap_con, worker, llm_timeout):
    """Корректный ответ: статусы переходят, данные записаны, задача DONE."""
    llm_timeout(20)
    phrase = SNAP["FULLY_LOADED"]
    task_id = start_op(client, phrase)
    fake = worker("ok")

    signals = fake.run_once(timeout=10)
    row = task_done(snap_con, task_id)

    assert [s["type"] for s in signals] == ["stopwords"]
    assert row["status"] == "DONE", row["error"]
    assert node_row(snap_con, phrase)["task_id"] is None, "блокировка снята"
    result = json.loads(row["result"])
    assert result["root"] == phrase and result["stop"], "предложение сохранено в задаче"
    assert client.get("/api/stopwords").json()["saved"] == [], "но в список ничего не ушло"


def test_agent_error_fails_task_and_leaves_node_intact(client, snap_con, worker, llm_timeout,
                                                       log_file):
    """Ответ с ошибкой: задача FAILED, запись в лог, узел остался как был."""
    llm_timeout(20)
    phrase = SNAP["FULLY_LOADED"]
    before = node_row(snap_con, phrase)
    task_id = start_op(client, phrase)

    worker("error").run_once(timeout=10)
    row = task_done(snap_con, task_id)

    assert row["status"] == "FAILED" and "агент вернул ошибку" in row["error"]
    after = node_row(snap_con, phrase)
    assert after["status"] == before["status"] and after["kind"] == before["kind"]
    assert after["task_id"] is None, "блокировка снята даже при падении"
    assert log_lines(log_file, contains="ERROR")


def test_invalid_json_is_not_swallowed(client, snap_con, worker, llm_timeout):
    """Невалидный JSON — то же, что ошибка: молча не проглатывается."""
    llm_timeout(20)
    task_id = start_op(client, SNAP["FULLY_LOADED"])

    worker("bad_json").run_once(timeout=10)
    row = task_done(snap_con, task_id)

    assert row["status"] == "FAILED" and "JSON" in row["error"]
    assert node_row(snap_con, SNAP["FULLY_LOADED"])["status"] == "FULLY_LOADED"


def test_no_answer_times_out_without_retry(client, snap_con, worker, llm_timeout, log_file):
    """Не отвечает вовсе: срабатывает таймаут, задача FAILED, узел не тронут, ретрая нет."""
    llm_timeout(1.0)
    task_id = start_op(client, SNAP["FULLY_LOADED"])
    fake = worker("silent")

    assert len(fake.run_once(timeout=10)) == 1
    row = task_done(snap_con, task_id)

    assert row["status"] == "FAILED" and "таймаут" in row["error"]
    assert node_row(snap_con, SNAP["FULLY_LOADED"])["status"] == "FULLY_LOADED"
    assert fake.watch(timeout=0.3) == [], "джоб не должен возвращаться в очередь (ретраев нет)"
    assert log_lines(log_file, contains="таймаут")


def test_late_answer_is_dropped_and_server_survives(client, snap_con, worker, llm_timeout,
                                                    log_file):
    """Отвечает после таймаута: результат отброшен, предупреждение в лог, сервер жив."""
    llm_timeout(1.0)
    task_id = start_op(client, SNAP["FULLY_LOADED"])
    fake = worker("late", late_after=2.0)

    fake.run_once(timeout=10)

    assert fake.done == [{"job_id": fake.seen[0]["job_id"], "accepted": False, "mode": "late"}]
    row = task_done(snap_con, task_id)
    assert row["status"] == "FAILED"
    assert node_row(snap_con, SNAP["FULLY_LOADED"])["status"] == "FULLY_LOADED"
    assert log_lines(log_file, contains="ОТБРОШЕН")
    assert client.get("/api/estimate", params={"phrase": SNAP["NEW"]}).status_code == 200


def test_unknown_job_id_is_rejected(client, worker, llm_timeout):
    """Отвечает на неизвестный job_id: accepted false, сервер жив."""
    llm_timeout(3)
    start_op(client, SNAP["FULLY_LOADED"])
    fake = worker("unknown_job")

    fake.run_once(timeout=10)

    assert fake.done and fake.done[-1]["accepted"] is False
    assert fake.submit("вообще-не-джоб", result={}) is False
    assert client.get(f"/internal/llm/job/{'нет-такого'}", headers=HDR).status_code == 404


def test_worker_died_after_taking_job(client, snap_con, worker, llm_timeout):
    """Забрал джоб и умер: таймаут; джоб не вернулся в очередь (резервирования нет, tech §3)."""
    llm_timeout(1.0)
    task_id = start_op(client, SNAP["FULLY_LOADED"])
    fake = worker("die")

    fake.run_once(timeout=10)

    assert len(fake.taken) == 1, "данные джоба забрал"
    assert fake.done == [], "и ничего не вернул"
    assert task_done(snap_con, task_id)["status"] == "FAILED"
    assert fake.watch(timeout=0.3) == []


def test_dispatcher_taking_job_data_is_visible_in_log(client, worker, llm_timeout, log_file):
    """Берёт данные джоба «от лица диспетчера» — это должно быть видно в логе."""
    llm_timeout(5)
    start_op(client, SNAP["FULLY_LOADED"])
    fake = worker("dispatcher_takes")

    fake.run_once(timeout=10)

    lines = log_lines(log_file, contains="get_job")
    assert any("диспетчер" in ln for ln in lines), lines


def test_empty_answer_is_not_a_silent_success(client, snap_con, worker, llm_timeout, log_file):
    """Пустой массив результатов — это отказ: узел не размечен, значит операция не удалась."""
    llm_timeout(20)
    phrase = SNAP["FULLY_LOADED"]
    task_id = start_op(client, phrase)

    worker("ok", answer=lambda job: {"результата нет": []}).run_once(timeout=10)
    row = task_done(snap_con, task_id)

    assert node_row(snap_con, phrase)["status"] == "FULLY_LOADED", "узел действительно не тронут"
    assert row["status"] == "FAILED" or log_lines(log_file, timeout=2.0, contains="ERROR")


def test_caller_is_visible_for_each_internal_call(client, worker, llm_timeout, log_file):
    """Требование §1.2: в логе внутренних вызовов виден вызывающий."""
    llm_timeout(10)
    start_op(client, SNAP["FULLY_LOADED"])
    worker("ok").run_once(timeout=10)

    assert log_lines(log_file, contains="вызов watch (вызвал: диспетчер)")
    assert log_lines(log_file, contains="вызов get_job")
    assert log_lines(log_file, contains="вызов result")


# ---------------------------------------------------------------- дробление операции

# ---------------------------------------------------------------- граница §6.3

def test_watch_returns_signal_only(client, worker, llm_timeout):
    """Тяжёлые данные не проходят через диспетчера (§10.8): watch отдаёт только сигнал."""
    llm_timeout(5)
    start_op(client, SNAP["FULLY_LOADED"])

    signals = worker("silent").watch(timeout=10)

    assert signals and all(set(s) == {"job_id", "type"} for s in signals)


def test_watch_returns_empty_list_on_timeout(client, worker):
    assert worker("ok").watch(timeout=0.2) == []


def test_job_data_lives_until_the_operation_ends(client, snap_con, worker, llm_timeout):
    """Время жизни джоба (tech §6.3): данные доступны после сигнала и недоступны после
    завершения операции."""
    llm_timeout(20)
    task_id = start_op(client, SNAP["FULLY_LOADED"])
    fake = worker("ok")
    signal = fake.watch(timeout=10)[0]

    job = fake.get_job(signal["job_id"])
    assert set(job) == {"job_id", "type", "params", "prompt"}
    assert job["type"] == "stopwords" and job["job_id"] == f"{task_id}:0"
    assert job["params"]["root"] == SNAP["FULLY_LOADED"] and job["params"]["words"]
    assert job["prompt"].strip(), "промпт инлайнится сервером"

    assert fake.submit(signal["job_id"], result=fake.result_for(job)) is True
    task_done(snap_con, task_id)

    assert fake.get_job(signal["job_id"]) is None, "после операции данные джоба недоступны"
    assert fake.submit(signal["job_id"], result={}) is False


@pytest.mark.parametrize("method,path,body", [
    ("get", "/internal/llm/watch", None),
    ("get", "/internal/llm/job/x:0", None),
    ("post", "/internal/llm/result", {"job_id": "x:0", "ok": True}),
    ("post", "/internal/test/enqueue-job", {"type": "stopwords", "params": {}}),
])
def test_internal_endpoints_are_closed_by_token(client, method, path, body):
    call = getattr(client, method)
    kw = {"json": body} if body is not None else {}
    assert call(path, **kw).status_code == 401
    assert call(path, headers={"X-Internal-Token": "wrong-token"}, **kw).status_code == 401


def test_enqueue_bare_job_needs_no_crawl(client, snap_con, worker, llm_timeout):
    """Требование §1.1: джоб с готовыми params можно поставить без краула и без LLM."""
    llm_timeout(20)
    params = {"root": "тестовый корень",
              "words": [{"word": "корень", "phrases": 3, "top_freq": 100, "examples": []}]}
    r = client.post("/internal/test/enqueue-job", headers=HDR,
                    json={"type": "stopwords", "params": params})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"task_id", "job_id"} and body["job_id"] == f"{body['task_id']}:0"

    fake = worker("ok")
    fake.run_once(timeout=10)

    row = task_done(snap_con, body["task_id"])
    assert row["status"] == "DONE"
    assert fake.taken == [body["job_id"]]


def test_enqueue_bare_job_rejects_unknown_type(client):
    r = client.post("/internal/test/enqueue-job", headers=HDR,
                    json={"type": "мусор", "params": {}})
    assert r.status_code == 422 and r.json()["error"] == "invalid"


# ---------------------------------------------------------------- индикатор петли

def test_llm_status_goes_online_after_watch(client, worker):
    """Сервер помнит, когда петля последний раз приходила за джобами (tech §6 «Правила»)."""
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"action": "subscribe"})
        assert only(drain(ws), "llm_status")[-1]["online"] is False

        worker("ok").watch(timeout=0.2)

        ws.send_json({"action": "subscribe"})
        assert only(drain(ws), "llm_status")[-1]["online"] is True


def test_offline_loop_is_warned_before_the_operation(client, snap_con, worker, llm_timeout,
                                                     log_file):
    """LLM offline: задача не отклоняется, но в лог идёт отметка, что она провалится."""
    llm_timeout(0.6)
    task_id = start_op(client, SNAP["FULLY_LOADED"])

    assert task_done(snap_con, task_id)["status"] == "FAILED"
    assert log_lines(log_file, contains="LLM-петля не на связи")


# ---------------------------------------------------------------- отчёт
