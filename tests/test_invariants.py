"""Инварианты, которые должны держаться всегда (testing-plan §10).

FSM, отсутствие частичной выдачи, неразрушающая ошибка, идемпотентность, дедуп по DAG,
«дальше идёт только transactional», чтение не мутирует, тяжёлые данные не идут через
диспетчера. Всё на моках: ни сети, ни LLM.
"""
import asyncio

import pytest

import server
import tasks
import wscore
from conftest import (SNAP, StubCtx, TOKEN, node_row, open_probe, task_done, task_row, wait_for)
from fake_worker import FakeWorker, canned

PIPE_OPS = ("classify", "search", "score", "analyze")

# таблица переходов design §2: статус -> операция, которая из него разрешена
DESIGN_ALLOWED = {
    "load": ("NEW",),
    "full_load": ("NEW", "LOADED"),
    "classify": ("FULLY_LOADED",),
    "search": ("TRANSACTIONAL",),
    "score": ("SEARCHED",),
    "analyze": ("SCORED",),
    "drill": ("NEW", "LOADED", "FULLY_LOADED", "TRANSACTIONAL", "SEARCHED", "SCORED"),
}


# ---------------------------------------------------------------- 1. FSM

def test_allowed_table_matches_design():
    """Таблица «из какого статуса какая операция» — ровно как в design §2."""
    assert {k: tuple(v) for k, v in server.ALLOWED.items()} == DESIGN_ALLOWED
    assert set(DESIGN_ALLOWED["drill"]) == set(wscore.STATUSES) - set(wscore.TERMINALS)


def test_disallowed_operations_are_rejected(client, snap_con):
    """Любой неразрешённый переход отвергается 422 и ничего не меняет."""
    statuses = {r["phrase"]: r["status"] for r in
                snap_con.execute("SELECT phrase, status FROM node")}
    before = sorted(statuses.items())
    checked = 0
    for phrase, status in statuses.items():
        for op in PIPE_OPS:
            if status in server.ALLOWED[op]:
                continue                      # разрешённые проверяются отдельными тестами
            r = client.post("/api/node/op", json={"phrase": phrase, "op": op})
            assert r.status_code == 422, f"{status} + {op} -> {r.status_code}"
            checked += 1
        for path, op in (("/api/node/load", "load"), ("/api/node/full-load", "full_load"),
                         ("/api/node/drill", "drill")):
            if status in server.ALLOWED[op]:
                continue
            r = client.post(path, json={"phrase": phrase})
            assert r.status_code == 422, f"{status} + {op} -> {r.status_code}"
            checked += 1
    assert checked > 40
    after = sorted({r["phrase"]: r["status"] for r in
                    snap_con.execute("SELECT phrase, status FROM node")}.items())
    assert after == before, "отвергнутая команда не должна ничего менять"


def test_terminals_have_no_pipeline_operations(client, snap_con):
    """Терминалы операций пайплайна не имеют — только просмотр и Fix kind (design §2)."""
    for status in wscore.TERMINALS:
        phrase = SNAP[status]
        assert node_row(snap_con, phrase)["status"] == status
        for op in PIPE_OPS:
            assert client.post("/api/node/op", json={"phrase": phrase,
                                                     "op": op}).status_code == 422
        assert client.post("/api/node/drill", json={"phrase": phrase}).status_code == 422
        assert client.post("/api/node/full-load", json={"phrase": phrase}).status_code == 422


def test_fix_kind_is_rejected_outside_intent_statuses(client):
    """Fix kind — оверрайд метки, а не способ перескочить пайплайн (design §2)."""
    for key in ("NEW", "LOADED", "FULLY_LOADED", "SEARCHED"):
        r = client.post("/api/node/kind", json={"phrase": SNAP[key], "kind": "transactional"})
        assert r.status_code == 422, f"{key} -> {r.status_code}"


def test_every_status_is_writable_with_its_timestamp(empty_db):
    """Каждый статус цепочки применяется и ставит свой таймстемп; мусор отвергается."""
    con = wscore.connect(empty_db)
    wscore.upsert_node(con, "фраза", freq=100)
    chain = [("LOADED", None), ("FULLY_LOADED", None), ("TRANSACTIONAL", "classified_at"),
             ("SEARCHED", "searched_at"), ("SCORED", "scored_at"), ("ANALYZED", "analyzed_at")]
    for status, ts_col in chain:
        delta = wscore.set_status(con, "фраза", status)
        assert delta["status"] == status
        if ts_col:
            assert node_row(con, "фраза")[ts_col], f"{status}: нет таймстемпа {ts_col}"
    for status in ("CATEGORY", "INFORMATIONAL", "NAVIGATIONAL", "LOW_SCORED"):
        assert wscore.set_status(con, "фраза", status)["status"] == status
    with pytest.raises(ValueError):
        wscore.set_status(con, "фраза", "МУСОР")
    with pytest.raises(KeyError):
        wscore.set_status(con, "нет такой фразы", "LOADED")
    con.close()


