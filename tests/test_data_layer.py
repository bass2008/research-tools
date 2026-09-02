"""Unit-ядро (testing-plan §4) и слой данных (§5): границы порогов, пересбор из кэша,
неприкосновенность `cache`/`keywords`, поведение краула.

Всё здесь — без сервера и без LLM: чистые функции, прямые вызовы `wscore` и операции
`tasks.*` на заглушке рантайма (`StubCtx`).
"""
import json
import sqlite3
import pytest

import needs_layer
import tasks
import wscore
from conftest import (SNAP, StubCtx, counts, node_row, seed_cache, table_rows, wipe_model)


# ---------------------------------------------------------------- §4 чистые функции

def test_normalize():
    assert wscore.normalize("  Убрать   ФОН \n") == "убрать фон"
    assert wscore.normalize(None) == ""
    assert wscore.normalize("Фон") == "фон"


def test_stem_cuts_endings_but_keeps_short_stems():
    assert wscore.stem("видео") == "виде"
    assert wscore.stem("фона") == "фон"
    assert wscore.stem("фон") == "фон"
    assert wscore.stem("ая") == "ая", "основа короче трёх букв не режется"


def test_words_of_is_stemmed_set():
    assert wscore.words_of("Убрать  фона") == wscore.words_of("убрать фон")
    assert wscore.words_of("убрать фон видео") > wscore.words_of("убрать фон")


def test_parse_popular_reads_pairs_and_survives_garbage():
    data = {"popular": [{"text": "Убрать фон", "value": "500"},
                        {"text": "фон видео", "value": None},
                        {"text": "  ", "value": 10},
                        {"text": "фон онлайн", "value": "мусор"}]}
    assert wscore.parse_popular(data) == [("убрать фон", 500), ("фон видео", 0), ("фон онлайн", 0)]
    assert wscore.parse_popular({}) == []
    assert wscore.parse_popular({"popular": None}) == []


def test_refinements_only_strict_supersets():
    data = {"popular": [{"text": "убрать фон", "value": 100},      # сам запрос — не уточнение
                        {"text": "фон убрать", "value": 90},       # тот же набор слов — не строгое
                        {"text": "убрать фон видео", "value": 50},  # супермножество
                        {"text": "убрать логотип", "value": 30}]}   # не содержит запрос
    assert wscore.refinements("убрать фон", data) == [("убрать фон видео", 50)]


def test_build_forest_nests_by_words():
    roots = wscore.build_forest([("фон", 100), ("убрать фон", 50), ("убрать фон видео", 20),
                                 ("логотип", 10)])
    assert sorted(r["phrase"] for r in roots) == ["логотип", "фон"]
    top = next(r for r in roots if r["phrase"] == "фон")
    assert [c["phrase"] for c in top["children"]] == ["убрать фон"]
    assert [c["phrase"] for c in top["children"][0]["children"]] == ["убрать фон видео"]


def test_thresholds_are_the_agreed_ones():
    assert wscore.FLOOR == 50                 # граница рекурсии краула (design §4)
    assert needs_layer.HEAD_FREQ == 30000     # выше — голова, в сборку не идёт (design §3)
    assert wscore.LIMIT == 2000               # потолок самого источника, не тюнинг


# ---------------------------------------------------------------- §4 границы порогов

async def test_floor_boundary_49_not_drilled_50_drilled(empty_db, fetch_spy):
    """FLOOR=50: 49 вглубь не бурим, 50 бурим; оба узла и рёбра всё равно записаны."""
    con = wscore.connect(empty_db)
    seed_cache(con, {"тест фон": [("тест фон", 1000), ("тест фон много", 50), ("тест фон мало", 49)]})
    res = await wscore.crawl_subtree(con, "тест фон")

    assert fetch_spy == ["тест фон", "тест фон много"], "узел с freq=49 фетчить нельзя"
    assert res["fetched"] == 2
    assert node_row(con, "тест фон мало")["queried"] == 0
    assert node_row(con, "тест фон много")["queried"] == 1
    edges = {tuple(r) for r in con.execute("SELECT parent, child FROM edge")}
    assert edges == {("тест фон", "тест фон много"), ("тест фон", "тест фон мало")}
    # лист ниже FLOOR — тоже FULLY_LOADED, иначе classify его не обработает (tech §5)
    assert node_row(con, "тест фон мало")["status"] == "FULLY_LOADED"
    assert wscore.net_calls() == 0
    con.close()


