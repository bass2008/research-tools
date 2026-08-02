"""Второй слой — дерево потребностей: работы, собранные из фраз первого дерева.

Слой файловый и одноразовый: сборку делает LLM вне конвейера, она лежит каталогом в
`logs/needs-lab/<id>/`, и её можно снести и собрать заново. Первый слой (`node`/`edge`) и
оплаченные данные (`cache`, `serp`) при этом неприкосновенны — сюда мы только ссылаемся.

    <id>/accepted.json      дерево (ответ сборки)
    <id>/params.json        вход сборки: фразы с частотами
    <id>/artifacts/<slug>/<kind>-<task>.json   что сделали по работе: разбор, сезонность,
                                               смежные ключи — каждый прогон отдельным файлом

Выдача при разборе кладётся в общую таблицу `serp` (ключ «фраза+движок»), а не сюда:
за неё заплачено, и переплачивать при пересборке слоя незачем.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import wscore

ROOT = Path(__file__).parent
NEEDS_DIR = ROOT / "logs" / "needs-lab"
FLOOR = wscore.FLOOR        # ниже в сборку не берём: вглубь мы там и не бурим
HEAD_FREQ = 30000           # выше — голова, интент размыт по определению

# `score` ставит САМА сборка (0-100: шанс, что разбор найдёт незакрытую потребность) — это
# суждение, а не формула по признакам: занятость рынка и кустарность обслуживания из четырёх
# флагов не выводятся. Порядок работ на экране — по этому числу.
WORK_KEYS = ("name", "score", "score_why", "top_freq", "phrase_count", "occupied_by",
             "unclear", "gap_candidate", "needs_serp", "serp_question", "why")
SEGMENT_KEYS = ("name", "gap_candidate", "why")


class NeedsError(Exception):
    """Файл слоя не читается или в нём не то, что ожидалось."""


def _norm(s):
    return unicodedata.normalize("NFC", " ".join((s or "").split())).lower()


def slug(name, cap=60):
    """Имя работы -> имя файла. Кириллицу не транслитерируем (пути у нас utf-8),
    только выкидываем то, чем нельзя называть файл."""
    s = re.sub(r"[^\w\s-]", "", _norm(name), flags=re.UNICODE)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return (s or "work")[:cap]


# ---------- поиск файлов ----------

def trees():
    """{id: (файл дерева, файл входа или None)}.

    Две раскладки: каталог сборки (`<id>/accepted.json` рядом с `params.json`) и просто
    json-файл, положенный в папку руками."""
    found = {}
    if not NEEDS_DIR.is_dir():
        return found
    for p in sorted(NEEDS_DIR.iterdir()):
        if p.is_dir() and (p / "accepted.json").is_file():
            params = p / "params.json"
            found[p.name] = (p / "accepted.json", params if params.is_file() else None)
        elif p.is_file() and p.suffix == ".json":
            found[p.stem] = (p, None)
    return found


def _read(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise NeedsError(f"дерево не читается ({path.name}): {e}")
    if not isinstance(data, dict):
        raise NeedsError(f"дерево {path.name}: ожидался объект")
    return data


def load_tree(tree_id):
    files = trees()
    if tree_id not in files:
        raise NeedsError(f"дерева нет: {tree_id}")
    tree_file, params_file = files[tree_id]
    return _read(tree_file), tree_file, params_file


def _input(params_file):
    """({фраза: частота}, сводка входа) — частоты в дереве не хранятся, они во входе."""
    if params_file is None:
        return {}, {}
    try:
        p = json.loads(params_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}, {}
    meta = {"root": p.get("root"), "root_freq": p.get("root_freq"),
            "phrase_count": len(p.get("nodes") or [])}
    return {n["phrase"]: n.get("freq") for n in p.get("nodes") or []}, meta


# ---------- работы ----------

def works(tree):
    return [w for w in (tree.get("works") or []) if isinstance(w, dict)]


def work_phrases(work):
    """Все фразы работы, включая сегменты."""
    out = list(work.get("phrases") or [])
    for s in work.get("segments") or []:
        if isinstance(s, dict):
            out += list(s.get("phrases") or [])
    return out


def find_work(tree, name):
    want = _norm(name)
    for w in works(tree):
        if _norm(w.get("name")) == want:
            return w
    raise NeedsError(f"работы нет в дереве: {name}")


def counts(tree, analyzed=()):
    ws = works(tree)
    done = {_norm(n) for n in analyzed}
    fresh = [w.get("score") or 0 for w in ws if _norm(w.get("name")) not in done]
    return {"works": len(ws),
            "best_score": max(fresh) if fresh else 0,
            "segments": sum(len(w.get("segments") or []) for w in ws),
            "phrases": sum(len(work_phrases(w)) for w in ws),
            "excluded": len(tree.get("excluded") or []),
            "gaps": sum(1 for w in ws if w.get("gap_candidate")),
            "occupied": sum(1 for w in ws if w.get("occupied_by")),
            "needs_serp": sum(1 for w in ws if w.get("needs_serp"))}


# ---------- разборы работ ----------

ARTIFACT_KINDS = ("analyze", "analyze_adv", "season", "adjacent", "dump")


def save_artifact(tree_id, work_name, kind, data):
    """Артефакт работы: разбор, сезонность или смежные ключи.

    Каждый прогон — отдельный файл: старые не перезаписываются. Смысл в том, что повторный
    разбор идёт по данным, которых раньше не было (появилась сезонность, добрали смежные
    ключи), и сравнить прогоны важнее, чем хранить последний."""
    d = NEEDS_DIR / tree_id / "artifacts" / slug(work_name)
    d.mkdir(parents=True, exist_ok=True)
    f = d / f"{kind}-{data.get('task_id', 'x')}.json"
    f.write_text(json.dumps({"work": work_name, "kind": kind, **data}, ensure_ascii=False, indent=1),
                 encoding="utf-8")
    return f


def work_artifacts(tree_id):
    """{работа: [артефакт, ...]} — новые сверху. Читает и старую раскладку `analysis/`."""
    out = {}
    root = NEEDS_DIR / tree_id
    for f in sorted((root / "artifacts").glob("*/*.json")) + sorted((root / "analysis").glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict) or not data.get("work"):
            continue
        data.setdefault("kind", "analyze")
        out.setdefault(_norm(data["work"]), []).append(data)
    for lst in out.values():
        lst.sort(key=lambda a: -(a.get("created_at") or 0))
    return out


ANALYSIS_KINDS = ("analyze", "analyze_adv")


def all_analyses():
    """Разборы работ по всем деревьям, НОВЫЕ СВЕРХУ — вкладка «Отчёты».

    Порядок по дате, а не по оценке: свежий прогон должен быть виден сразу, иначе он тонет
    в хвосте длинной таблицы и выглядит как «отчёт не появился».

    Разборов два вида (`analyze` и `analyze_adv`) — они отвечают на разные вопросы, поэтому
    показываются отдельными строками; от каждого вида берём последний прогон по работе.
    Единица отчёта — работа, поэтому таблица `report` (она про узлы) здесь не участвует."""
    out = []
    for tid, (tree_file, params_file) in trees().items():
        try:
            tree = _read(tree_file)
        except NeedsError:
            continue
        _, meta = _input(params_file)
        by_name = {_norm(w.get("name")): w for w in works(tree)}
        for name, arts in work_artifacts(tid).items():
          for kind in ANALYSIS_KINDS:
            a = next((x for x in arts if x.get("kind") == kind), None)
            if a is None:
                continue
            w = by_name.get(name) or {}
            out.append({"tree_id": tid, "work": a.get("work"), "kind": kind,
                        "root": meta.get("root"), "condition": tree.get("condition"),
                        "top_freq": w.get("top_freq"), "phrases": a.get("phrases"),
                        "gap_candidate": w.get("gap_candidate"),
                        **{k: a.get(k) for k in ("verdict", "verdict_score", "confidence",
                                                 "report_link", "created_at")}})
    out.sort(key=lambda r: (-(r["created_at"] or 0), r["work"] or ""))
    return out


# ---------- проекции для API ----------

def rows():
    """Строки таблицы вкладки: по одной на дерево."""
    out = []
    for tid, (tree_file, params_file) in trees().items():
        try:
            tree = _read(tree_file)
        except NeedsError as e:
            out.append({"id": tid, "error": str(e), "condition": None, "root": None,
                        "root_freq": None, "created_at": None, "analyzed": 0,
                        **{k: 0 for k in ("works", "segments", "phrases", "excluded",
                                          "gaps", "occupied", "needs_serp")}})
            continue
        _, meta = _input(params_file)
        arts = work_artifacts(tid)
        out.append({"id": tid, "error": None, "condition": tree.get("condition"),
                    "root": meta.get("root"), "root_freq": meta.get("root_freq"),
                    "created_at": int(tree_file.stat().st_mtime),
                    "analyzed": sum(1 for v in arts.values()
                                     if any(x.get("kind") == "analyze" for x in v)),
                    **counts(tree, [k for k, v in arts.items()
                                    if any(x.get("kind") == "analyze" for x in v)])})
    out.sort(key=lambda r: (r["created_at"] or 0), reverse=True)
    return out


def detail(tree_id):
    """Одно дерево целиком: работы с частотами фраз и прицепленными разборами."""
    tree, tree_file, params_file = load_tree(tree_id)
    freqs, meta = _input(params_file)
    arts = work_artifacts(tree_id)

    def with_freq(items):
        return sorted(({"phrase": p, "freq": freqs.get(p)} for p in (items or [])),
                      key=lambda x: (-(x["freq"] or 0), x["phrase"]))

    out_works = []
    for w in works(tree):
        mine = arts.get(_norm(w.get("name")), [])
        a = next((x for x in mine if x.get("kind") == "analyze"), None)
        out_works.append({**{k: w.get(k) for k in WORK_KEYS},
                          "phrases": with_freq(w.get("phrases")),
                          "segments": [{**{k: s.get(k) for k in SEGMENT_KEYS},
                                        "phrases": with_freq(s.get("phrases"))}
                                       for s in (w.get("segments") or [])
                                       if isinstance(s, dict)],
                          "artifacts": [{k: x.get(k) for k in
                                         ("kind", "created_at", "report_link", "task_id",
                                          "verdict", "verdict_score", "summary")}
                                        for x in mine],
                          "analysis": {k: a.get(k) for k in
                                       ("verdict", "verdict_score", "report_link",
                                        "created_at", "searched", "confidence")} if a else None})
    # самое потенциально интересное сверху — по оценке сборки
    out_works.sort(key=lambda w: (-(w.get("score") or 0), -(w.get("top_freq") or 0)))
    excluded = [{"phrase": e.get("phrase"), "why": e.get("why"), "note": e.get("note"),
                 "freq": freqs.get(e.get("phrase"))}
                for e in (tree.get("excluded") or []) if isinstance(e, dict)]
    excluded.sort(key=lambda e: (str(e["why"]), -(e["freq"] or 0)))
    return {"id": tree_id, "condition": tree.get("condition"),
            "root": meta.get("root"), "root_freq": meta.get("root_freq"),
            "created_at": int(tree_file.stat().st_mtime),
            "counts": counts(tree, [k for k, v in arts.items()
                                    if any(x.get("kind") == "analyze" for x in v)]), "works": out_works, "excluded": excluded}


def build_payload(con, root, min_freq=FLOOR, max_freq=HEAD_FREQ):
    """Ветка дерева запросов как вход сборки: {root, root_freq, nodes:[{phrase, freq, children}]}.

    `children` — только те дети, что сами попали в payload: иначе сборка увидит ссылки на
    фразы, которых у неё нет. Голову (> `max_freq`) не берём — интент там размыт по
    определению, но сам корень оставляем всегда, иначе непонятно, по чему собирали."""
    root = _norm(root)
    row = con.execute("SELECT phrase, COALESCE(freq, 0) f, status FROM node WHERE phrase = ?",
                      (root,)).fetchone()
    if row is None:
        raise NeedsError(f"узла нет в дереве: {root}")
    subtree = wscore.subtree_phrases(con, root)
    freq = {}
    for chunk in [subtree[i:i + 400] for i in range(0, len(subtree), 400)]:
        qs = ",".join("?" * len(chunk))
        freq.update({r[0]: r[1] for r in con.execute(
            f"SELECT phrase, COALESCE(freq, 0) FROM node WHERE phrase IN ({qs})", chunk)})
    kept = {p for p, f in freq.items()
            if f >= min_freq and (max_freq is None or f <= max_freq)}
    kept.add(root)
    edges = {}
    for chunk in [subtree[i:i + 400] for i in range(0, len(subtree), 400)]:
        qs = ",".join("?" * len(chunk))
        for parent, child in con.execute(
                f"SELECT parent, child FROM edge WHERE parent IN ({qs})", chunk):
            if parent in kept and child in kept:
                edges.setdefault(parent, []).append(child)
    nodes = [{"phrase": p, "freq": freq[p],
              "children": sorted(edges.get(p, []), key=lambda c: (-freq[c], c))}
             for p in sorted(kept, key=lambda p: (-freq[p], p))]
    return {"root": root, "root_freq": freq[root], "status": row[2],
            "min_freq": min_freq, "max_freq": max_freq,
            "subtree_total": len(subtree), "nodes": nodes}


def validate_tree(payload, tree):
    """Что не так со сборкой. Пусто = принимаем.

    Синтаксис JSON проверит транспорт; здесь то, что остаётся валидным JSON и всё равно
    неверно: потерянные и выдуманные фразы, дубли. (Своя копия этой проверки живёт в
    лаборатории `task-worker-mcp` — она работает офлайн и в репозиторий не ходит.)"""
    if not isinstance(tree, dict):
        return [f"ответ должен быть объектом, а не {type(tree).__name__}"]
    out = []
    ws = tree.get("works")
    if not isinstance(ws, list) or not ws:
        out.append("нет непустого списка works")
        ws = ws if isinstance(ws, list) else []
    seen, dup = set(), []
    for i, w in enumerate(ws):
        if not isinstance(w, dict):
            out.append(f"works[{i}] не объект")
            continue
        if not (w.get("name") or "").strip():
            out.append(f"works[{i}]: пустое name")
        sc = w.get("score")
        if not isinstance(sc, (int, float)) or not 0 <= sc <= 100:
            out.append(f"works[{i}] ({w.get('name')}): score должен быть числом 0-100, "
                       f"получено {sc!r}")
        for ph in work_phrases(w):
            n = _norm(ph)
            dup.append(ph) if n in seen else seen.add(n)
    for e in tree.get("excluded") or []:
        ph = e.get("phrase") if isinstance(e, dict) else e
        if not isinstance(e, dict) or not ph or not (e.get("why") or "").strip():
            out.append(f"excluded: нужен объект с phrase и why, получено {e!r}"[:160])
            continue
        n = _norm(ph)
        dup.append(ph) if n in seen else seen.add(n)
    given = {n["phrase"] for n in payload.get("nodes", [])}
    lost, invented = sorted(given - seen), sorted(seen - given)
    if lost:
        out.append(f"потеряно {len(lost)} входных фраз, например: {lost[:5]}")
    if invented:
        out.append(f"{len(invented)} фраз, которых нет во входе: {invented[:5]}")
    if dup:
        out.append(f"{len(dup)} фраз встречаются больше одного раза: {dup[:5]}")
    return out


def save_tree(tree_id, payload, tree):
    """Сборку — каталогом, как её кладёт лаборатория: вход рядом с деревом."""
    d = NEEDS_DIR / tree_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "params.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1),
                                   encoding="utf-8")
    (d / "accepted.json").write_text(json.dumps(tree, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    return d


def work_input(tree_id, work_name, top):
    """Данные для разбора работы: сама работа, её фразы с частотами и какие фразы
    покупать под выдачу (самые частотные — они и представляют работу)."""
    tree, _, params_file = load_tree(tree_id)
    work = find_work(tree, work_name)
    freqs, meta = _input(params_file)
    phrases = sorted(({"phrase": p, "freq": freqs.get(p) or 0} for p in work_phrases(work)),
                     key=lambda x: (-x["freq"], x["phrase"]))
    return {"tree_id": tree_id, "condition": tree.get("condition"),
            "root": meta.get("root"),
            "work": {k: work.get(k) for k in WORK_KEYS},
            "segments": [{**{k: s.get(k) for k in SEGMENT_KEYS},
                          "phrases": sorted(s.get("phrases") or [],
                                            key=lambda p: -(freqs.get(p) or 0))}
                         for s in (work.get("segments") or []) if isinstance(s, dict)],
            "phrases": phrases,
            "search": [p["phrase"] for p in phrases[:max(1, top)]]}