# ---------------------------------------------------------------- 2. нет частичной выдачи

async def test_search_writes_both_serps_or_none(snapshot_db, monkeypatch):
    """Падение одного движка -> в БД не попало ничего, узел остался TRANSACTIONAL (§10.2)."""
    monkeypatch.setenv("XMLRIVER_CACHE_ONLY", "0")   # иначе search до движков не доходит
    con = wscore.connect(snapshot_db)
    phrase = SNAP["TRANSACTIONAL"]
    docs = {"found": 10, "docs": [{"rank": 1, "url": "u", "title": "t", "snippet": "s"}]}

    def half_broken(engine, p):
        if engine == "google":
            raise RuntimeError("HTTP 500 от XMLRiver (Google)")
        return docs

    monkeypatch.setattr(tasks, "_serp_request", half_broken)
    ctx = StubCtx(con)
    task_id = tasks.create_task(ctx, "search", phrase, None)

    assert await tasks.execute(ctx, task_id) is False
    assert wscore.load_serp(con, phrase) == {}, "частичная выдача попала в БД"
    assert node_row(con, phrase)["status"] == "TRANSACTIONAL"
    assert task_row(con, task_id)["status"] == "FAILED"
    assert any(r["level"] == "ERROR" for r in ctx.logs)

    monkeypatch.setattr(tasks, "_serp_request", lambda engine, p: docs)
    ok_task = tasks.create_task(ctx, "search", phrase, None)
    assert await tasks.execute(ctx, ok_task) is True
    assert set(wscore.load_serp(con, phrase)) == {"yandex", "google"}
    assert node_row(con, phrase)["status"] == "SEARCHED"
    con.close()


# ---------------------------------------------------------------- 3. ошибка неразрушающа

async def test_failed_step_keeps_status_and_collected_data(snapshot_db, monkeypatch, tmp_path):
    """Упавший шаг: лог + FAILED, статус прежний, ранее собранные данные не затёрты (§10.3)."""
    monkeypatch.setattr(tasks, "REPORTS", tmp_path / "reports")
    con = wscore.connect(snapshot_db)
    phrase = SNAP["SCORED"]
    before = node_row(con, phrase)
    ctx = StubCtx(con, answer=lambda job: {"recommendation": "BUILD", "verdict_score": 90})

    task_id = tasks.create_task(ctx, "analyze", phrase, None)
    assert await tasks.execute(ctx, task_id) is False

    after = node_row(con, phrase)
    assert after["status"] == "SCORED" and after["verdict"] is None
    assert after["score"] == before["score"] and after["description"] == before["description"]
    assert wscore.load_serp(con, phrase), "выдача не затёрта"
    assert con.execute("SELECT COUNT(*) FROM report WHERE node = ?", (phrase,)).fetchone()[0] == 0
    assert not (tmp_path / "reports" / f"{task_id}.html").exists()
    # чужой отчёт на месте
    assert con.execute("SELECT COUNT(*) FROM report").fetchone()[0] == 1
    assert task_row(con, task_id)["status"] == "FAILED"
    assert any(r["level"] == "ERROR" for r in ctx.logs)
    con.close()


def test_error_field_does_not_change_status(snapshot_db):
    """Ошибка пишется в поле error, статус НЕ меняется (design §2)."""
    con = wscore.connect(snapshot_db)
    phrase = SNAP["ERROR"]
    row = node_row(con, phrase)
    assert row["status"] == "TRANSACTIONAL" and row["error"] and row["error_stage"] == "search"
    obj = wscore.node_object(con, phrase)
    assert obj["error"] and obj["status"] == "TRANSACTIONAL"
    con.close()


# ---------------------------------------------------------------- 4-6. drill целиком