# ---------------------------------------------------------------- §5 схема и пересбор

def test_schema_is_idempotent(empty_db):
    """Заведение схемы — идемпотентно (инвариант §10.4)."""
    con = wscore.connect(empty_db)
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert {"cache", "node", "edge", "domain", "domain_member",
            "serp", "task", "report"} <= tables
    con.close()
    con = wscore.connect(empty_db)
    assert counts(con)["node"] == 0
    con.close()


def test_domain_groups_entry_nodes_without_changing_tree(empty_db):
    """Домен — это набор точек входа, а не новые рёбра между фразами."""
    con = wscore.connect(empty_db)
    wscore.save_domain(con, "test-domain", "Тестовый домен",
                       ["Корень один", "Корень два"])

    groups = wscore.domain_groups(con)
    assert [(g["id"], g["name"]) for g in groups] == [("test-domain", "Тестовый домен")]
    assert [n["phrase"] for n in groups[0]["members"]] == ["корень один", "корень два"]
    assert con.execute("SELECT COUNT(*) FROM edge").fetchone()[0] == 0
    assert wscore.root_candidates(con) == [], "члены уже показаны в домене и не дублируются"
    con.close()


def test_destiny_matrix_domain_is_seeded_on_its_database(real_db):
    """Боевая ветка «матрица судьбы» включает домен с утверждённым whitelist."""
    con = wscore.connect(real_db)
    group = next(g for g in wscore.domain_groups(con)
                 if g["id"] == wscore.DESTINY_MATRIX_DOMAIN_ID)
    assert group["name"] == wscore.DESTINY_MATRIX_DOMAIN_NAME
    assert tuple(n["phrase"] for n in group["members"]) == wscore.DESTINY_MATRIX_DOMAIN_KEYS
    assert group["members"][0]["status"] == "FULLY_LOADED"
    con.close()


def test_task_schema_migrates_old_analysis_rows_to_claude(tmp_path):
    """До появления model_family все анализы выполнял Claude; Basic остаётся без семьи."""
    db = tmp_path / "old-task.db"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE task (id TEXT PRIMARY KEY, type TEXT NOT NULL, "
                "status TEXT NOT NULL, node TEXT, params TEXT, result TEXT, created_at INTEGER, "
                "started_at INTEGER, finished_at INTEGER, error TEXT)")
    con.executemany("INSERT INTO task(id, type, status) VALUES (?, ?, 'DONE')", [
        ("n", "needs_analyze"), ("f", "needs_analyze_adv"),
        ("p", "needs_analyze_product"), ("s", "needs_season"),
    ])
    con.commit()
    con.close()

    con = wscore.connect(db, backfill=False)
    rows = dict(con.execute("SELECT id, model_family FROM task"))
    assert rows == {"n": "claude", "f": "claude", "p": "claude", "s": None}
    assert "model_family" in {c[1] for c in con.execute("PRAGMA table_info(task)")}
    con.close()


def test_rebuild_from_cache_gives_the_same_tree(real_db):
    """Пересбор модели из кэша даёт то же дерево: те же узлы, те же связи, дефолтный статус."""
    con = wscore.connect(real_db)
    before_nodes = {p: f for p, f in con.execute("SELECT phrase, COALESCE(freq, 0) FROM node")}
    before_edges = {tuple(r) for r in con.execute("SELECT parent, child FROM edge")}
    assert before_nodes and before_edges, "копия боевой БД должна быть непустой"

    wipe_model(con)
    wscore.rebuild_model_from_cache(con)
    after_nodes = {p: f for p, f in con.execute("SELECT phrase, COALESCE(freq, 0) FROM node")}
    after_edges = {tuple(r) for r in con.execute("SELECT parent, child FROM edge")}

    assert after_nodes == before_nodes
    assert after_edges == before_edges
    statuses = {r[0] for r in con.execute("SELECT DISTINCT status FROM node")}
    assert statuses == {"NEW"}, "пересобранные узлы получают дефолтный статус"

    wscore.rebuild_model_from_cache(con)          # повторный запуск ничего не ломает
    assert counts(con)["node"] == len(after_nodes)
    assert counts(con)["edge"] == len(after_edges)
    con.close()


