"""Второй слой: чтение папки с деревьями потребностей и разбор работы.

Слой файловый и одноразовый, поэтому проверяем ровно две вещи: что чтение папки не роняет
сервер на любом мусоре, и что `Analyze` на работе делает обещанную цепочку — выдача (из
оплаченного кэша `serp`) и затем Opus, а результат ложится файлом рядом с деревом, НЕ в `node`.
"""
import json
import time

import pytest

import needs_layer
import wscore
from conftest import SNAP, TOKEN, node_row, task_done, task_row, wait_for
from fake_worker import FakeWorker

TREE_ID = "t-001"
WORK = "убрать фон с картинки"
GAP_WORK = "убрать фон на видео"


def tree_doc(phrases, gap_phrases):
    return {"condition": "онлайн · бесплатно",
            "works": [
                {"name": WORK, "score": 40, "score_why": "занято, но выдачу стоит глянуть",
                 "phrases": phrases, "top_freq": 1000, "phrase_count": len(phrases),
                 "occupied_by": "remove.bg", "unclear": False, "gap_candidate": False,
                 "needs_serp": True, "serp_question": "кто в топе", "why": "одна работа",
                 "segments": []},
                {"name": GAP_WORK, "score": 85, "score_why": "узко и никем не закрыто",
                 "phrases": gap_phrases, "top_freq": 40,
                 "phrase_count": len(gap_phrases), "occupied_by": None, "unclear": False,
                 "gap_candidate": True, "needs_serp": False, "serp_question": None,
                 "why": "узко", "segments": []},
            ],
            "excluded": [{"phrase": SNAP["HEAD"], "why": "condition", "note": None}]}


@pytest.fixture
def needs_dir(tmp_path, monkeypatch):
    """Папку слоя уводим в tmp: боевую logs/needs-lab тесты не трогают."""
    d = tmp_path / "needs-lab"
    d.mkdir()
    monkeypatch.setattr(needs_layer, "NEEDS_DIR", d)
    return d


def put_tree(needs_dir, tree_id, tree, params=None):
    d = needs_dir / tree_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "accepted.json").write_text(json.dumps(tree, ensure_ascii=False), encoding="utf-8")
    if params is not None:
        (d / "params.json").write_text(json.dumps(params, ensure_ascii=False), encoding="utf-8")
    return d


def docs(phrase, engine):
    return [{"rank": i, "url": f"https://{engine}-{i}.example/{i}",
             "title": f"{phrase} — {i}", "snippet": f"страница {i}"} for i in range(1, 11)]


@pytest.fixture
def seeded(needs_dir, snap_con):
    """Дерево из двух работ на фразах снимка плюс засеянная выдача.

    Выдачу засеваем намеренно: тесты идут в режиме «только кэш» (платных запросов ноль), а
    разбор работы по контракту сперва требует выдачу. Без засева он честно падает — это
    проверяет отдельный тест ниже."""
    phrases = [SNAP["TRANSACTIONAL"], SNAP["LOADED"]]
    gap = [SNAP["NEW"]]
    params = {"root": SNAP["FULLY_LOADED"], "root_freq": 1000, "min_freq": 50,
              "nodes": [{"phrase": p, "freq": f, "children": []} for p, f in
                        ((SNAP["TRANSACTIONAL"], 900), (SNAP["LOADED"], 500),
                         (SNAP["NEW"], 40), (SNAP["HEAD"], 90000))]}
    put_tree(needs_dir, TREE_ID, tree_doc(phrases, gap), params)
    wscore.save_serp(snap_con, SNAP["TRANSACTIONAL"],
                     {e: {"found": 1000, "docs": docs(SNAP["TRANSACTIONAL"], e)}
                      for e in wscore.SERP_ENGINES})
    snap_con.commit()
    return phrases, gap


# ---------- чтение папки ----------

def test_rows_and_detail_join_freqs(client, seeded):
    row = client.get("/api/needs/trees").json()["trees"][0]
    assert row["id"] == TREE_ID and row["works"] == 2 and row["gaps"] == 1
    assert row["root"] == SNAP["FULLY_LOADED"] and row["analyzed"] == 0

    d = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert d["condition"] == "онлайн · бесплатно"
    work = next(w for w in d["works"] if w["name"] == WORK)
    # частоты в дереве не хранятся — они подставляются из входа сборки
    assert [p["freq"] for p in work["phrases"]] == [900, 500]
    assert work["analysis"] is None
    assert d["excluded"][0]["freq"] == 90000


def test_unknown_tree_is_404(client, needs_dir):
    assert client.get("/api/needs/tree/нет-такого").status_code == 404


@pytest.mark.parametrize("tid", ["../semcore.db", "..", "/etc/passwd", "t-001/../../x"])
def test_tree_id_cannot_escape_the_folder(client, seeded, tid):
    """`tree_id` — ключ найденного набора файлов, а не часть пути."""
    assert client.get(f"/api/needs/tree/{tid}").status_code in (404, 422)


def test_broken_tree_marks_the_row_but_list_survives(client, needs_dir, seeded):
    (needs_dir / "broken").mkdir()
    (needs_dir / "broken" / "accepted.json").write_text("[1, 2, 3]", encoding="utf-8")
    rows = client.get("/api/needs/trees").json()["trees"]
    broken = next(r for r in rows if r["id"] == "broken")
    assert "ожидался объект" in broken["error"] and len(rows) == 2


def test_loose_json_file_is_a_tree_too(client, needs_dir, seeded):
    (needs_dir / "hand.json").write_text(json.dumps(tree_doc([SNAP["NEW"]], []),
                                                    ensure_ascii=False), encoding="utf-8")
    ids = {r["id"] for r in client.get("/api/needs/trees").json()["trees"]}
    assert "hand" in ids