@pytest.fixture
def drillable(snapshot_db, monkeypatch, tmp_path):
    """БД-снимок, готовый к сквозному drill без сети: выдача засеяна всем, кто станет
    TRANSACTIONAL (в режиме «только кэш» search берёт её из `serp`)."""
    monkeypatch.setattr(tasks, "REPORTS", tmp_path / "reports")
    con = wscore.connect(snapshot_db)
    docs = [{"rank": i + 1, "url": f"https://x{i}", "title": "t", "snippet": "s"} for i in range(10)]
    for key in ("LOADED", "FULLY_LOADED", "TRANSACTIONAL", "ERROR"):
        wscore.save_serp(con, SNAP[key], {"yandex": {"found": 1, "docs": docs},
                                          "google": {"found": 2, "docs": docs}})
    yield con
    con.close()


async def test_drill_takes_only_transactional_and_is_idempotent(drillable):
    """Drill доводит поддерево до терминалов; дальше идёт только transactional (§10.6);
    повторный прогон ничего не дублирует и не ломает (§10.4)."""
    con = drillable
    root = SNAP["LOADED"]
    ctx = StubCtx(con, answer=canned)

    task_id = tasks.create_task(ctx, "drill", root, None)
    assert await tasks.execute(ctx, task_id) is True
    result = task_row(con, task_id)["result"]
    assert '"non_terminal_left": 0' in result, result

    # припаркованные интенты не получили ни выдачи, ни скора, ни отчёта
    for key in ("INFORMATIONAL", "NAVIGATIONAL", "CATEGORY"):
        phrase = SNAP[key]
        assert node_row(con, phrase)["status"] == key
        assert wscore.load_serp(con, phrase) == {}, f"{key} ушёл в search"
        assert node_row(con, phrase)["score"] is None, f"{key} ушёл в score"
        assert con.execute("SELECT COUNT(*) FROM report WHERE node = ?",
                           (phrase,)).fetchone()[0] == 0
    # голова freq > 30000 всегда CATEGORY, что бы ни ответила LLM
    assert node_row(con, SNAP["HEAD"])["status"] == "CATEGORY"
    # LOW_SCORED — терминал, повторно не оценивался
    assert node_row(con, SNAP["LOW_SCORED"])["score"] == 40
    assert node_row(con, root)["status"] == "ANALYZED"

    jobs, reports = len(ctx.jobs), len(con.execute("SELECT id FROM report").fetchall())
    statuses = dict(con.execute("SELECT phrase, status FROM node"))

    again = tasks.create_task(ctx, "drill", root, None)
    assert await tasks.execute(ctx, again) is True

    assert len(ctx.jobs) == jobs, "повторный drill не должен звать LLM заново"
    assert len(con.execute("SELECT id FROM report").fetchall()) == reports
    assert dict(con.execute("SELECT phrase, status FROM node")) == statuses
    assert '"non_terminal_left": 0' in task_row(con, again)["result"]


def test_drill_over_real_transport(client, snap_con, worker_free, llm_timeout, reports_dir):
    """Тот же сквозной drill, но через настоящий транспорт и фоновую петлю воркера:
    ни один тяжёлый payload не прошёл через диспетчера (§10.8)."""
    llm_timeout(60)
    docs = [{"rank": 1, "url": "https://x", "title": "t", "snippet": "s"}]
    for key in ("LOADED", "FULLY_LOADED", "TRANSACTIONAL", "ERROR"):
        wscore.save_serp(snap_con, SNAP[key], {"yandex": {"found": 1, "docs": docs},
                                               "google": {"found": 2, "docs": docs}})

    fake = worker_free("ok")
    with fake:
        task_id = client.post("/api/node/drill", json={"phrase": SNAP["LOADED"]}).json()["task_id"]
        row = task_done(snap_con, task_id, timeout=80.0)

    assert row["status"] == "DONE", row["error"]
    assert fake.errors == [], fake.errors
    assert fake.seen and all(set(s) == {"job_id", "type"} for s in fake.seen), \
        "диспетчер видит только сигнал, без params и prompt"
    assert node_row(snap_con, SNAP["LOADED"])["status"] == "ANALYZED"
    assert list(reports_dir.glob("*.html")), "отчёты легли файлами на диск"
    assert wait_for(lambda: not snap_con.execute(
        "SELECT COUNT(*) FROM node WHERE task_id IS NOT NULL").fetchone()[0],
        what="снятие всех блокировок")


@pytest.fixture
def worker_free(client):
    def _make(mode="ok", **kw):
        return FakeWorker(client, TOKEN, mode=mode, **kw)
    return _make


# ---------------------------------------------------------------- 5. дедуп и отсутствие циклов

