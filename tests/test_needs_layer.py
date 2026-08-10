"""Второй слой: чтение папки с деревьями потребностей и разбор работы.

Слой файловый и одноразовый, поэтому проверяем ровно две вещи: что чтение папки не роняет
сервер на любом мусоре, и что `Analyze` на работе делает обещанную цепочку — выдача (из
оплаченного кэша `serp`) и затем Opus, а результат ложится файлом рядом с деревом, НЕ в `node`.
"""
import json
import time

import pytest

import needs_layer
import tasks
import wscore
from conftest import SNAP, TOKEN, node_row, task_done, task_row, wait_for
import fake_worker
from fake_worker import FakeWorker

TREE_ID = "t-001"
WORK = "убрать фон с картинки"
GAP_WORK = "убрать фон на видео"
GROUP = "micro-1"
GAP_GROUP = "micro-2"


def products_doc():
    """Группировка из двух микропродуктов и накрывающих их medium/macro.

    Разборы идут по ГРУППЕ, поэтому без неё их вызвать нечем. Уровни вложены, покрытие полное —
    ровно то, что требует приёмник."""
    def g(gid, level, works, parent):
        return {"id": gid, "level": level, "name": f"продукт {gid}", "works": works,
                "parent": parent, "input": "картинка", "engine": "сегментация",
                "output": "картинка без фона", "money": "разово 199 ₽",
                "pool": 900, "pool_why": "одна дверь 900",
                "core": "загрузил — получил", "order": [], "why": "один вход и один движок"}
    return {"groups": [g("macro-1", "macro", [WORK, GAP_WORK], None),
                       g("medium-1", "medium", [WORK, GAP_WORK], "macro-1"),
                       g(GROUP, "micro", [WORK], "medium-1"),
                       g(GAP_GROUP, "micro", [GAP_WORK], "medium-1")]}


def put_products(needs_dir, tree_id, task_id="p-001", revision=0):
    d = needs_dir / tree_id / "products"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"products-{task_id}.json").write_text(json.dumps(
        {"task_id": task_id, "model_family": "claude", "created_at": 1, "why": "тест",
         "tree_revision": revision, **products_doc()}, ensure_ascii=False), encoding="utf-8")