def test_cache_and_keywords_are_never_touched(real_db):
    """`cache` и `keywords` неприкосновенны: ни строки не потеряно и не перезаписано (tech §5)."""
    con = wscore.connect(real_db)
    cache_before, kw_before = table_rows(con, "cache"), table_rows(con, "keywords")
    assert cache_before and kw_before

    wipe_model(con)
    wscore.rebuild_model_from_cache(con)
    wscore.connect(real_db).close()               # повторное подключение (со схемой и бэкфиллом)

    assert table_rows(con, "cache") == cache_before
    assert table_rows(con, "keywords") == kw_before
    con.close()


def test_connect_backfills_model_from_cache(real_db):
    """Пустой `node` + непустой `cache` -> модель пересобирается сама (ловушка §3.1)."""
    con = wscore.connect(real_db)
    n_before = counts(con)["node"]
    wipe_model(con)
    con.close()

    con = wscore.connect(real_db, backfill=False)
    assert counts(con)["node"] == 0, "backfill=False обязан оставить дерево пустым"
    con.close()

    con = wscore.connect(real_db)
    assert counts(con)["node"] == n_before
    con.close()


# ---------------------------------------------------------------- §5 краул

async def test_crawl_dedups_phrase_with_two_parents(empty_db, fetch_spy):
    """Дедуп по DAG: фраза у двух родителей фетчится один раз, ребро — от каждого."""
    con = wscore.connect(empty_db)
    seed_cache(con, {
        "фон": [("фон", 1000), ("убрать фон", 500), ("фон видео", 400)],
        "убрать фон": [("убрать фон", 500), ("убрать фон видео", 300)],
        "фон видео": [("фон видео", 400), ("убрать фон видео", 300)],
        "убрать фон видео": [("убрать фон видео", 300)],
    })
    res = await wscore.crawl_subtree(con, "фон")

    assert len(fetch_spy) == len(set(fetch_spy)) == 4, "каждая фраза фетчится один раз"
    assert res["fetched"] == 4 and res["errors"] == []
    edges = {tuple(r) for r in con.execute("SELECT parent, child FROM edge")}
    assert ("убрать фон", "убрать фон видео") in edges
    assert ("фон видео", "убрать фон видео") in edges
    assert len(wscore.subtree_phrases(con, "фон")) == 4, "обход DAG не зацикливается"
    con.close()


async def test_cache_works_under_parallel_crawl(empty_db, fetch_spy):
    """Кэш работает при параллельном крауле: внутри одной волны фетчей (WORKERS=6) общая
    фраза берётся один раз (tech §5, проверяется счётчиком обращений к фетчу)."""
    con = wscore.connect(empty_db)
    kids = [("фон один", 100), ("фон два", 100), ("фон три", 100), ("фон четыре", 100),
            ("фон пять", 100), ("фон шесть", 100), ("фон семь", 100)]
    pools = {"фон": [("фон", 1000), *kids]}
    for phrase, freq in kids:
        pools[phrase] = [(phrase, freq)]
    pools["фон один"].append(("фон один два", 90))     # общий ребёнок двух родителей,
    pools["фон два"].append(("фон один два", 90))      # оба фетчатся в одной волне
    pools["фон один два"] = [("фон один два", 90)]
    seed_cache(con, pools)

    res = await wscore.crawl_subtree(con, "фон")

    assert len(fetch_spy) == len(set(fetch_spy)) == 9
    assert res["fetched"] == 9 and res["errors"] == []
    parents = {r[0] for r in con.execute("SELECT parent FROM edge WHERE child = 'фон один два'")}
    assert parents == {"фон один", "фон два"}
    assert wscore.net_calls() == 0
    con.close()


