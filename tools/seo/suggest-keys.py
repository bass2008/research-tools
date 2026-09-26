#!/usr/bin/env python3
"""Какими словами английский Google спрашивает то, о чём у нас есть страница.

Зачем. Английский корпус получен переводом русского, и ключи в нём — тоже перевод: `seo.queries`
и `primary_query` собраны из русских формулировок, а не из того, что люди набирают. Перевод может
быть верным и при этом мёртвым: `arcanum 7 destiny matrix` не даёт ни одной подсказки, потому что
так не ищут — ищут `destiny matrix 7`.

Что делает. Берёт корни из корпуса, спрашивает подсказки поисковой строки (оплаченный кэш в
`semcore.db`, таблица `suggest`), раскладывает их по страницам и сравнивает с тем, что у страницы
записано сейчас. На выходе — отчёт: какие ключи подтвердились, какие надо заменить, какие корни
оказались пустыми и какие темы есть у поиска, но нет у нас.

Частоты здесь не нужны: объёмы взяты от русского поля (`docs/semcore.md`, «Английские формулировки»), решается только
формулировка. Поэтому источник один — подсказки, и второго замера не требуется.

    python tools/seo/suggest-keys.py --collect          # собрать подсказки (платно, с кэшем)
    python tools/seo/suggest-keys.py                    # отчёт по тому, что уже в базе
    python tools/seo/suggest-keys.py --apply            # записать ключи в корпус
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import wscore  # noqa: E402  — путь к репозиторию добавляется выше

PROJECT = ROOT / "project/destiny-matrix"
SEO_EN = ROOT / "tools/seo/content/en"
CORPUS_EN = PROJECT / "content/data/en"
REGISTRY = PROJECT / "web/content/en/position-arcanum.json"
OUT = ROOT / "tools/seo/audit/suggest-en.json"

SOURCE = "google"
REGION = "2840"          # США: замер показал, что UK отдаёт тот же список
BRAND = "destiny matrix"  # как тему называют в поиске: проверено подсказками

# Сколько форм оставляем странице. Восемь — столько же, сколько у русских статей: список
# нужен разметке и внутренней перелинковке, а не для набивки.
KEEP_QUERIES = 8


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def arcana():
    items = load(CORPUS_EN / "arcana.json")
    items = items["items"] if isinstance(items, dict) else items
    return {int(a["n"]): a["title"] for a in items}


def positions():
    """Ключ позиции → её английское имя из корпуса."""
    items = load(CORPUS_EN / "points.json")
    return {p["key"]: p["title"] for p in items}


def roots():
    """Корни для подсказок: по одному на тип страницы, не по каждой странице.

    Подсказка приходит к корню вместе с хвостом («destiny matrix money line 8» приезжает на
    «destiny matrix money line»), поэтому спрашивать каждую из 200 страниц отдельно не нужно —
    это была бы четырёхкратная переплата за тот же ответ.
    """
    out = {}
    out[BRAND] = {"kind": "brand", "id": "root"}
    out["matrix of destiny"] = {"kind": "brand", "id": "alias"}

    for n, title in arcana().items():
        out[f"{BRAND} {n}"] = {"kind": "arcanum", "id": str(n)}
        out[f"{BRAND} {title.lower()}"] = {"kind": "arcanum", "id": str(n)}

    # Корень позиции — короткая форма, а не заголовок статьи: подсказка ловится по началу
    # фразы, и «destiny matrix profession and work you love» не даёт ничего, а «destiny matrix
    # profession» даёт. Формы взяты из ключа позиции; где ключ технический — назван предмет.
    POSITION_ROOTS = {
        "ancestry": "family line", "body_resource": "health", "center": "center",
        "chakras": "chakras", "comfort": "comfort zone", "comfort_south": "relationship line",
        "descendants": "male line", "family_gifts": "family gifts", "father_line": "father line",
        "karma40": "karma", "loops": "programs", "love_middle": "love line", "money": "money",
        "money40": "money after 40", "mother_line": "mother line",
        "parents_children": "parents and children", "past_lives": "past lives",
        "profession": "profession", "purpose": "purpose", "purpose_personal": "personal purpose",
        "purpose_social": "social purpose", "realisation": "self realisation",
        "relations": "relationships", "resources": "resources", "rest": "rest",
        "soul_tasks": "soul tasks", "years": "years",
    }
    for f in sorted((SEO_EN / "positions").glob("*.json")):
        key = f.stem
        short = POSITION_ROOTS.get(key)
        if short:
            out[f"{BRAND} {short}"] = {"kind": "position", "id": key}

    for f in sorted((SEO_EN / "year-arcana").glob("*.json")):
        out[f"{BRAND} year {f.stem}"] = {"kind": "year", "id": f.stem}
    out[f"{BRAND} year forecast"] = {"kind": "year", "id": "hub"}

    # Хабы и категорийные хабы: корень — предмет хаба короткой формой, а не его заголовок.
    # Заголовок хаба — предложение («Decoding a destiny matrix: what you read…»), подсказка
    # по нему не ловится никогда.
    HUB_ROOTS = {
        "author": None,                       # страница об авторе спроса не имеет по смыслу
        "by-birth-date": "by date of birth", "decoding": "decoding",
        "energies": "energies", "full-reading": "full reading", "how-to-read": "how to read",
        "karmic-matrix": "karmic matrix", "meaning": "meaning", "method": "method",
        "programs": "programs",
    }
    for key, short in HUB_ROOTS.items():
        if short:
            out[f"{BRAND} {short}"] = {"kind": "hub", "id": key}

    CATEGORY_ROOTS = {
        "arcanum": "arcana", "chakra": "chakras", "karmic-tail": "karmic tail",
        "position": "positions", "year": "year",
        # совместимость — чужой продукт; корень категории всё равно спрашиваем, чтобы видеть поле
        "combination": "combinations",
    }
    for key, short in CATEGORY_ROOTS.items():
        out[f"{BRAND} {short}"] = {"kind": "category", "id": key}

    out[f"{BRAND} karmic tail"] = {"kind": "tail", "id": "hub"}
    out[f"{BRAND} chakras"] = {"kind": "chakra", "id": "hub"}
    # Совместимость двух карт — отдельный продукт с собственным калькулятором, которого у нас
    # нет и не планируется. Корень спрашиваем, чтобы видеть, чем занято поле, но пробелом
    # корпуса он не считается: «у нас нет» и «нам не надо» — разные вещи.
    out[f"{BRAND} compatibility"] = {"kind": "foreign", "id": "compatibility"}
    out[f"{BRAND} calculator"] = {"kind": "gap", "id": "calculator"}
    return out


def collect(limit):
    phrases = list(roots())
    got = wscore.fetch_suggests(phrases, SOURCE, REGION, max_phrases=limit)
    return got


def expand(limit, waves=8):
    """Волны по уже полученным формам, пока источник не исчерпан.

    Подсказка отдаёт продолжения корня, но не продолжения продолжений: «destiny matrix 10»
    приводит «destiny matrix 10 center», а хвосты этой формы приходят, только если спросить
    её саму. Поэтому волна берёт формы прошлой волны как корни. Конец — два прохода подряд
    без единой новой формы; лимит на волну держит счёт покупок предсказуемым.
    """
    con = wscore._cache_con()
    try:
        con.execute(wscore._SQL_SUGGEST)
        asked = {r[0] for r in con.execute(
            "SELECT phrase FROM suggest WHERE source=? AND region=?", (SOURCE, REGION))}
        forms = set()
        for (raw,) in con.execute(
                "SELECT items_json FROM suggest WHERE source=? AND region=?", (SOURCE, REGION)):
            forms.update(json.loads(raw))
    finally:
        con.close()

    dry = 0
    for wave in range(1, waves + 1):
        fresh = sorted(f for f in forms - asked if 2 <= len(f.split()) <= 8)
        if not fresh:
            print(f"волна {wave}: спрашивать нечего")
            break
        batch = fresh[:limit]
        before = len(forms)
        got = wscore.fetch_suggests(batch, SOURCE, REGION, max_phrases=limit)
        asked.update(batch)
        for items in got.values():
            forms.update(items)
        gain = len(forms) - before
        print(f"волна {wave}: спрошено {len(batch)}, новых форм {gain}, всего форм {len(forms)}")
        dry = dry + 1 if gain == 0 else 0
        if dry >= 2:
            print("источник исчерпан: два прохода подряд без прироста")
            break
    return stored()


def stored():
    """Все формы из базы, разложенные по корням.

    Волны спрашивают формы как корни, поэтому ответ на «destiny matrix 10» лежит под своим
    корнем, а ответ на «destiny matrix 10 center» — под собственным. Странице нужны обе, и
    принадлежность решает префикс с границей слова, а не то, каким запросом форму купили.
    """
    con = wscore._cache_con()
    try:
        con.execute(wscore._SQL_SUGGEST)
        forms = set()
        for phrase, raw in con.execute(
                "SELECT phrase, items_json FROM suggest WHERE source=? AND region=?",
                (SOURCE, REGION)):
            forms.update(json.loads(raw))
            forms.add(phrase)
    finally:
        con.close()
    out = {}
    for root in roots():
        need = set(root.split())
        # Принадлежность решают слова корня, а не их порядок: «destiny matrix 10 center» и
        # «destiny matrix center 10» — одна и та же тема, но приходят они от разных корней, и
        # при сверке по префиксу вторая форма оставалась ничьей. Чужие числа отсекает `belongs`.
        out[root] = sorted(f for f in forms if need <= set(f.split()))
    return out


def page_files():
    """Все страницы с ключами: статьи и реестр пересечений."""
    for f in sorted(SEO_EN.rglob("*.json")):
        yield f.parent.name, f.stem, load(f)


def current_keys(page):
    seo = page.get("seo") or {}
    pub = page.get("publication") or {}
    return {"primary": pub.get("primary_query") or "", "queries": list(seo.get("queries") or [])}


# Запрос из трёх чисел — это кармический хвост, у него своя страница. На странице аркана он
# означал бы, что две наши страницы заявляют один запрос и конкурируют между собой.
TRIPLE = re.compile(r"\b\d{1,2}\s+\d{1,2}\s+\d{1,2}\b")


NUMBER = re.compile(r"\b\d+\b")


def belongs(kind, query, page_id=None, root=None):
    """Запрос действительно про эту страницу, а не про соседнюю.

    Три правила, и каждое закрывает найденную каннибализацию: тройка чисел — это кармический
    хвост, а не аркан; конкретное число на хабе категории — это страница внутри категории,
    а не сам хаб; чужое число на странице аркана — чужая страница («destiny matrix 2026»
    приезжало двадцатому аркану, потому что 20 — префикс 2026)."""
    if kind == "arcanum" and TRIPLE.search(query):
        return False
    if kind == "category" and NUMBER.search(query):
        return False
    if kind in ("arcanum", "year") and page_id and page_id.isdigit():
        nums = NUMBER.findall(query)
        if nums and nums[0] != page_id:
            return False
    if kind == "arcanum" and any(w in query.lower() for w in FOREIGN_FOR_ARCANUM):
        return False
    if kind == "year" and any(w in query.lower() for w in POSITION_WORDS):
        return False
    # Число, которого нет в самом корне, — это номер аркана: «destiny matrix money line 8»
    # принадлежит пересечению money/8, а не странице денег. А «money after 40» число несёт
    # в корне, и оно законное.
    if kind in ("position", "hub", "tail", "chakra", "brand") and root:
        # Номером аркана может быть только 1..22: «karmic task before 40» и «money after 40»
        # несут число темы, а не чужой страницы, и отбрасывать их нельзя.
        extra = {n for n in set(NUMBER.findall(query)) - set(NUMBER.findall(root))
                 if n.isdigit() and 1 <= int(n) <= 22}
        if extra:
            return False
    return True


def recommend(suggests):
    """Готовые ключи для страниц: главный запрос и список форм — из подсказок, не из перевода.

    Правило простое и одно на все типы: главный запрос — самая короткая живая форма корня,
    остальные формы идут списком в порядке подсказок. Если подсказок нет, страница получает
    пометку `dead`: по такому корню не ищут, и ключ ей заменять не на что.
    """
    by_root = {r: items for r, items in suggests.items() if items}
    out = {}
    for root, meta in roots().items():
        items = by_root.get(root) or []
        uniq = [q for q in dict.fromkeys(items)
                if belongs(meta["kind"], q, meta["id"], root)]
        key = f"{meta['kind']}:{meta['id']}"
        row = out.setdefault(key, {"kind": meta["kind"], "id": meta["id"],
                                   "primary": "", "queries": [], "roots": []})
        row["roots"].append(root)
        row["queries"].extend(q for q in uniq if q not in row["queries"])
    for row in out.values():
        row["queries"] = row["queries"][:KEEP_QUERIES]
        row["primary"] = min(row["queries"], key=len) if row["queries"] else ""
        row["dead"] = not row["queries"]
    return out


def crossing_keys(suggests):
    """Ключи для реестра «аркан × позиция»: там сейчас русский `primary_query`.

    Форма подтверждена подсказками: спрашивают «destiny matrix money line 18», «center
    number 8», «comfort zone 5» — то есть позиция плюс число, а не «arcanum N in position X».
    """
    alive = {s.lower() for items in suggests.values() for s in items}
    # Та же форма может прийти с другим порядком слов — сравниваем по составу.
    alive_words = {frozenset(s.lower().split()) for items in suggests.values() for s in items}
    if not REGISTRY.exists():
        return {}
    data = load(REGISTRY)
    items = data["items"] if isinstance(data, dict) else data
    forms = {"money": "money line", "love_middle": "love line", "center": "center",
             "comfort": "comfort zone", "purpose_personal": "personal purpose",
             "purpose_social": "social purpose", "purpose": "purpose", "loops": "programs",
             "past_lives": "karmic tail", "years": "years", "chakras": "chakras",
             "body_resource": "health", "profession": "profession", "relations": "relationships"}
    out = {}
    for item in items:
        pos, n = item["position"], item["arcanum"]
        form = forms.get(pos, pos.replace("_", " "))
        query = f"{BRAND} {form} {n}"
        out[f"{pos}/{n}"] = {"primary_query": query,
                             "confirmed": (query.lower() in alive
                                           or frozenset(query.lower().split()) in alive_words),
                             "was": item.get("primary_query") or ""}
    return out


def conflicts():
    """Запросы, которые заявляет больше одной страницы.

    Две свои страницы по одному запросу — это не удвоенный шанс, а размен: поиск выбирает
    одну, вторая остаётся без трафика, и обе теряют вес. Считаем и главный запрос, и первую
    форму списка: именно они уходят в заголовок и разметку.
    """
    claim = collections.defaultdict(list)
    for kind, name, page in page_files():
        if not ((page.get("publication") or {}).get("index", True)):
            continue
        keys = current_keys(page)
        for q in filter(None, [keys["primary"], *keys["queries"]]):
            claim[q.lower()].append(f"{kind}/{name}")
    if REGISTRY.exists():
        data = load(REGISTRY)
        for item in (data["items"] if isinstance(data, dict) else data):
            q = item.get("primary_query") or ""
            if q:
                claim[q.lower()].append(f"crossing/{item['position']}/{item['arcanum']}")
    return {q: sorted(set(pages)) for q, pages in claim.items() if len(set(pages)) > 1}


def report(suggests):
    """Свести подсказки с тем, что записано у страниц."""
    alive = {s.lower() for items in suggests.values() for s in items}
    alive_words = {frozenset(s.lower().split()) for items in suggests.values() for s in items}
    empty_roots = sorted(r for r, items in suggests.items() if not items)

    pages, dead, cyrillic = [], [], []
    for kind, name, page in page_files():
        keys = current_keys(page)
        def lives(q: str) -> bool:
            return q.lower() in alive or frozenset(q.lower().split()) in alive_words

        have = [q for q in keys["queries"] if lives(q)]
        miss = [q for q in keys["queries"] if not lives(q)]
        row = {"kind": kind, "page": name, "primary": keys["primary"],
               "confirmed": have, "unconfirmed": miss}
        pages.append(row)
        if keys["primary"] and re.search(r"[а-яё]", keys["primary"], re.I):
            cyrillic.append(f"{kind}/{name}: {keys['primary']}")
        if not have:
            dead.append(f"{kind}/{name}")

    registry_cyr = []
    if REGISTRY.exists():
        data = load(REGISTRY)
        items = data["items"] if isinstance(data, dict) else data
        for item in items:
            q = item.get("primary_query") or ""
            if re.search(r"[а-яё]", q, re.I):
                registry_cyr.append(f"{item['position']}/{item['arcanum']}: {q}")

    known = {q.lower() for _, _, page in page_files()
             for q in (page.get("seo") or {}).get("queries") or []}
    # Чужие продукты из списка «ищут, а у нас нет» вычитаем: совместимость двух карт считается
    # другим калькулятором, и её формы к нашему корпусу отношения не имеют.
    foreign = {root for root, meta in roots().items() if meta["kind"] == "foreign"}
    foreign_forms = {s.lower() for root in foreign for s in suggests.get(root, [])}
    known_words = {frozenset(q.split()) for q in known}
    fresh = sorted(s for s in alive
                   if s not in known and s not in foreign_forms
                   and frozenset(s.split()) not in known_words)

    return {
        "source": SOURCE, "region": REGION,
        "roots": len(suggests),
        "suggests_total": sum(len(v) for v in suggests.values()),
        "empty_roots": empty_roots,
        "pages_without_a_single_confirmed_key": dead,
        "russian_primary_query_in_articles": cyrillic,
        "russian_primary_query_in_registry": registry_cyr[:20],
        "russian_primary_query_in_registry_count": len(registry_cyr),
        "suggested_but_not_ours": fresh[:120],
        "suggested_but_not_ours_count": len(fresh),
        "query_conflicts": conflicts(),
        "recommended": recommend(suggests),
        "crossings": crossing_keys(suggests),
        "pages": pages,
    }


# Соответствие «файл корпуса → ключ рекомендации». Категория каталога совпадает с типом
# корня, кроме хвостов: у них один корень на все 26 троек, и форма страницы выбирается по
# числам самой тройки.
FOLDER_KIND = {"arcana": "arcanum", "positions": "position", "hubs": "hub",
               "category-hubs": "category", "year-arcana": "year"}


# Названия позиций: форма с любым из них принадлежит странице позиции или пересечения, а не
# странице хвоста. «Karmic tail» — исключение: так называется сам хвост.
POSITION_WORDS = ("love line", "money line", "comfort zone", "personal purpose",
                  "social purpose", "relationship line", "family line", "father line",
                  "mother line", "male line", "self realisation", "soul tasks",
                  "family gifts", "past lives", "money after 40", "health", "profession",
                  "relationships", "chakras", "programs", "center", "centre",
                  "under heart", "under the heart")

# Чужой предмет у страницы аркана: позиция — это пересечение, год — страница года,
# совместимость — продукт, которого у нас нет.
FOREIGN_FOR_ARCANUM = POSITION_WORDS + ("compatibility", "year")


def tail_queries(suggests, triple):
    """Формы для страницы хвоста: подсказки, где встречается именно эта тройка.

    Тройка попадает и в чужие формы — «destiny matrix love line 9 15 6» спрашивают про линию
    любви, и заявить её страницей хвоста значило бы увести запрос у той страницы, которая по
    нему стоит. Такие формы отбрасываются, а голая тройка с брендом идёт первой: именно она
    отвечает заголовку страницы.
    """
    spaced = " ".join(triple.split("-"))
    own, other = [], []
    for items in suggests.values():
        for s in items:
            if spaced not in s or s in own or s in other:
                continue
            (other if any(w in s.lower() for w in POSITION_WORDS) else own).append(s)
    # Вперёд — формы со словом «tail» и короткие: заголовок страницы про хвост. Формы с чужой
    # позицией в списке остаются (тройку и правда называют линией отношений), но главным
    # запросом не становятся: заголовок страницы отвечает не им.
    own.sort(key=lambda q: (0 if "tail" in q.lower() else 1, len(q)))
    return own, other


def split_shared_queries():
    """Одну форму оставить одной странице.

    Прежние переводные списки пересекались между собой: «destiny matrix karma» стояла и у хаба
    кармической матрицы, и у позиции задачи до сорока. Форма остаётся той странице, у которой
    она главная, а если главной ни у кого — первой по алфавиту адреса; у остальных убирается.
    Сторож `web/lib/primaryQuery.test.ts` сверяет ровно это, и по всем формам, а не по первой.
    """
    pages = {}
    claim = collections.defaultdict(list)
    for f in sorted(SEO_EN.rglob("*.json")):
        page = load(f)
        if not ((page.get("publication") or {}).get("index", True)):
            continue
        who = f"{f.parent.name}/{f.stem}"
        pages[who] = (f, page)
        for q in (page.get("seo") or {}).get("queries") or []:
            claim[q.strip().lower()].append(who)

    dropped = 0
    for q, owners in claim.items():
        if len(set(owners)) < 2:
            continue
        primary_of = [w for w in owners
                      if ((pages[w][1].get("publication") or {}).get("primary_query") or "").lower() == q]
        keep = primary_of[0] if primary_of else sorted(owners)[0]
        for who in set(owners) - {keep}:
            f, page = pages[who]
            seo = page.get("seo") or {}
            seo["queries"] = [x for x in seo.get("queries") or [] if x.strip().lower() != q]
            dropped += 1
    for who, (f, page) in pages.items():
        f.write_text(json.dumps(page, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return dropped


def apply_keys(suggests, rec, crossings):
    """Записать ключи в корпус: `seo.queries` всем страницам, `primary_query` — тем, кто
    индексируется, и всему реестру пересечений.

    Страницы без спроса не трогаем: заменять живой перевод на пустоту незачем — пусть остаётся
    то, что есть, пока не появятся данные GSC."""
    changed = collections.Counter()
    for f in sorted(SEO_EN.rglob("*.json")):
        folder, name = f.parent.name, f.stem
        kind = FOLDER_KIND.get(folder)
        page = load(f)
        tail_other = []
        if folder == "karmic-tails":
            own, tail_other = tail_queries(suggests, name)
            queries = own
            primary = own[0] if own else ""
        else:
            row = rec.get(f"{kind}:{name}") if kind else None
            if not row or row["dead"]:
                continue
            queries, primary = row["queries"], row["primary"]
        if not queries and not tail_other:
            continue
        # Живые формы идут в голову, прежние остаются хвостом: список запросов — это ещё и
        # контракт корпуса (минимум четыре на позицию), и обрезать его до одной подтверждённой
        # формы значит поменять дефект «ключ мимо спроса» на дефект «страница без ключей».
        # Прежние формы тоже фильтруем: переводные ключи содержали те же чужие запросы,
        # и без фильтра «destiny matrix 2026» оставалось на странице двадцатого аркана.
        page_kind = kind or ("tail" if folder == "karmic-tails" else None)
        # Корень страницы нужен и прежним формам: без него правило «число, которого нет в
        # корне» не срабатывает, и «destiny matrix center 5» оставалась на странице центра,
        # хотя по ней стоит страница пересечения center/5.
        page_root = None
        if folder != "karmic-tails":
            row_for_root = rec.get(f"{kind}:{name}") if kind else None
            roots_of = (row_for_root or {}).get("roots") or []
            page_root = min(roots_of, key=len) if roots_of else None
        was = [q for q in ((page.get("seo") or {}).get("queries") or [])
               if belongs(page_kind, q, name, page_root)]
        if folder == "karmic-tails":
            # Чужая форма могла осесть в списке прошлым прогоном — она тоже уходит в хвост.
            moved = [q for q in was if any(w in q.lower() for w in POSITION_WORDS)]
            was = [q for q in was if q not in moved]
            tail_other = list(dict.fromkeys([*tail_other, *moved]))
        # Чужие формы хвоста идут последними: они про ту же тройку, но заголовок страницы
        # отвечает не им, и первой строкой такая форма увела бы страницу в чужую выдачу.
        merged = list(dict.fromkeys([*queries, *was, *tail_other]))
        page.setdefault("seo", {})["queries"] = merged[:max(KEEP_QUERIES, len(was))]
        if folder == "karmic-tails" and not primary:
            primary = merged[0] if merged else ""
        # Список форм у хвоста пересобирается всегда: чужая форма могла осесть главной в
        # прошлом прогоне, и порядок надо восстановить, даже когда своих форм нет.
        pub = page.get("publication")
        if isinstance(pub, dict) and pub.get("index") and primary:
            pub["primary_query"] = primary
        if folder == "arcana":
            # Ищут число, а не имя: заголовок начинается с формы запроса, имя аркана остаётся
            # пояснением. Длина держится в пределах 70 знаков (`article-requirements.md`).
            title = page.get("title") or ""
            page["seo"]["title"] = f"Destiny matrix {name} — {title}: meaning of the arcanum"[:70]
        f.write_text(json.dumps(page, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        changed[folder] += 1

    changed["разведено форм"] = split_shared_queries()

    if REGISTRY.exists() and crossings:
        data = load(REGISTRY)
        items = data["items"] if isinstance(data, dict) else data
        for item in items:
            key = f"{item['position']}/{item['arcanum']}"
            row = crossings.get(key)
            if not row:
                continue
            # Ключ лежит в двух местах: читается верхний, `publication` ведёт генератор ru.
            item["primary_query"] = row["primary_query"]
            item.setdefault("publication", {})["primary_query"] = row["primary_query"]
            changed["position-arcanum"] += 1
        REGISTRY.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n",
                            encoding="utf-8")
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--collect", action="store_true", help="докупить недостающие подсказки")
    ap.add_argument("--limit", type=int, default=400, help="потолок платных фраз за прогон")
    ap.add_argument("--expand", action="store_true",
                    help="волны по полученным формам до исчерпания источника")
    ap.add_argument("--apply", action="store_true", help="записать найденные ключи в корпус")
    args = ap.parse_args()

    if args.expand:
        suggests = expand(args.limit)
    elif args.collect:
        suggests = collect(args.limit)
    else:
        suggests = stored()
    if not suggests:
        raise SystemExit("подсказок в базе нет — запустите с --collect")

    data = report(suggests)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"корней: {data['roots']}, подсказок: {data['suggests_total']}")
    print(f"корней без единой подсказки: {len(data['empty_roots'])}")
    print(f"страниц без единого подтверждённого ключа: "
          f"{len(data['pages_without_a_single_confirmed_key'])}")
    print(f"русский primary_query: статьи {len(data['russian_primary_query_in_articles'])}, "
          f"реестр пересечений {data['russian_primary_query_in_registry_count']}")
    print(f"ищут, а у нас нет: {data['suggested_but_not_ours_count']}")
    rec = data["recommended"]
    dead = [k for k, v in rec.items() if v["dead"]]
    print(f"страниц с готовым ключом: {len(rec) - len(dead)} из {len(rec)}; без спроса: {len(dead)}")
    cross = data["crossings"]
    print(f"конфликтов «один запрос — две страницы»: {len(data['query_conflicts'])}")
    print(f"пересечений: {len(cross)}, форма подтверждена подсказками у "
          f"{sum(1 for v in cross.values() if v['confirmed'])}")
    if args.apply:
        changed = apply_keys(suggests, data["recommended"], data["crossings"])
        print("записано: " + ", ".join(f"{k} {v}" for k, v in sorted(changed.items())))
    print(f"отчёт: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