def tree_doc(phrases, gap_phrases):
    return {"condition": "онлайн · бесплатно",
            "works": [
                {"name": WORK, "score": 40, "score_why": "занято, но выдачу стоит глянуть",
                 "phrases": phrases, "top_freq": 900, "phrase_count": len(phrases),
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
    put_products(needs_dir, TREE_ID)
    wscore.save_serp(snap_con, SNAP["TRANSACTIONAL"],
                     {e: {"found": 1000, "docs": docs(SNAP["TRANSACTIONAL"], e)}
                      for e in wscore.SERP_ENGINES})
    snap_con.commit()
    return phrases, gap


# ---------- чтение папки ----------

def test_rows_and_detail_join_freqs(client, seeded):
    row = client.get("/api/needs/trees").json()["trees"][0]
    assert row["id"] == TREE_ID and row["works"] == 2
    assert row["ranked"] == 0 and row["best_score"] is None, \
        "классификация сама продуктовый шанс не назначает"
    assert row["root"] == SNAP["FULLY_LOADED"] and row["analyzed"] == 0

    d = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert d["condition"] == "онлайн · бесплатно"
    work = next(w for w in d["works"] if w["name"] == WORK)
    # частоты в дереве не хранятся — они подставляются из входа сборки
    assert [p["freq"] for p in work["phrases"]] == [900, 500]
    assert work["sum_freq"] == 1400
    assert work["top_freq"] == 900
    assert work["score"] is None
    assert work["favorite"] is False
    assert work["artifacts"] == []
    assert d["excluded"][0]["freq"] == 90000


def test_favorite_is_persistent_sidecar_and_does_not_change_classification(
        client, seeded, needs_dir):
    accepted = needs_dir / TREE_ID / "accepted.json"
    before = accepted.read_bytes()

    marked = client.post("/api/needs/favorite", json={
        "tree_id": TREE_ID, "work": WORK, "favorite": True,
    })
    assert marked.status_code == 200
    assert marked.json() == {"work": WORK, "favorite": True, "favorites": [WORK]}
    assert accepted.read_bytes() == before
    assert json.loads((needs_dir / TREE_ID / "favorites.json").read_text(encoding="utf-8"))[
        "works"
    ] == [WORK]

    detail = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert next(w for w in detail["works"] if w["name"] == WORK)["favorite"] is True
    assert next(w for w in detail["works"] if w["name"] == GAP_WORK)["favorite"] is False

    unmarked = client.post("/api/needs/favorite", json={
        "tree_id": TREE_ID, "work": WORK, "favorite": False,
    })
    assert unmarked.status_code == 200
    assert unmarked.json()["favorites"] == []
    assert next(w for w in client.get(f"/api/needs/tree/{TREE_ID}").json()["works"]
                if w["name"] == WORK)["favorite"] is False


def test_favorite_rejects_unknown_work(client, seeded):
    response = client.post("/api/needs/favorite", json={
        "tree_id": TREE_ID, "work": "нет такой работы", "favorite": True,
    })
    assert response.status_code == 422
    assert "работы нет" in response.json()["detail"]


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


# ---------- второй проход классификации ----------

def refined_tree():
    """Корректный второй проход: неоднозначная фраза уходит из конкретной работы."""
    return {
        "condition": "онлайн · бесплатно",
        "works": [
            {"name": WORK, "phrases": [SNAP["TRANSACTIONAL"]],
             "top_freq": 900, "phrase_count": 1,
             "unclear": False, "why": "один результат",
             "segments": []},
            {"name": GAP_WORK, "phrases": [SNAP["NEW"]],
             "top_freq": 40, "phrase_count": 1,
             "unclear": False, "why": "другой продукт",
             "segments": []},
            {"name": "что-то сделать — результат из фразы не ясен",
             "phrases": [SNAP["LOADED"]], "top_freq": 500, "phrase_count": 1,
             "unclear": True,
             "why": "результат нельзя выбрать без догадки", "segments": []},
        ],
        "excluded": [{"phrase": SNAP["HEAD"], "why": "condition", "note": None}],
    }


def test_strict_validation_enforces_unclear_and_exact_counts(seeded):
    source = needs_layer.load_source(TREE_ID)
    bad = refined_tree()
    bad["works"][2].update({"unclear": "да", "phrase_count": 99, "top_freq": 1})
    problems = needs_layer.validate_tree(source, bad, strict=True)

    assert any("phrase_count" in p for p in problems)
    assert any("top_freq" in p for p in problems)
    assert any("unclear должен" in p for p in problems)


def test_classification_rejects_old_chance_fields(seeded):
    source = needs_layer.load_source(TREE_ID)
    answer = refined_tree()
    answer["works"][0]["score"] = 82
    answer["works"][0]["gap_candidate"] = True

    problems = needs_layer.validate_tree(source, answer, strict=True)

    assert any("классификация не должна содержать продуктовый анализ" in p for p in problems)


def test_refine_routes_family_replaces_tree_and_keeps_revision(
        client, seeded, snap_con, needs_dir):
    needs_layer.save_artifact(TREE_ID, WORK, "analyze", {
        "task_id": "old-report", "created_at": 1, "model_family": "claude",
        "verdict": "BUILD", "verdict_score": 80,
    })
    with FakeWorker(client, TOKEN, model_family="codex", answer=lambda job: refined_tree()) as worker:
        response = client.post("/api/needs/refine", json={
            "tree_id": TREE_ID, "model_family": "codex",
        })
        assert response.status_code == 200
        row = task_done(snap_con, response.json()["task_id"])

    assert row["status"] == "DONE", row["error"]
    assert [(j["type"], j["model_family"]) for j in worker.seen] == [
        ("needs_refine", "codex")
    ]
    tree, _, _ = needs_layer.load_tree(TREE_ID)
    assert tree["_revision"] == 1 and tree["_refined_by"] == "codex"
    assert all("score" not in w and "occupied_by" not in w for w in tree["works"]), \
        "в канонической классификации нет продуктовых гипотез"
    assert next(w for w in tree["works"] if w["unclear"])["phrases"] == [SNAP["LOADED"]]
    detail = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert detail["revision"] == 1 and detail["refined_by"] == "codex"
    assert detail["refinements"][0]["from_revision"] == 0
    assert list((needs_dir / TREE_ID / "revisions").glob("revision-0-before-*.json"))
    assert needs_layer.work_artifacts(TREE_ID) == {}, "отчёт старой классификации не текущий"
    stale = needs_layer.work_artifacts(TREE_ID, include_stale=True)
    assert stale[needs_layer._norm(WORK)][0]["task_id"] == "old-report"


def test_invalid_refine_fails_without_changing_tree(client, seeded, snap_con):
    before, _, _ = needs_layer.load_tree(TREE_ID)
    invalid = refined_tree()
    invalid["works"][0]["phrases"] = []  # одна исходная фраза потеряна
    invalid["works"][0]["phrase_count"] = 0
    invalid["works"][0]["top_freq"] = 0
    with FakeWorker(client, TOKEN, model_family="claude", answer=lambda job: invalid):
        tid = client.post("/api/needs/refine", json={
            "tree_id": TREE_ID, "model_family": "claude",
        }).json()["task_id"]
        row = task_done(snap_con, tid)

    assert row["status"] == "FAILED" and "потеряно" in row["error"]
    after, _, _ = needs_layer.load_tree(TREE_ID)
    assert after == before


def test_refine_is_exclusive_for_both_families_and_work_actions(
        client, seeded, snap_con, llm_timeout):
    llm_timeout(0.2)
    first = client.post("/api/needs/refine", json={
        "tree_id": TREE_ID, "model_family": "claude",
    })
    assert first.status_code == 200
    assert client.post("/api/needs/refine", json={
        "tree_id": TREE_ID, "model_family": "codex",
    }).status_code == 409
    assert client.post("/api/needs/analyze", json={
        "tree_id": TREE_ID, "group": GROUP, "model_family": "codex",
    }).status_code == 409
    assert client.post("/api/needs/rank", json={
        "tree_id": TREE_ID, "model_family": "codex",
    }).status_code == 409
    assert task_done(snap_con, first.json()["task_id"])["status"] == "FAILED"


# ---------- анализ физической возможности продукта ----------

def rank_answer(job, wrong_score=False):
    classification = job["params"]["classification"]
    out = []
    for work in classification["works"]:
        product = work["name"] == GAP_WORK
        item = {
            "name": work["name"],
            "intent": "product" if product else "support",
            "factors": {k: 80 if product else 90 for k in needs_layer.RANK_FACTORS},
            "score_why": "самостоятельный инструмент возможен" if product
                         else "это починка чужого продукта",
            "product": "видео → фон удалён" if product else None,
            "blocker": None if product else "результат контролирует чужой продукт",
            "evidence": [needs_layer.work_phrases(work)[0]],
        }
        item["score"] = needs_layer.rank_score(item) + (1 if wrong_score else 0)
        out.append(item)
    return {"works": out}


def test_rank_uses_accepted_classification_and_stores_separate_artifact(
        client, seeded, snap_con):
    before, _, _ = needs_layer.load_tree(TREE_ID)
    with FakeWorker(client, TOKEN, model_family="codex",
                    answer=lambda job: rank_answer(job)) as worker:
        response = client.post("/api/needs/rank", json={
            "tree_id": TREE_ID, "model_family": "codex",
        })
        assert response.status_code == 200
        row = task_done(snap_con, response.json()["task_id"])

    assert row["status"] == "DONE", row["error"]
    assert [(j["type"], j["model_family"]) for j in worker.seen] == [
        ("needs_rank", "codex")
    ]
    assert needs_layer.load_tree(TREE_ID)[0] == before, "анализ не меняет классификацию"
    ranking = needs_layer.latest_ranking(TREE_ID)
    assert ranking["model_family"] == "codex" and ranking["tree_revision"] == 0
    assert {w["name"]: w["score"] for w in ranking["works"]} == {WORK: 20, GAP_WORK: 80}

    detail = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert detail["ranked_by"] == "codex" and detail["counts"]["best_score"] == 80
    assert [w["name"] for w in detail["works"]] == [GAP_WORK, WORK], \
        "после анализа работы ранжируются по продуктовому score"


def test_rank_rejects_unverifiable_score(client, seeded, snap_con):
    with FakeWorker(client, TOKEN, model_family="claude",
                    answer=lambda job: rank_answer(job, wrong_score=True)):
        tid = client.post("/api/needs/rank", json={
            "tree_id": TREE_ID, "model_family": "claude",
        }).json()["task_id"]
        row = task_done(snap_con, tid)

    assert row["status"] == "FAILED" and "по факторам" in (row["error"] or "")
    assert needs_layer.latest_ranking(TREE_ID) is None


def test_rank_is_exclusive_with_refine_and_work_actions(
        client, seeded, snap_con, llm_timeout):
    llm_timeout(0.2)
    first = client.post("/api/needs/rank", json={
        "tree_id": TREE_ID, "model_family": "claude",
    })
    assert first.status_code == 200
    assert client.post("/api/needs/rank", json={
        "tree_id": TREE_ID, "model_family": "codex",
    }).status_code == 409
    assert client.post("/api/needs/refine", json={
        "tree_id": TREE_ID, "model_family": "codex",
    }).status_code == 409
    assert client.post("/api/needs/analyze", json={
        "tree_id": TREE_ID, "group": GROUP, "model_family": "codex",
    }).status_code == 409
    assert task_done(snap_con, first.json()["task_id"])["status"] == "FAILED"


def test_second_pass_invalidates_ranking_of_previous_classification(
        client, seeded, snap_con):
    original = needs_layer.classification_only(needs_layer.load_tree(TREE_ID)[0])
    needs_layer.save_ranking(
        TREE_ID, rank_answer({"params": {"classification": original}}),
        "rank-old", "claude", expected_revision=0,
    )
    assert client.get(f"/api/needs/tree/{TREE_ID}").json()["ranked_at"] is not None

    with FakeWorker(client, TOKEN, model_family="codex", answer=lambda job: refined_tree()):
        tid = client.post("/api/needs/refine", json={
            "tree_id": TREE_ID, "model_family": "codex",
        }).json()["task_id"]
        row = task_done(snap_con, tid)

    assert row["status"] == "DONE", row["error"]
    detail = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert detail["revision"] == 1 and detail["ranked_at"] is None
    assert detail["counts"]["ranked"] == 0 and detail["counts"]["best_score"] is None
    assert all(work["score"] is None for work in detail["works"])


# ---------- разбор работы ----------

def test_analyze_work_buys_serp_then_calls_llm(client, seeded, snap_con, reports_dir):
    """Цепочка: выдача -> Opus -> отчёт файлом рядом с деревом; `node` не тронут."""
    with FakeWorker(client, TOKEN, verdict="BUILD", verdict_score=88):
        r = client.post("/api/needs/analyze", json={"tree_id": TREE_ID, "group": GROUP})
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
    group = next(g for g in d["products"]["groups"] if g["id"] == GROUP)
    art = next(a for a in group["artifacts"] if a["kind"] == "analyze")
    assert art["verdict"] == "BUILD"
    assert art["model_family"] == "claude", "старый/default запуск — Claude"
    assert (reports_dir / f"{task_id}.html").is_file()
    assert art["report_link"] == f"reports/{task_id}.html"
    # статус узла первого слоя не изменился: второй слой в модель не пишет
    assert node_row(snap_con, SNAP["TRANSACTIONAL"])["status"] == "TRANSACTIONAL"


def test_analyze_reuses_paid_serp_without_network(client, seeded, snap_con):
    """Разбор берёт выдачу из оплаченного кэша (ключ «фраза+движок») и в сеть не идёт —
    ни в первый раз, ни при повторе."""
    with FakeWorker(client, TOKEN):
        for _ in range(2):
            tid = client.post("/api/needs/analyze",
                              json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
            assert task_done(snap_con, tid)["status"] == "DONE"
    assert wscore.net_calls() == 0


def test_analyze_adv_is_a_second_opinion_on_the_same_paid_serp(client, seeded, snap_con,
                                                               reports_dir):
    """`Analyze Adv` — второй разбор той же работы другим вопросом.

    Он живёт рядом с обычным, а не вместо него: свой тип джоба, свой артефакт, та же выдача из
    оплаченного кэша (значит по разобранной работе он бесплатен). Единица его ответа — функция,
    поэтому пустой список функций не принимается."""
    with FakeWorker(client, TOKEN) as fake:
        tid = client.post("/api/needs/analyze_adv",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)

    assert row["status"] == "DONE", row["error"]
    assert [s["type"] for s in fake.seen] == ["analyze_adv"], "свой тип джоба, не analyze_work"
    assert wscore.net_calls() == 0, "выдача взята из кэша — второй разбор бесплатен"

    res = json.loads(row["result"])
    assert res["functions"] >= 1 and res["best"], "единица ответа — функция"
    arts = needs_layer.group_artifacts(TREE_ID)[GROUP]
    adv = next(a for a in arts if a["kind"] == "analyze_adv")
    assert adv["functions"][0]["entry_query"], "у функции есть входная фраза из поиска"
    assert adv["report_link"] != next(
        (a["report_link"] for a in arts if a["kind"] == "analyze"), None), \
        "у двух разборов разные отчёты"


def test_next_analysis_reads_the_latest_report_of_any_family(
        client, seeded, snap_con, reports_dir):
    """Разбор берёт ПОСЛЕДНИЙ отчёт, чьё бы семейство он ни был.

    Раньше «Продукт» на Claude не видел разбор codex и падал с «нужен предыдущий разбор», хотя
    отчёт лежал рядом. Разбор — это довод, а не собственность модели: автор указан в поле `by`,
    чтобы расхождение читалось как расхождение, а не как своя же ошибка."""
    seen = {}

    def spy(job):
        seen[(job["type"], job.get("model_family"))] = job["params"]
        return fake_worker.canned(job)

    with FakeWorker(client, TOKEN, model_family="codex", answer=spy):
        tid = client.post("/api/needs/analyze", json={
            "tree_id": TREE_ID, "group": GROUP, "model_family": "codex"}).json()["task_id"]
        assert task_done(snap_con, tid)["status"] == "DONE"
    time.sleep(1.1)     # дата артефакта в секундах: иначе прогоны неразличимы

    with FakeWorker(client, TOKEN, model_family="claude", answer=spy):
        for action in ("analyze_adv", "product"):
            tid = client.post(f"/api/needs/{action}", json={
                "tree_id": TREE_ID, "group": GROUP,
                "model_family": "claude"}).json()["task_id"]
            row = task_done(snap_con, tid)
            assert row["status"] == "DONE", row["error"]
            time.sleep(1.1)

    adv_ctx = seen[("analyze_adv", "claude")]["context"]
    assert [v["by"] for v in adv_ctx["previous_verdicts"]] == ["codex"], \
        "Claude видит вердикт codex и знает, кто автор"

    prod_ctx = seen[("analyze_product", "claude")]["context"]
    assert prod_ctx["niche"]["by"] == "codex" and prod_ctx["niche"]["report"], \
        "отчёт «Ниша» от codex пришёл целиком текстом"
    assert prod_ctx["features"]["by"] == "claude", "«Функции» — свой, более свежий"


def test_analyze_product_reads_both_previous_reports_and_keeps_the_score_trail(
        client, seeded, snap_con, reports_dir):
    """`Продукт` — третий разбор: решение по выдаче ПЛЮС двум предыдущим отчётам целиком.

    Ему на вход кладут последние прогоны «Ниши» и «Функций» текстом, а не только их оценки:
    цены конкурентов и барьеры там уже собраны, переоткрывать их незачем. В артефакте остаются
    все три оценки — по ним видно, как менялось мнение."""
    seen_params = {}
    with FakeWorker(client, TOKEN,
                    answer=lambda job: (seen_params.setdefault(job["type"], job["params"]),
                                        fake_worker.canned(job))[1]):
        for i, action in enumerate(("analyze", "analyze_adv", "product")):
            if i:
                time.sleep(1.1)   # дата артефакта в секундах: иначе прогоны неразличимы
            tid = client.post(f"/api/needs/{action}",
                              json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
            row = task_done(snap_con, tid)
            assert row["status"] == "DONE", row["error"]

    ctx = seen_params["analyze_product"]["context"]
    assert ctx["niche"]["report"] and ctx["features"]["report"], "оба отчёта пришли текстом"
    assert "Скоркарта" in ctx["niche"]["report"], "текст отчёта, а не ссылка на него"
    assert seen_params["analyze_product"]["serps"], "выдача тоже на входе: она первоисточник"

    arts = needs_layer.group_artifacts(TREE_ID)[GROUP]
    prod = next(a for a in arts if a["kind"] == "analyze_product")
    assert prod["spec"]["product"] and prod["spec"]["price"], "ответ — спецификация"
    assert [m["month"] for m in prod["forecast"]["months"]] == [1, 2, 3, 6], "прогноз по месяцам"
    assert prod["forecast"]["assumptions"][0]["source"], "у допущения есть источник"
    assert prod["forecast"]["invest_case"], "отчёт отвечает, зачем вкладываться"
    assert prod["spec"]["price"] in prod["summary"], "в строке работы видно, что строим и почём"
    assert "платящих" not in prod["summary"], "разовая покупка не описывается метриками подписки"
    assert set(prod["scores"]) == {"niche", "features", "product"}, "видно, как менялось мнение"
    assert prod["report_link"] not in [a["report_link"] for a in arts
                                       if a["kind"] != "analyze_product"], "свой отчёт"


def test_analyze_product_needs_a_previous_analysis(client, seeded, snap_con):
    """Без «Ниши» и «Функций» третий разбор не запускается: ему нечего сводить."""
    with FakeWorker(client, TOKEN):
        tid = client.post("/api/needs/product",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED" and "разбор" in (row["error"] or "")


def test_product_takes_the_freshest_report_even_from_another_family(
        client, seeded, snap_con, reports_dir):
    """Codex Product берёт свежий отчёт Claude, а не свой прошлый: свежесть важнее авторства.

    Автор приезжает в поле `by` — модель должна знать, чей это довод, чтобы расхождение
    читалось как расхождение двух моделей, а не как её собственная ошибка."""
    seen = {}
    for i, family in enumerate(("codex", "claude"), 1):
        for kind in ("analyze", "analyze_adv"):
            report = reports_dir / f"{family}-{kind}.html"
            report.write_text(f"<html><body>{family} {kind} " + "данные " * 40 +
                              "</body></html>", encoding="utf-8")
            data = {"task_id": f"{family}-{kind}", "created_at": i,
                    "model_family": family, "verdict": "MAYBE", "verdict_score": 50 + i,
                    "report_link": f"reports/{report.name}"}
            if kind == "analyze_adv":
                data["functions"] = [{"name": f"{family}-функция", "score": 50 + i}]
            needs_layer.save_group_artifact(TREE_ID, GROUP, kind, data)

    def answer(job):
        if job["type"] == "analyze_product":
            seen.update(job["params"]["context"])
        return fake_worker.canned(job)

    with FakeWorker(client, TOKEN, answer=answer, model_family="codex"):
        tid = client.post("/api/needs/product", json={
            "tree_id": TREE_ID, "group": GROUP, "model_family": "codex",
        }).json()["task_id"]
        row = task_done(snap_con, tid)

    assert row["status"] == "DONE", row["error"]
    assert row["model_family"] == "codex", "сам разбор всё равно идёт своим семейством"
    assert seen["niche"]["by"] == "claude" and "claude analyze" in seen["niche"]["report"]
    assert seen["features"]["by"] == "claude"
    assert seen["features"]["functions"][0]["name"] == "claude-функция"


def test_analyze_product_rejects_a_forecast_of_zeros(client, seeded, snap_con, reports_dir):
    """Прогноз обязателен, и таблица нулей за него не считается.

    Спецификация без чисел не говорит, за что боремся и сколько сюда можно вложить. «Продукт не
    взлетает» — это вердикт `SKIP` с объяснением, а не пустые числа, по которым не видно, считал
    ли кто-нибудь вообще."""
    def zeros(job):
        res = fake_worker.canned(job)
        if job["type"] == "analyze_product":
            for m in res["forecast"]["months"]:
                m.update({k: 0 for k in m if k != "month"})
        return res

    with FakeWorker(client, TOKEN, answer=zeros):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        assert task_done(snap_con, tid)["status"] == "DONE"
        tid = client.post("/api/needs/product",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED" and "нулей" in (row["error"] or "")


def test_analyze_product_rejects_a_spec_without_price(client, seeded, snap_con, reports_dir):
    """Спецификация без цены и причины платить — не спецификация, а рассуждение."""
    def answer(job):
        res = fake_worker.canned(job)
        if job["type"] == "analyze_product":
            res["spec"]["price"] = res["spec"]["why_pay"] = ""
        return res

    with FakeWorker(client, TOKEN, answer=answer):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        assert task_done(snap_con, tid)["status"] == "DONE"
        tid = client.post("/api/needs/product",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED" and "price" in (row["error"] or "")


def test_reports_show_both_kinds_newest_first(client, seeded, snap_con):
    """Вкладка «Отчёты»: оба вида разбора отдельными строками, новые сверху.

    Раньше список фильтровался по виду `analyze`, и Adv-разборы в раздел не попадали вовсе;
    сортировка по оценке топила свежий прогон в хвосте таблицы."""
    with FakeWorker(client, TOKEN):
        for i, action in enumerate(("analyze", "analyze_adv")):
            if i:
                time.sleep(1.1)   # дата артефакта в секундах: иначе прогоны неразличимы
            tid = client.post(f"/api/needs/{action}",
                              json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
            assert task_done(snap_con, tid)["status"] == "DONE"

    rows = client.get("/api/needs/reports").json()["reports"]
    mine = [r for r in rows if r["group"] == GROUP]
    assert {r["kind"] for r in mine} == {"analyze", "analyze_adv"}, "оба разбора видны"
    assert mine[0]["kind"] == "analyze_adv", "последний прогон — первой строкой"
    dates = [r["created_at"] or 0 for r in rows]
    assert dates == sorted(dates, reverse=True), "весь список отсортирован по дате"


def test_artifact_without_family_reads_as_claude(needs_dir):
    """Артефакт без явного семейства читается как запуск Claude, файл при этом не переписывается."""
    root = put_tree(needs_dir, TREE_ID, tree_doc([SNAP["NEW"]], []),
                    {"root": SNAP["HEAD"], "nodes": []})
    artifact_dir = root / "artifacts" / needs_layer.slug(WORK)
    artifact_dir.mkdir(parents=True)
    old = artifact_dir / "analyze-old.json"
    old.write_text(json.dumps({"work": WORK, "kind": "analyze", "task_id": "old",
                               "created_at": 1, "verdict": "SKIP", "verdict_score": 20,
                               "tree_revision": 0}, ensure_ascii=False), encoding="utf-8")

    got = needs_layer.work_artifacts(TREE_ID)[needs_layer._norm(WORK)][0]
    assert got["model_family"] == "claude"
    assert "model_family" not in json.loads(old.read_text(encoding="utf-8"))


def test_report_is_a_page_even_if_the_model_returns_a_fragment(client, seeded, snap_con,
                                                              reports_dir):
    """Оболочку отчёта делает система, а не модель.

    Модель регулярно возвращает голое тело без `<html>` и `<style>` — в браузере это нечитаемо,
    и полагаться на её вёрстку нельзя: шаблон лежит в репозитории, а агент туда не ходит."""
    body = "<h2>Коротко</h2><p>" + "текст " * 40 + "</p>"
    with FakeWorker(client, TOKEN, answer=lambda job: {
            "functions": [{"name": "делает X", "entry_query": "x", "score": 50,
                           "money": "тариф 300 ₽/мес", "cost": "2 ₽ за вызов"}],
            "recommendation": "MAYBE", "verdict_score": 50, "confidence": 0.5,
            "report_html": body}):
        tid = client.post("/api/needs/analyze_adv",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        assert task_done(snap_con, tid)["status"] == "DONE"

    page = (reports_dir / f"{tid}.html").read_text(encoding="utf-8")
    assert page.lstrip().lower().startswith("<!doctype html>")
    assert "<style>" in page and "<h1>" in page, "есть стили и заголовок"
    assert '<span class="verdict MAYBE">MAYBE</span>' in page, "шапка с вердиктом"
    assert '<span class="bigscore">50</span>' in page, "и с крупной оценкой"
    assert body in page, "тело модели не потеряно"
    assert "Входные данные" in page, "блок входных данных на месте"


def test_dump_saves_pages_by_engine_and_query(client, seeded, snap_con, monkeypatch,
                                              reports_dir):
    """Выгрузка топ-10: страницы целиком, разложены по движку и запросу, LLM не нужна.

    Загрузчик подменён — сеть в тестах не трогаем; проверяем раскладку, индекс и то, что
    операция не-LLM (без воркера доходит до DONE)."""
    monkeypatch.setattr(tasks, "_fetch_page", lambda url: {
        "html": f"<html><body>{'текст ' * 300}{url}</body></html>",
        "status": 200, "text_len": 2000, "method": "http"})

    tid = client.post("/api/needs/dump",
                      json={"tree_id": TREE_ID, "work": WORK}).json()["task_id"]
    row = task_done(snap_con, tid)
    assert row["status"] == "DONE", row["error"]

    res = json.loads(row["result"])
    assert res["pages"] > 0 and res["ok"] == res["pages"]
    root = reports_dir / needs_layer.slug(WORK)
    assert (root / "index.html").is_file() and (root / "index.json").is_file()
    saved = list(root.rglob("*.html"))
    assert any(p.parent.parent.name == "yandex" for p in saved), "папка движка"
    assert any(p.parent.parent.name == "google" for p in saved)
    idx = json.loads((root / "index.json").read_text(encoding="utf-8"))
    assert idx["queries"] and all(q["why"] for q in idx["queries"]), "у каждого угла есть причина"
    assert len({q["query"] for q in idx["queries"]}) == len(idx["queries"]), "углы не дублируются"


def test_analyze_adv_rejects_a_function_without_a_money_model(client, seeded, snap_con):
    """Функция без модели денег и себестоимости — не ответ.

    Именно так разбор скатывается в «раздадим бесплатно то, за что конкурент берёт деньги»:
    отличие названо, а на чём зарабатываем мы и во сколько нам обходится каждый гость — нет."""
    with FakeWorker(client, TOKEN, answer=lambda job: {
            "functions": [{"name": "делает схему", "entry_query": "схема", "score": 74,
                           "edge": "без регистрации"}],
            "recommendation": "BUILD", "verdict_score": 74, "confidence": 0.6,
            "report_html": "<h2>Коротко</h2><p>" + "текст " * 40 + "</p>"}):
        tid = client.post("/api/needs/analyze_adv",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED"
    assert "money" in row["error"] and "cost" in row["error"]


def test_analyze_adv_rejects_an_answer_without_functions(client, seeded, snap_con):
    """Вердикт без функций — не ответ: разбор обязан назвать, что именно строить."""
    with FakeWorker(client, TOKEN, answer=lambda job: {
            "recommendation": "SKIP", "verdict_score": 10, "confidence": 0.5,
            "report_html": "<html><body>" + "нет функций " * 20 + "</body></html>"}):
        tid = client.post("/api/needs/analyze_adv",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED" and "функц" in row["error"]


def test_analyze_without_serp_fails_with_clear_reason(client, seeded, snap_con):
    """У второй работы выдачи в кэше нет: в режиме «только кэш» задача падает внятно,
    ничего не выдумывая и не помечая работу разобранной."""
    with FakeWorker(client, TOKEN):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "group": GAP_GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)
    assert row["status"] == "FAILED" and "только кэш" in row["error"]
    d = client.get(f"/api/needs/tree/{TREE_ID}").json()
    assert next(g for g in d["products"]["groups"]
                if g["id"] == GAP_GROUP)["artifacts"] == []


def test_analyze_unknown_tree_or_group_is_404(client, seeded):
    assert client.post("/api/needs/analyze",
                       json={"tree_id": "нет", "group": GROUP}).status_code == 404
    assert client.post("/api/needs/analyze",
                       json={"tree_id": TREE_ID, "group": "нет такой группы"}).status_code == 404
    assert client.post("/api/needs/analyze", json={
        "tree_id": TREE_ID, "group": GROUP, "model_family": "llama",
    }).status_code == 422


def test_analyze_is_not_started_twice(client, seeded, llm_timeout):
    """Пока разбор идёт, второй запрос по той же работе — 409, а не вторая покупка выдачи."""
    llm_timeout(3.0)
    with FakeWorker(client, TOKEN, mode="silent"):
        assert client.post("/api/needs/analyze",
                           json={"tree_id": TREE_ID, "group": GROUP}).status_code == 200
        r = client.post("/api/needs/analyze", json={"tree_id": TREE_ID, "group": GROUP})
    assert r.status_code == 409 and "уже идёт" in r.json()["detail"]


def test_same_analysis_can_run_for_claude_and_codex_in_parallel(
        client, seeded, snap_con, llm_timeout):
    llm_timeout(0.3)
    body = {"tree_id": TREE_ID, "group": GROUP}
    claude = client.post("/api/needs/analyze",
                         json={**body, "model_family": "claude"})
    codex = client.post("/api/needs/analyze",
                        json={**body, "model_family": "codex"})
    repeated = client.post("/api/needs/analyze",
                           json={**body, "model_family": "claude"})

    assert claude.status_code == codex.status_code == 200
    assert repeated.status_code == 409
    assert task_done(snap_con, claude.json()["task_id"])["model_family"] == "claude"
    assert task_done(snap_con, codex.json()["task_id"])["model_family"] == "codex"


def test_model_test_routes_two_families_in_parallel_and_writes_reports(
        client, seeded, snap_con, reports_dir, monkeypatch):
    """Две семейные петли одновременно получают только свой минутный smoke-test."""
    monkeypatch.setattr(tasks, "MODEL_TEST_SECONDS", 0.2)
    claude_worker = FakeWorker(client, TOKEN, model_family="claude")
    codex_worker = FakeWorker(client, TOKEN, model_family="codex")
    body = {"tree_id": TREE_ID, "work": WORK}      # smoke-test остался операцией по работе
    started = time.monotonic()
    with claude_worker, codex_worker:
        claude = client.post("/api/needs/test",
                             json={**body, "model_family": "claude"}).json()["task_id"]
        codex = client.post("/api/needs/test",
                            json={**body, "model_family": "codex"}).json()["task_id"]
        claude_row = task_done(snap_con, claude)
        codex_row = task_done(snap_con, codex)
    elapsed = time.monotonic() - started

    assert claude_row["status"] == codex_row["status"] == "DONE"
    assert elapsed >= 0.18, "submit не должен приниматься раньше минимального времени"
    assert {s["model_family"] for s in claude_worker.seen} == {"claude"}
    assert {s["model_family"] for s in codex_worker.seen} == {"codex"}
    claude_result, codex_result = json.loads(claude_row["result"]), json.loads(codex_row["result"])
    assert claude_result["requested_model"] == "haiku"
    assert codex_result["requested_model"] == "gpt-5.6-luna"
    assert claude_result["duration_seconds"] >= 0.18
    assert codex_result["duration_seconds"] >= 0.18
    assert (reports_dir / f"{claude}.html").is_file()
    assert (reports_dir / f"{codex}.html").is_file()

    artifacts = needs_layer.work_artifacts(TREE_ID)[needs_layer._norm(WORK)]
    tests = [a for a in artifacts if a["kind"] == "model_test"]
    assert {a["model_family"] for a in tests} == {"claude", "codex"}


def test_waiting_until_the_agent_actually_takes_the_job(client, seeded, snap_con, llm_timeout):
    """`RUNNING` означает «работа реально идёт», а не «сервер взял задачу».

    Пока джоб лежит в очереди LLM и его никто не забрал, задача стоит в `WAITING`. Это ровно
    тот случай, который иначе неотличим от честной работы: петля не запущена, а строка
    показывает `RUNNING` и висит до таймаута."""
    llm_timeout(6.0)
    worker = FakeWorker(client, TOKEN, mode="silent")     # сигнал возьмёт, данные не заберёт
    tid = client.post("/api/needs/analyze",
                      json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
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


def test_cancel_frees_the_work_for_a_new_run(client, seeded, snap_con, llm_timeout):
    """Отмена `WAITING` снимает и джоб, и занятость работы.

    Иначе после отмены работа осталась бы «занятой» навсегда и повторный запуск отвечал 409 —
    а отменяют как раз для того, чтобы запустить заново, обычно другим семейством модели."""
    llm_timeout(30.0)
    with FakeWorker(client, TOKEN, mode="silent"):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        wait_for(lambda: task_row(snap_con, tid)["status"] == "WAITING",
                 what="задача ждёт исполнителя")
        assert client.post(f"/api/needs/analyze",
                           json={"tree_id": TREE_ID, "group": GROUP}).status_code == 409

        assert client.post(f"/api/task/{tid}/cancel").status_code == 200
        row = wait_for(lambda: (lambda r: r if r["status"] == "FAILED" else None)(
            task_row(snap_con, tid)), what="задача закрылась после отмены")
        assert "отменена" in (row["error"] or "")

        again = client.post("/api/needs/analyze", json={"tree_id": TREE_ID, "group": GROUP})
        assert again.status_code == 200, "после отмены работа свободна"


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


def test_niche_without_money_answer_is_rejected(client, seeded, snap_con, reports_dir):
    """«Ниша» без ответа про деньги не принимается.

    Раньше монетизация была строкой в списке «Реализация», и разбор проходил приёмку, ни разу
    не сказав, что продаём, кому и почему купят у нас. На живой ветке так и вышло: отчёт
    порекомендовал контентный актив и не назвал ни модели, ни цены."""
    def answer(job):
        res = fake_worker.canned(job)
        if job["type"] == "analyze_work":
            res.pop("who_pays")          # остальные два поля на месте
        return res

    with FakeWorker(client, TOKEN, answer=answer):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        row = task_done(snap_con, tid)

    assert row["status"] == "FAILED"
    assert "не ответил про деньги" in row["error"] and "who_pays" in row["error"]


def test_niche_keeps_the_money_answer_next_to_the_verdict(client, seeded, snap_con, reports_dir):
    """Ответ про деньги ложится в артефакт: его читают следующие разборы и вкладка «Отчёты»."""
    with FakeWorker(client, TOKEN):
        tid = client.post("/api/needs/analyze",
                          json={"tree_id": TREE_ID, "group": GROUP}).json()["task_id"]
        assert task_done(snap_con, tid)["status"] == "DONE"

    art = next(a for a in needs_layer.group_artifacts(TREE_ID)[GROUP] if a["kind"] == "analyze")
    assert art["money"] and art["who_pays"] and art["why_pay"]
    assert art["summary"] == art["money"]