async def test_crawl_marks_whole_subtree_fully_loaded(empty_db):
    """После краула всё поддерево FULLY_LOADED, включая листы ниже FLOOR (tech §5)."""
    con = wscore.connect(empty_db)
    seed_cache(con, {
        "фон": [("фон", 1000), ("убрать фон", 500), ("фон мелочь", 10)],
        "убрать фон": [("убрать фон", 500), ("убрать фон видео", 90)],
        "убрать фон видео": [("убрать фон видео", 90)],
    })
    await wscore.crawl_subtree(con, "фон")

    statuses = dict(con.execute("SELECT phrase, status FROM node"))
    assert statuses == {"фон": "FULLY_LOADED", "убрать фон": "FULLY_LOADED",
                        "фон мелочь": "FULLY_LOADED", "убрать фон видео": "FULLY_LOADED"}
    con.close()


async def test_second_crawl_spends_no_fetches(empty_db, fetch_spy):
    """Повторный краул не дублирует данные и не тратит запросов (инвариант §10.4)."""
    con = wscore.connect(empty_db)
    seed_cache(con, {
        "фон": [("фон", 1000), ("убрать фон", 500)],
        "убрать фон": [("убрать фон", 500), ("убрать фон видео", 300)],
        "убрать фон видео": [("убрать фон видео", 300)],
    })
    await wscore.crawl_subtree(con, "фон")
    before = counts(con)
    fetch_spy.clear()

    res = await wscore.crawl_subtree(con, "фон")

    assert fetch_spy == [] and res["fetched"] == 0
    assert counts(con) == before
    assert wscore.net_calls() == 0
    con.close()


async def test_crawl_keeps_pipeline_statuses(empty_db):
    """Идемпотентность краула: узлы, ушедшие дальше по пайплайну, не откатываются."""
    con = wscore.connect(empty_db)
    seed_cache(con, {"фон": [("фон", 1000), ("убрать фон", 500)],
                     "убрать фон": [("убрать фон", 500)]})
    await wscore.crawl_subtree(con, "фон")
    wscore.set_status(con, "убрать фон", "TRANSACTIONAL", kind="transactional")

    await wscore.crawl_subtree(con, "фон")
    assert node_row(con, "убрать фон")["status"] == "TRANSACTIONAL"
    con.close()


def test_estimate_subtree_counts_pending_fetches(empty_db):
    """Оценка объёма — нижняя граница: считает нефетченные узлы с freq >= FLOOR."""
    con = wscore.connect(empty_db)
    wscore.upsert_node(con, "фон", freq=1000, queried=True)
    for phrase, freq in (("убрать фон", 500), ("фон мелочь", 10)):
        wscore.upsert_node(con, phrase, freq=freq)
        con.execute("INSERT OR IGNORE INTO edge(parent, child) VALUES ('фон', ?)", (phrase,))
    con.commit()

    est = wscore.estimate_subtree(con, "фон")
    assert est == {"nodes": 3, "requests": 1}
    assert wscore.estimate_subtree(con, "неизвестная фраза") == {"nodes": 1, "requests": 1}
    con.close()


# ---------------------------------------------------------------- §5 serp и отчёты

def test_save_serp_is_all_or_nothing(empty_db):
    """Нет частичной выдачи: одна выдача -> ValueError и в БД не попало ничего (§10.2)."""
    con = wscore.connect(empty_db)
    wscore.upsert_node(con, "фон", freq=100)
    with pytest.raises(ValueError):
        wscore.save_serp(con, "фон", {"yandex": {"docs": [{"rank": 1}]}})
    assert wscore.load_serp(con, "фон") == {}

    wscore.save_serp(con, "фон", {"yandex": {"found": 1, "docs": []}, "google": {"docs": []}})
    assert set(wscore.load_serp(con, "фон")) == {"yandex", "google"}
    con.close()


def test_override_kind_moves_kind_and_status_together(snapshot_db):
    """Fix kind правит метку и статус вместе; собранные данные не удаляются (design §2)."""
    con = wscore.connect(snapshot_db)
    phrase = SNAP["LOW_SCORED"]
    before = node_row(con, phrase)
    delta = wscore.override_kind(con, phrase, "transactional")

    assert (delta["kind"], delta["status"]) == ("transactional", "TRANSACTIONAL")
    after = node_row(con, phrase)
    assert after["score"] == before["score"], "скор не удаляется"
    assert wscore.load_serp(con, phrase), "выдача не удаляется"
    with pytest.raises(ValueError):
        wscore.override_kind(con, phrase, "мусор")
    con.close()


