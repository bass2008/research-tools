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
}


# ---------------------------------------------------------------- 1. FSM

def test_allowed_table_matches_design():
    """Таблица «из какого статуса какая операция» — ровно как в design §2."""
    assert {k: tuple(v) for k, v in server.ALLOWED.items()} == DESIGN_ALLOWED


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

# ---------------------------------------------------------------- 3. ошибка неразрушающа

async def test_failed_step_keeps_status_and_collected_data(snapshot_db, monkeypatch, tmp_path):
    """Упавший шаг: лог + FAILED, статус прежний, ранее собранные данные не затёрты (§10.3)."""
    monkeypatch.setattr(tasks, "REPORTS", tmp_path / "reports")
    con = wscore.connect(snapshot_db)
    phrase = SNAP["FULLY_LOADED"]
    before = node_row(con, phrase)
    wscore.add_stopwords(con, [("телеграм", "stop")])
    # модель отвечает не тем: разбор обязан упасть, а не принять мусор молча
    ctx = StubCtx(con, answer=lambda job: {"чего-то не хватает": []})

    task_id = tasks.create_task(ctx, "stopwords_scan", phrase, None)
    assert await tasks.execute(ctx, task_id) is False

    after = node_row(con, phrase)
    assert after["status"] == before["status"] and after["freq"] == before["freq"]
    assert [w["word"] for w in wscore.stopwords(con)] == ["телеграм"], \
        "список исключений упавшим разбором не тронут"
    assert wscore.load_serp(con, SNAP["SEARCHED"]), "чужая выдача не затёрта"
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
    assert client.post("/api/stopwords/scan",
                       json={"phrase": SNAP["FULLY_LOADED"]}).status_code == 200
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
