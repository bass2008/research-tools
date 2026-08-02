"""Бесплатный прогон краула на реальных данных (testing-plan §3.1).

Приём: сырые ответы Wordstat лежат в `cache`, а `node`/`edge` — производная от них. Значит
модель можно снести, кэш оставить — и краул пойдёт НАСТОЯЩИМ кодом, но каждый фетч попадёт в
кэш: ноль запросов в сеть, ноль денег. Корни берём не хардкодом, а запросом «поддерево, где
все нужные краулу узлы есть в `cache`» — список зависит от текущего кэша.

Ловушка, которую здесь обходим: `wscore.connect()` на пустом `node` и непустом `cache` сам
пересобирает модель. Поэтому после сноса работаем ТЕМ ЖЕ соединением.
"""
import pytest

import wscore
from conftest import counts, covered_roots, wipe_model


@pytest.fixture
def cleaned(real_db):
    """Копия боевой БД: cache на месте, дерево снесено. Плюс список покрытых поддеревьев."""
    con = wscore.connect(real_db)
    cands = covered_roots(con, min_nodes=5)
    assert len(cands) >= 3, ("нужно хотя бы 3 полностью покрытых поддерева; на момент "
                             "написания тестов их было 45 (testing-plan §3.1)")
    picked = cands[:3]
    wipe_model(con)
    assert counts(con)["node"] == 0
    yield {"con": con, "picked": picked,
           "expected": {root: set(phrases) for root, phrases, _, _ in picked},
           "fetches": {root: need for root, _, need, _ in picked}}
    con.close()


def test_covered_subtrees_are_found_by_query(cleaned):
    """Кандидаты выбираются запросом; самый глубокий должен быть глубже одного уровня —
    иначе тест проверял бы не рекурсию, а один уровень пула."""
    roots, _, _, depth = zip(*cleaned["picked"])
    assert len(set(roots)) == 3
    assert max(depth) >= 2, "нужен корень с глубиной >= 2"


async def test_crawl_from_cache_rebuilds_subtree_without_network(cleaned, fetch_spy):
    """2-3 узла на всю глубину: краул до опустевшего фронтира, сетевых обращений НОЛЬ."""
    con = cleaned["con"]
    for root, phrases, need, _ in cleaned["picked"]:
        fetch_spy.clear()
        already = {p for p in phrases
                   if (con.execute("SELECT queried FROM node WHERE phrase = ?", (p,)).fetchone()
                       or (0,))[0]}
        res = await wscore.crawl_subtree(con, root)

        assert res["errors"] == [], f"{root}: фетч не должен падать на покрытом поддереве"
        assert wscore.net_calls() == 0, f"{root}: краул ушёл в сеть — это деньги"
        assert len(fetch_spy) == len(set(fetch_spy)), f"{root}: фраза фетчилась дважды"
        assert set(fetch_spy) <= set(phrases), f"{root}: фетчили что-то вне поддерева"
        # Со стартовой оценкой не сверяем: частоты в кэше разного возраста, дерево строится по
        # самым свежим — узел мог уйти ниже FLOOR и законно остаться незапрошенным.
        assert res["fetched"] > 0 or not need
        assert wscore.unqueried_frontier(con, root) == [], \
            f"{root}: поддерево осталось недогруженным"
        # поддерево может ВЫРАСТИ: догруженные перепроверкой узлы приносят своих детей.
        # Требуем, чтобы ничего не потерялось, а не точного совпадения со снимком до краула.
        assert set(phrases) <= set(wscore.subtree_phrases(con, root)), \
            f"{root}: краул из кэша потерял часть поддерева"
        statuses = {p: wscore.get_node(con, p)["status"] for p in phrases}
        assert set(statuses.values()) == {"FULLY_LOADED"}, f"{root}: {statuses}"
        # фронтир опустел: фетчить в поддереве больше нечего
        assert wscore.estimate_subtree(con, root)["requests"] == 0


async def test_second_crawl_is_idempotent(cleaned, fetch_spy):
    """Повторный прогон не добавил ни узлов, ни обращений к фетчу (инвариант §10.4)."""
    con = cleaned["con"]
    root = cleaned["picked"][0][0]
    await wscore.crawl_subtree(con, root)
    before = counts(con)
    fetch_spy.clear()

    res = await wscore.crawl_subtree(con, root)

    assert fetch_spy == []
    assert res["fetched"] == 0
    assert counts(con) == before
    assert wscore.net_calls() == 0


async def test_overlapping_roots_take_shared_phrase_once(cleaned, fetch_spy):
    """Пересекающиеся поддеревья: общая фраза берётся один раз (дедуп по DAG, §10.5)."""
    con = cleaned["con"]
    pair = None
    for i, (root_a, phrases_a, _, _) in enumerate(cleaned["picked"]):
        for root_b, phrases_b, _, _ in cleaned["picked"][i + 1:]:
            shared = set(phrases_a) & set(phrases_b)
            if shared:
                pair = (root_a, root_b, shared)
                break
        if pair:
            break
    if pair is None:
        pytest.skip("в текущем кэше нет двух покрытых поддеревьев с пересечением")
    root_a, root_b, shared = pair

    await wscore.crawl_subtree(con, root_a)
    fetch_spy.clear()
    await wscore.crawl_subtree(con, root_b)

    assert not (set(fetch_spy) & shared), "общие фразы фетчились повторно"
    assert wscore.net_calls() == 0
    for phrase in shared:                       # связи есть от каждого родителя
        parents = {r[0] for r in con.execute("SELECT parent FROM edge WHERE child = ?", (phrase,))}
        assert parents, f"{phrase}: потеряны рёбра"