def test_clear_stale_locks_frees_nodes(snapshot_db):
    """Рестарт: незавершённые задачи -> FAILED, блокировки узлов снимаются (tech §2)."""
    con = wscore.connect(snapshot_db)
    con.execute("INSERT INTO task(id, type, status, node, created_at) VALUES "
                "('stuck-1', 'classify', 'RUNNING', ?, 0)", (SNAP["FULLY_LOADED"],))
    wscore.set_status(con, SNAP["FULLY_LOADED"], None, task_id="stuck-1")

    freed = wscore.clear_stale_locks(con)

    assert freed == 1
    assert node_row(con, SNAP["FULLY_LOADED"])["task_id"] is None
    assert node_row(con, SNAP["FULLY_LOADED"])["status"] == "FULLY_LOADED", "статус не тронут"
    row = con.execute("SELECT status, error FROM task WHERE id = 'stuck-1'").fetchone()
    assert row[0] == "FAILED" and row[1]
    con.close()


# ------------------------------------------------- аддитивность схемы (tech §5, боль из практики)

def test_new_column_does_not_wipe_pipeline_results(tmp_path):
    """Добавление колонки НЕ должно пересоздавать node: результаты пайплайна оплачены.

    Прецедент: колонку внесли в признак «схема старая» — node/edge пересоздались из cache,
    и разметка classify исчезла. Пересоздание допустимо ТОЛЬКО для схемы этапа 1-2 (нет status).
    """
    db = tmp_path / "s.db"
    con = wscore.connect(db)
    wscore.upsert_node(con, "фраза", freq=500)
    wscore.set_status(con, "фраза", "TRANSACTIONAL", kind="transactional")
    con.close()

    # имитируем «в схеме появилась новая колонка, которой в файле БД ещё нет»
    saved = wscore._NODE_LATE_COLS
    wscore._NODE_LATE_COLS = saved + (("probe_col", "TEXT"),)
    try:
        con = wscore.connect(db)
        cols = {c[1] for c in con.execute("PRAGMA table_info(node)")}
        assert "probe_col" in cols, "новая колонка должна добавляться ALTER TABLE"
        row = wscore.get_node(con, "фраза")
        assert row is not None, "узел не должен исчезнуть при добавлении колонки"
        assert (row["status"], row["kind"]) == ("TRANSACTIONAL", "transactional"), \
            "разметка пайплайна должна выжить"
        con.close()
    finally:
        wscore._NODE_LATE_COLS = saved


def test_pre_pipeline_schema_is_still_rebuilt(tmp_path):
    """Схема этапа 1-2 (без status) — единственный случай, когда node/edge пересобираются."""
    db = tmp_path / "old.db"
    con = wscore.connect(db)
    con.execute("DROP TABLE node")
    con.execute("CREATE TABLE node (phrase TEXT PRIMARY KEY, freq INTEGER, queried INTEGER "
                "NOT NULL DEFAULT 0, total_refinements INTEGER NOT NULL DEFAULT 0, "
                "queried_at INTEGER, score REAL, verdict TEXT, note TEXT)")
    con.execute("INSERT INTO node(phrase, freq, queried) VALUES ('старая', 100, 1)")
    con.commit()
    con.close()

    con = wscore.connect(db)
    cols = {c[1] for c in con.execute("PRAGMA table_info(node)")}
    assert {"status", "kind", "task_id"} <= cols, "схема должна стать полной"


# ------------------------------------------------- отказ XMLRiver (боль из практики: 97 записей)