# ---------- разбор работы ----------

def test_analyze_work_buys_serp_then_calls_llm(client, seeded, snap_con, reports_dir):
    """Цепочка: выдача -> Opus -> отчёт файлом рядом с деревом; `node` не тронут."""
    with FakeWorker(client, TOKEN, verdict="BUILD", verdict_score=88):
        r = client.post("/api/needs/analyze", json={"tree_id": TREE_ID, "work": WORK})
        assert r.status_code == 200
        task_id = r.json()["task_id"]
        row = task_done(snap_con, task_id)
    assert row["status"] == "DONE", row["error"]
    res = json.loads(row["result"])
    assert res["verdict"] == "BUILD" and res["verdict_score"] == 88

    # выдача куплена по самой частотной фразе работы и легла в оплаченный кэш
    assert wscore.load_serp(snap_con, SNAP["TRANSACTIONAL"])
    # разбор лежит файлом рядом с деревом
    d = client.get(f"/api/needs/tree/{TREE_ID}").json()
    work = next(w for w in d["works"] if w["name"] == WORK)
    assert work["analysis"]["verdict"] == "BUILD"
    assert (reports_dir / f"{task_id}.html").is_file()
    assert work["analysis"]["report_link"] == f"reports/{task_id}.html"
    # статус узла первого слоя не изменился: второй слой в модель не пишет
    assert node_row(snap_con, SNAP["TRANSACTIONAL"])["status"] == "TRANSACTIONAL"


def test_analyze_reuses_paid_serp_without_network(client, seeded, snap_con):
    """Разбор берёт выдачу из оплаченного кэша (ключ «фраза+движок») и в сеть не идёт —
    ни в первый раз, ни при повторе."""
    with FakeWorker(client, TOKEN):
        for _ in range(2):
            tid = client.post("/api/needs/analyze",
                              json={"tree_id": TREE_ID, "work": WORK}).json()["task_id"]
            assert task_done(snap_con, tid)["status"] == "DONE"
    assert wscore.net_calls() == 0


def test_analyze_without_serp_fails_with_clear_reason(client, seeded, snap_con):
    """У второй работы выдачи в кэше нет: в режиме «только кэш» задача падает внятно,
    ничего не выдумывая и не помечая работу разобранной."""
    with FakeWorker(client, TOKEN):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "work": GAP_WORK}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED" and "только кэш" in row["error"]
    d = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert next(w for w in d["works"] if w["name"] == GAP_WORK)["analysis"] is None


def test_analyze_unknown_tree_or_work_is_404(client, seeded):
    assert client.post("/api/needs/analyze",
                       json={"tree_id": "нет", "work": WORK}).status_code == 404
    assert client.post("/api/needs/analyze",
                       json={"tree_id": TREE_ID, "work": "нет такой работы"}).status_code == 404


def test_analyze_is_not_started_twice(client, seeded, llm_timeout):
    """Пока разбор идёт, второй запрос по той же работе — 409, а не вторая покупка выдачи."""
    llm_timeout(3.0)
    with FakeWorker(client, TOKEN, mode="silent"):
        assert client.post("/api/needs/analyze",
                           json={"tree_id": TREE_ID, "work": WORK}).status_code == 200
        r = client.post("/api/needs/analyze", json={"tree_id": TREE_ID, "work": WORK})
    assert r.status_code == 409 and "уже идёт" in r.json()["detail"]


def test_waiting_until_the_agent_actually_takes_the_job(client, seeded, snap_con, llm_timeout):
    """`RUNNING` означает «работа реально идёт», а не «сервер взял задачу».

    Пока джоб лежит в очереди LLM и его никто не забрал, задача стоит в `WAITING`. Это ровно
    тот случай, который иначе неотличим от честной работы: петля не запущена, а строка
    показывает `RUNNING` и висит до таймаута."""
    llm_timeout(6.0)
    worker = FakeWorker(client, TOKEN, mode="silent")     # сигнал возьмёт, данные не заберёт
    tid = client.post("/api/needs/analyze",
                      json={"tree_id": TREE_ID, "work": WORK}).json()["task_id"]
    # выдача уже засеяна, поэтому системная часть проходит мгновенно и мы сразу ждём агента
    wait_for(lambda: task_row(snap_con, tid)["status"] == "WAITING",
             what="задача перешла в ожидание исполнителя")

    jobs = worker.watch(timeout=2.0)                      # диспетчер взял сигнал
    assert jobs, "джоб не попал в очередь LLM"
    assert task_row(snap_con, tid)["status"] == "WAITING", \
        "сигнал диспетчеру — ещё не работа: данные никто не забрал"

    assert worker.get_job(jobs[0]["job_id"]) is not None   # исполнитель забрал данные
    wait_for(lambda: task_row(snap_con, tid)["status"] == "RUNNING",
             what="задача перешла в RUNNING после взятия джоба")

    worker.submit(jobs[0]["job_id"], ok=False, error="намеренная ошибка")
    assert task_done(snap_con, tid)["status"] == "FAILED"


def test_non_llm_operation_is_running_right_away(client, seeded, snap_con):
    """Не-LLM операция работает сама, поэтому `WAITING` у неё быть не должно."""
    seen = []
    tid = client.post("/api/node/load", json={"phrase": SNAP["NEW"]}).json()["task_id"]
    for _ in range(200):
        row = task_row(snap_con, tid)
        seen.append(row["status"])
        if row["status"] in ("DONE", "FAILED"):
            break
        time.sleep(0.01)
    assert "WAITING" not in seen, f"не-LLM операция побывала в WAITING: {seen}"
    assert seen[-1] == "DONE", seen