def test_subtree_walk_has_no_cycles(snapshot_db):
    """Дерево — DAG: обход поддерева не зацикливается, фраза встречается один раз (§10.5)."""
    con = wscore.connect(snapshot_db)
    con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)",
                (SNAP["HEAD"], SNAP["TRANSACTIONAL"]))       # вторая связь к тому же ребёнку
    con.commit()

    phrases = wscore.subtree_phrases(con, SNAP["LOADED"])

    assert len(phrases) == len(set(phrases))
    assert phrases.count(SNAP["TRANSACTIONAL"]) == 1
    parents = {r[0] for r in con.execute("SELECT parent FROM edge WHERE child = ?",
                                         (SNAP["TRANSACTIONAL"],))}
    assert parents == {SNAP["FULLY_LOADED"], SNAP["HEAD"]}, "ребро — от каждого родителя"
    con.close()


def test_classify_input_is_deduplicated(snapshot_db):
    """Данные для classify — узлы поддерева со своими детьми, без дублей; дети ниже FLOOR
    в список детей не попадают, но сами узлами остаются (design §6.1)."""
    con = wscore.connect(snapshot_db)
    con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)",
                (SNAP["HEAD"], SNAP["TRANSACTIONAL"]))          # второй родитель
    wscore.upsert_node(con, "убрать фон видео мелочь", freq=10)  # ниже FLOOR
    con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES (?, ?)",
                (SNAP["FULLY_LOADED"], "убрать фон видео мелочь"))
    con.commit()

    chunks = wscore.subtree_for_classify(con, SNAP["LOADED"])
    phrases = [n["phrase"] for c in chunks for n in c]
    node = next(n for c in chunks for n in c if n["phrase"] == SNAP["FULLY_LOADED"])

    assert len(phrases) == len(set(phrases)), "узел поддерева не должен дублироваться"
    assert phrases.count(SNAP["TRANSACTIONAL"]) == 1
    assert SNAP["TRANSACTIONAL"] in node["children"]
    assert "убрать фон видео мелочь" not in node["children"], "детей ниже FLOOR не шлём"
    assert "убрать фон видео мелочь" in phrases, "но сам узел в разметку попадает"
    con.close()


# ---------------------------------------------------------------- рестарт

def test_restart_fails_running_tasks_and_frees_locks(serve, snapshot_db):
    """Рестарт: незавершённые задачи -> FAILED, зависших блокировок не остаётся (tech §2)."""
    probe = open_probe(snapshot_db)
    probe.execute("INSERT INTO task(id, type, status, node, created_at) VALUES "
                  "('zombie-1', 'classify', 'RUNNING', ?, 0)", (SNAP["FULLY_LOADED"],))
    probe.execute("INSERT INTO task(id, type, status, node, created_at) VALUES "
                  "('zombie-2', 'drill', 'QUEUED', ?, 0)", (SNAP["LOADED"],))
    probe.execute("UPDATE node SET task_id = 'zombie-1' WHERE phrase = ?", (SNAP["FULLY_LOADED"],))
    probe.commit()

    client = serve(snapshot_db)

    rows = {r["id"]: dict(r) for r in probe.execute("SELECT * FROM task WHERE id LIKE 'zombie%'")}
    assert {r["status"] for r in rows.values()} == {"FAILED"}
    assert all(r["error"] for r in rows.values())
    assert probe.execute("SELECT COUNT(*) FROM node WHERE task_id IS NOT NULL").fetchone()[0] == 0
    # узел снова принимает команды
    assert client.post("/api/node/op", json={"phrase": SNAP["FULLY_LOADED"],
                                             "op": "classify"}).status_code == 200
    probe.close()


# ------------------------------- FULLY_LOADED только при загруженном поддереве (боль из практики)