def test_xmlriver_error_body_is_not_cached_and_not_an_empty_pool(empty_db, monkeypatch):
    """XMLRiver отдаёт отказ с HTTP 200 и телом {"code":500,...}.

    Прецедент: такие ответы осели в кэше как «уточнений нет» — 97 записей, 12% кэша,
    и 97 узлов навсегда стали листьями. Отказ обязан быть исключением, а не пустым пулом.
    """
    # автофикстура держит «только кэш» и запрещает сеть; здесь клиент замокан,
    # реального запроса нет — снимаем оба ограничения, счётчик обнулим в конце.
    monkeypatch.setattr(wscore, "cache_only", lambda: False)
    calls = {"n": 0}

    class Resp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"code": 500, "error": "Выполните перезапрос."}

    monkeypatch.setattr(wscore, "RETRY_DELAYS", ())          # без задержек в тесте
    monkeypatch.setattr(wscore._client, "get", lambda *a, **k: (calls.__setitem__("n", calls["n"] + 1), Resp())[1])

    con = wscore.connect(empty_db)
    with pytest.raises(wscore.XmlRiverError):
        wscore.fetch_wordstat("проба", con)
    assert calls["n"] == 1, "без RETRY_DELAYS — одна попытка"
    assert con.execute("SELECT COUNT(*) FROM cache").fetchone()[0] == 0, \
        "отказ НЕ должен попадать в кэш"

    wscore.reset_net_calls()   # запросов по сети не было: клиент замокан

def test_transient_error_is_retried_then_succeeds(empty_db, monkeypatch):
    """code=500 «Выполните перезапрос» повторяется; успех на повторе кэшируется."""
    # автофикстура держит «только кэш» и запрещает сеть; здесь клиент замокан,
    # реального запроса нет — снимаем оба ограничения, счётчик обнулим в конце.
    monkeypatch.setattr(wscore, "cache_only", lambda: False)
    seq = [{"code": 500, "error": "Выполните перезапрос."},
           {"popular": [{"text": "проба глубже", "value": 100}]}]

    class Resp:
        def __init__(self, body): self.body = body
        def raise_for_status(self): pass
        def json(self): return self.body

    monkeypatch.setattr(wscore, "RETRY_DELAYS", (0,))
    monkeypatch.setattr(wscore._client, "get", lambda *a, **k: Resp(seq.pop(0)))

    con = wscore.connect(empty_db)
    data = wscore.fetch_wordstat("проба", con)
    assert wscore.parse_popular(data), "второй попыткой должен прийти результат"
    assert con.execute("SELECT COUNT(*) FROM cache").fetchone()[0] == 1, "успех кэшируется"

    wscore.reset_net_calls()   # запросов по сети не было: клиент замокан

def test_non_transient_error_is_not_retried(empty_db, monkeypatch):
    """Ошибка в параметрах (code=104) повторяться не должна — это не транзиентный отказ."""
    # автофикстура держит «только кэш» и запрещает сеть; здесь клиент замокан,
    # реального запроса нет — снимаем оба ограничения, счётчик обнулим в конце.
    monkeypatch.setattr(wscore, "cache_only", lambda: False)
    calls = {"n": 0}

    class Resp:
        def raise_for_status(self): pass
        def json(self): return {"code": 104, "error": "Неверный параметр loc!"}

    monkeypatch.setattr(wscore, "RETRY_DELAYS", (0, 0, 0))
    monkeypatch.setattr(wscore._client, "get",
                        lambda *a, **k: (calls.__setitem__("n", calls["n"] + 1), Resp())[1])

    con = wscore.connect(empty_db)
    with pytest.raises(wscore.XmlRiverError):
        wscore.fetch_wordstat("проба", con)
    assert calls["n"] == 1, "непереходную ошибку повторять бессмысленно"

    wscore.reset_net_calls()   # запросов по сети не было: клиент замокан

def test_old_poisoned_cache_entry_is_dropped_on_read(empty_db, monkeypatch):
    """Отрава, осевшая в кэше раньше, при чтении выбрасывается, а не выдаётся за результат."""
    con = wscore.connect(empty_db)
    con.execute("INSERT INTO cache(query, response, ts) VALUES (?, ?, 0)",
                ("проба", json.dumps({"code": 500, "error": "Выполните перезапрос."})))
    con.commit()
    monkeypatch.setattr(wscore, "RETRY_DELAYS", ())
    monkeypatch.setattr(wscore, "cache_only", lambda: True)   # в сеть не пойдём

    data = wscore.fetch_wordstat("проба", con)
    assert wscore.parse_popular(data) == [], "в кэш-онли вернётся пустой пул"
    assert con.execute("SELECT COUNT(*) FROM cache").fetchone()[0] == 0, "отрава удалена"