def test_fully_loaded_is_repaired_when_descendant_becomes_unloaded(empty_db):
    """Узел не может быть FULLY_LOADED, если в поддереве есть незагруженный >= FLOOR.

    Прецедент: выбросили 97 отравленных записей кэша, узлы стали queried=0 — и 72 предка
    продолжали утверждать «загружено полностью». full_load по ним даже не запускался:
    операция разрешена только из NEW/LOADED.
    """
    con = wscore.connect(empty_db)
    for phrase, freq in (("корень", 5000), ("корень ветка", 1000), ("корень ветка лист", 300)):
        wscore.upsert_node(con, phrase, freq=freq, queried=True)
    con.execute("INSERT INTO edge(parent, child) VALUES ('корень', 'корень ветка')")
    con.execute("INSERT INTO edge(parent, child) VALUES ('корень ветка', 'корень ветка лист')")
    for phrase in ("корень", "корень ветка", "корень ветка лист"):
        wscore.set_status(con, phrase, "FULLY_LOADED")
    con.commit()

    assert wscore.repair_fully_loaded(con) == 0, "всё загружено — исправлять нечего"

    # самый глубокий узел стал незагруженным (как при выбрасывании отравы из кэша)
    con.execute("UPDATE node SET queried = 0 WHERE phrase = 'корень ветка лист'")
    con.commit()

    assert wscore.repair_fully_loaded(con) == 3, "и сам узел, и оба предка больше не FULLY_LOADED"
    for phrase in ("корень", "корень ветка", "корень ветка лист"):
        assert wscore.get_node(con, phrase)["status"] == "LOADED", phrase
    assert wscore.repair_fully_loaded(con) == 0, "починка идемпотентна"


def test_repair_ignores_descendants_below_floor(empty_db):
    """Незагруженный лист НИЖЕ FLOOR — не нарушение: вглубь мы его и не бурим (design §4)."""
    con = wscore.connect(empty_db)
    wscore.upsert_node(con, "корень", freq=5000, queried=True)
    wscore.upsert_node(con, "корень мелочь", freq=wscore.FLOOR - 1)     # queried=0, ниже порога
    con.execute("INSERT INTO edge(parent, child) VALUES ('корень', 'корень мелочь')")
    wscore.set_status(con, "корень", "FULLY_LOADED")
    con.commit()

    assert wscore.repair_fully_loaded(con) == 0
    assert wscore.get_node(con, "корень")["status"] == "FULLY_LOADED"


def test_stale_pool_does_not_overwrite_fresh_freq(empty_db):
    """Частоту переписывает только не более старый пул.

    Раньше побеждал тот, что обработали последним, а порядок обхода к возрасту данных
    отношения не имеет: пул от 21.07 затирал свежий от 26.07, и решение по FLOOR принималось
    по устаревшему числу."""
    con = wscore.connect(empty_db, backfill=False)
    wscore.upsert_node(con, "фраза", freq=59, freq_at=2_000)      # свежий пул
    wscore.upsert_node(con, "фраза", freq=49, freq_at=1_000)      # старый пул — не должен победить
    assert wscore.get_node(con, "фраза")["freq"] == 59

    wscore.upsert_node(con, "фраза", freq=71, freq_at=3_000)      # ещё свежее — побеждает
    assert wscore.get_node(con, "фраза")["freq"] == 71

    wscore.upsert_node(con, "фраза", freq=12)                     # возраст неизвестен = свежий
    assert wscore.get_node(con, "фраза")["freq"] == 12
    con.close()


def test_crawl_rechecks_frontier_before_declaring_loaded(empty_db, monkeypatch):
    """Краул не объявляет поддерево загруженным, пока в нём есть незапрошенные узлы >= FLOOR.

    Воспроизводим сам дефект: фраза сначала приходит из пула со значением НИЖЕ FLOOR (краул
    её пропускает), а из следующего пула — выше. Без перепроверки фронтира она осталась бы
    незапрошенной под статусом FULLY_LOADED."""
    con = wscore.connect(empty_db, backfill=False)
    LOW, HIGH = wscore.FLOOR - 1, wscore.FLOOR + 9
    pools = {
        "корень": (1000, [("корень старый", LOW), ("корень второй", 500)]),
        "корень второй": (500, [("корень старый", HIGH)]),   # то же слово, значение выше порога
        "корень старый": (HIGH, []),
    }

    def fake(phrase, limit=wscore.LIMIT, db_path=None):
        qn = wscore.normalize(phrase)
        own, refs = pools.get(qn, (0, []))
        return qn, own, refs, 1_000

    monkeypatch.setattr(wscore, "fetch_phrase", fake)
    res = asyncio.run(wscore.crawl_subtree(con, "корень", workers=1))

    assert wscore.unqueried_frontier(con, "корень") == [], "остался незапрошенный узел >= FLOOR"
    assert wscore.get_node(con, "корень старый")["queried"] == 1, \
        "узел, чья частота пересекла FLOOR после решения, обязан быть догружен"
    assert res["fetched"] == 3
    assert wscore.repair_fully_loaded(con) == 0, "краул оставил нарушение инварианта"
    con.close()
