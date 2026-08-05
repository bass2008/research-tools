"""Второй слой — дерево потребностей: работы, собранные из фраз первого дерева.

Слой файловый и одноразовый: сборку делает LLM вне конвейера, она лежит каталогом в
`logs/needs-lab/<id>/`, и её можно снести и собрать заново. Первый слой (`node`/`edge`) и
оплаченные данные (`cache`, `serp`) при этом неприкосновенны — сюда мы только ссылаемся.

    <id>/accepted.json      дерево (ответ сборки)
    <id>/params.json        вход сборки: фразы с частотами
    <id>/revisions/         прежние классификации и журнал вторых проходов
    <id>/artifacts/<slug>/<kind>-<task>.json   что сделали по работе: разбор, сезонность,
                                               смежные ключи — каждый прогон отдельным файлом

Выдача при разборе кладётся в общую таблицу `serp` (ключ «фраза+движок»), а не сюда:
за неё заплачено, и переплачивать при пересборке слоя незачем.
"""
from __future__ import annotations

import json
import hashlib
import os
import re
import time
import unicodedata
from pathlib import Path

import wscore

ROOT = Path(__file__).parent
NEEDS_DIR = ROOT / "logs" / "needs-lab"
FLOOR = wscore.FLOOR        # ниже в сборку не берём: вглубь мы там и не бурим
HEAD_FREQ = 30000           # выше — голова, интент размыт по определению

# Классификация отвечает только за структуру: работа, сегменты и назначенные им фразы.
# Продуктовый рейтинг строится отдельной дорогой командой и хранится отдельным артефактом,
# чтобы пересборка классов не притворялась анализом рынка или возможности продукта.
CLASS_WORK_KEYS = ("name", "top_freq", "phrase_count", "unclear", "why")
SEGMENT_KEYS = ("name", "why")
RANK_KEYS = ("score", "score_why", "intent", "product", "blocker", "evidence", "factors")
RANK_RESULT_KEYS = ("name", "intent", "factors", "score", "score_why", "product",
                    "blocker", "evidence")
CLASS_FORBIDDEN_KEYS = (*RANK_KEYS, "occupied_by", "gap_candidate", "needs_serp",
                        "serp_question")
WORK_KEYS = (*CLASS_WORK_KEYS, *RANK_KEYS)
RANK_INTENTS = ("product", "mixed", "information", "platform_action", "support",
                "navigation", "unclear")
RANK_FACTORS = {
    "external_control": 25,
    "tool_intent": 20,
    "outcome_clarity": 15,
    "product_shape": 15,
    "repeatability": 10,
    "user_value": 15,
}
RANK_CAPS = {"product": 100, "mixed": 60, "information": 30,
             "platform_action": 15, "support": 20, "navigation": 5, "unclear": 10}


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


def _write_json_atomic(path, data):
    """Записать JSON через replace: читатель не увидит половину нового дерева."""
    tmp = path.with_name(f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def tree_revision(tree):
    """Ревизия классификации. У старых деревьев и артефактов она равна нулю."""
    value = tree.get("_revision", 0) if isinstance(tree, dict) else 0
    return value if isinstance(value, int) and value >= 0 else 0


def load_tree(tree_id):
    files = trees()
    if tree_id not in files:
        raise NeedsError(f"дерева нет: {tree_id}")
    tree_file, params_file = files[tree_id]
    return _read(tree_file), tree_file, params_file


def load_source(tree_id):
    """Исходные фразы дерева; нужны повторной классификации как источник истины."""
    _, _, params_file = load_tree(tree_id)
    if params_file is None:
        raise NeedsError(f"у дерева {tree_id} нет params.json с исходными фразами")
    return _read(params_file)


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


def classification_only(tree):
    """Каноническая классификация без старых гипотез `score/occupied/gap/needs_serp`."""
    return {
        "condition": tree.get("condition"),
        "works": [
            {**{k: w.get(k) for k in CLASS_WORK_KEYS},
             "phrases": list(w.get("phrases") or []),
             "segments": [
                 {**{k: s.get(k) for k in SEGMENT_KEYS},
                  "phrases": list(s.get("phrases") or [])}
                 for s in (w.get("segments") or []) if isinstance(s, dict)
             ]}
            for w in works(tree)
        ],
        "excluded": [dict(e) for e in (tree.get("excluded") or []) if isinstance(e, dict)],
    }


def work_phrases(work):
    """Все фразы работы, включая сегменты."""
    direct = work.get("phrases")
    out = list(direct) if isinstance(direct, list) else []
    segments = work.get("segments")
    for s in segments if isinstance(segments, list) else []:
        if isinstance(s, dict) and isinstance(s.get("phrases"), list):
            out += list(s["phrases"])
    return out


def find_work(tree, name):
    want = _norm(name)
    for w in works(tree):
        if _norm(w.get("name")) == want:
            return w
    raise NeedsError(f"работы нет в дереве: {name}")


# ---------- ручное избранное ----------

def _favorites_path(tree_id, tree_file=None):
    """Отдельный sidecar: лайки не являются ни классификацией, ни рейтингом модели."""
    if tree_file is None:
        _, tree_file, _ = load_tree(tree_id)
    if tree_file.name == "accepted.json":
        return tree_file.parent / "favorites.json"
    # Для одиночных `<id>.json` нельзя класть sidecar рядом: он сам стал бы ещё одним
    # деревом. Хеш одновременно не даёт превратить tree_id в произвольный путь.
    digest = hashlib.sha256(tree_id.encode("utf-8")).hexdigest()
    return NEEDS_DIR / ".favorites" / f"{digest}.json"


def favorite_names(tree_id):
    """Избранные работы текущей классификации, в её каноническом порядке."""
    tree, tree_file, _ = load_tree(tree_id)
    path = _favorites_path(tree_id, tree_file)
    if not path.is_file():
        return []
    data = _read(path)
    raw = data.get("works")
    if not isinstance(raw, list) or any(not isinstance(name, str) for name in raw):
        raise NeedsError(f"избранное {path.name}: works должен быть массивом строк")
    selected = {_norm(name) for name in raw}
    return [w.get("name") for w in works(tree)
            if isinstance(w.get("name"), str) and _norm(w.get("name")) in selected]


def set_favorite(tree_id, work_name, favorite):
    """Поставить или снять ручной лайк, не меняя accepted.json и ranking-артефакты."""
    tree, tree_file, _ = load_tree(tree_id)
    work = find_work(tree, work_name)
    canonical = work.get("name")
    selected = {_norm(name) for name in favorite_names(tree_id)}
    if favorite:
        selected.add(_norm(canonical))
    else:
        selected.discard(_norm(canonical))
    ordered = [w.get("name") for w in works(tree)
               if isinstance(w.get("name"), str) and _norm(w.get("name")) in selected]
    path = _favorites_path(tree_id, tree_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    _write_json_atomic(path, {"works": ordered, "updated_at": int(time.time())})
    return canonical, ordered


def counts(tree, analyzed=(), ranking=None):
    ws = works(tree)
    done = {_norm(n) for n in analyzed}
    ranked = {_norm(w.get("name")): w for w in (ranking or {}).get("works") or []
              if isinstance(w, dict)}
    fresh = [ranked[_norm(w.get("name"))]["score"] for w in ws
             if _norm(w.get("name")) not in done and _norm(w.get("name")) in ranked]
    return {"works": len(ws),
            "best_score": max(fresh) if fresh else None,
            "ranked": len(ranked),
            "segments": sum(len(w.get("segments") or []) for w in ws),
            "phrases": sum(len(work_phrases(w)) for w in ws),
            "excluded": len(tree.get("excluded") or [])}


# ---------- разборы работ ----------

ARTIFACT_KINDS = ("analyze", "analyze_adv", "analyze_product", "model_test",
                  "season", "adjacent", "dump")
ANALYSIS_KINDS = ("analyze", "analyze_adv", "analyze_product")
MODEL_ARTIFACT_KINDS = (*ANALYSIS_KINDS, "model_test")
MODEL_FAMILIES = ("claude", "codex")


def model_family(value, default=None):
    """Нормализованное семейство модели или ошибка на неизвестном значении."""
    family = str(value or default or "").strip().lower()
    if family not in MODEL_FAMILIES:
        raise NeedsError(f"неизвестное семейство модели: {value!r}")
    return family


def rank_score(item):
    """Детерминированный итог из оценённых моделью факторов и жёсткого cap по интенту."""
    factors = item.get("factors") or {}
    weighted = sum(factors.get(k, 0) * weight for k, weight in RANK_FACTORS.items())
    score = int(weighted / 100 + 0.5)
    cap = RANK_CAPS.get(item.get("intent"), 0)
    if not str(item.get("product") or "").strip():
        cap = min(cap, 25)
    return min(score, cap)


def validate_ranking(tree, result):
    """Проверить полноту и аудируемость продуктового рейтинга."""
    if not isinstance(result, dict) or not isinstance(result.get("works"), list):
        return ["ответ анализа должен быть объектом с массивом works"]
    if set(result) != {"works"}:
        result_shape_problem = ["ответ анализа должен содержать только поле works"]
    else:
        result_shape_problem = []
    expected = {_norm(w.get("name")): w for w in works(tree)}
    seen = set()
    problems = result_shape_problem
    for i, item in enumerate(result["works"]):
        if not isinstance(item, dict):
            problems.append(f"works[{i}] не объект")
            continue
        raw_name = item.get("name")
        if not isinstance(raw_name, str):
            problems.append(f"works[{i}]: name должен быть строкой")
            continue
        name = _norm(raw_name)
        if name not in expected:
            problems.append(f"works[{i}]: неизвестная работа {item.get('name')!r}")
            continue
        if name in seen:
            problems.append(f"работа {item.get('name')!r} оценена дважды")
        seen.add(name)
        if item.get("name") != expected[name].get("name"):
            problems.append(f"works[{i}]: имя работы должно быть сохранено точно: "
                            f"{expected[name].get('name')!r}")
        if set(item) != set(RANK_RESULT_KEYS):
            problems.append(f"{item.get('name')}: поля оценки должны быть ровно: "
                            + ", ".join(RANK_RESULT_KEYS))
        intent = item.get("intent")
        if intent not in RANK_INTENTS:
            problems.append(f"{item.get('name')}: неизвестный intent {intent!r}")
        factors = item.get("factors")
        if not isinstance(factors, dict) or set(factors) != set(RANK_FACTORS):
            problems.append(f"{item.get('name')}: factors должны содержать "
                            + ", ".join(RANK_FACTORS))
        else:
            for key, value in factors.items():
                if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100:
                    problems.append(f"{item.get('name')}: factors.{key} должен быть целым 0-100")
        score = item.get("score")
        if not isinstance(score, int) or isinstance(score, bool) or not 0 <= score <= 100:
            problems.append(f"{item.get('name')}: score должен быть целым 0-100")
        if not isinstance(item.get("score_why"), str) or not item["score_why"].strip():
            problems.append(f"{item.get('name')}: нужен score_why")
        for key in ("product", "blocker"):
            value = item.get(key)
            if value is not None and (not isinstance(value, str) or not value.strip()):
                problems.append(f"{item.get('name')}: {key} должен быть непустой строкой или null")
        evidence = item.get("evidence")
        allowed = {_norm(p) for p in work_phrases(expected[name])}
        if not isinstance(evidence, list) or not 1 <= len(evidence) <= 5:
            problems.append(f"{item.get('name')}: evidence должен содержать 1-5 фраз")
        elif any(not isinstance(p, str) or _norm(p) not in allowed for p in evidence):
            problems.append(f"{item.get('name')}: evidence содержит нестроку или фразу не из работы")
        factors_valid = isinstance(factors, dict) and set(factors) == set(RANK_FACTORS) \
            and all(isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 100
                    for value in factors.values())
        if factors_valid and intent in RANK_INTENTS:
            expected_score = rank_score(item)
            if score != expected_score:
                problems.append(f"{item.get('name')}: score={score!r}, по факторам и cap "
                                f"должен быть {expected_score}")
        if expected[name].get("unclear") is True and intent != "unclear":
            problems.append(f"{item.get('name')}: unclear-работа должна иметь intent=unclear")
    missing = sorted(set(expected) - seen)
    if missing:
        problems.append(f"не оценено работ: {missing[:5]}")
    return problems


def save_ranking(tree_id, result, task_id, family, expected_revision):
    """Сохранить отдельный рейтинг; каноническую классификацию не менять."""
    tree, tree_file, params_file = load_tree(tree_id)
    if tree_file.name != "accepted.json" or params_file is None:
        raise NeedsError(f"дерево {tree_id} не поддерживает анализ")
    revision = tree_revision(tree)
    if revision != expected_revision:
        raise NeedsError(f"классификация изменилась во время анализа: была {expected_revision}, "
                         f"стала {revision}")
    data = {"task_id": task_id, "model_family": model_family(family),
            "created_at": int(time.time()), "tree_revision": revision,
            "works": result["works"]}
    d = tree_file.parent / "rankings"
    d.mkdir(parents=True, exist_ok=True)
    _write_json_atomic(d / f"ranking-{task_id}.json", data)
    return data


def latest_ranking(tree_id, revision=None):
    """Последний рейтинг текущей ревизии классификации; старые остаются историей."""
    tree, tree_file, _ = load_tree(tree_id)
    want = tree_revision(tree) if revision is None else revision
    found = []
    for f in (tree_file.parent / "rankings").glob("ranking-*.json"):
        try:
            data = _read(f)
        except NeedsError:
            continue
        if data.get("tree_revision") == want and isinstance(data.get("works"), list):
            found.append((data.get("created_at") or 0, f.name, data))
    return max(found, default=(0, "", None))[2]


def artifact_family(artifact):
    """Семейство артефакта. Старые анализы до миграции принадлежат Claude."""
    if (artifact or {}).get("kind") not in MODEL_ARTIFACT_KINDS:
        return None
    family = str((artifact or {}).get("model_family") or "claude").strip().lower()
    return family if family in MODEL_FAMILIES else "claude"


def save_artifact(tree_id, work_name, kind, data):
    """Артефакт работы: разбор, сезонность или смежные ключи.

    Каждый прогон — отдельный файл: старые не перезаписываются. Смысл в том, что повторный
    разбор идёт по данным, которых раньше не было (появилась сезонность, добрали смежные
    ключи), и сравнить прогоны важнее, чем хранить последний."""
    tree, _, _ = load_tree(tree_id)
    data = {**data, "tree_revision": tree_revision(tree)}
    d = NEEDS_DIR / tree_id / "artifacts" / slug(work_name)
    d.mkdir(parents=True, exist_ok=True)
    if kind in MODEL_ARTIFACT_KINDS:
        data = {**data, "model_family": model_family(data.get("model_family"), "claude")}
    f = d / f"{kind}-{data.get('task_id', 'x')}.json"
    f.write_text(json.dumps({"work": work_name, "kind": kind, **data}, ensure_ascii=False, indent=1),
                 encoding="utf-8")
    return f


def migrate_analysis_families():
    """Разовая идемпотентная миграция: все старые анализы считаются запусками Claude."""
    changed = 0
    seen = set()
    for tree_file, _ in trees().values():
        root = tree_file.parent
        files = list((root / "artifacts").glob("*/*.json")) + list((root / "analysis").glob("*.json"))
        for f in files:
            if f in seen:
                continue
            seen.add(f)
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if not isinstance(data, dict):
                continue
            kind = data.get("kind") or "analyze"
            if kind not in ANALYSIS_KINDS or data.get("model_family") in MODEL_FAMILIES:
                continue
            data["model_family"] = "claude"
            tmp = f.with_suffix(f.suffix + ".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
            tmp.replace(f)
            changed += 1
    return changed


def _mrr6(artifact):
    """₽/мес на шестом месяце прогноза — «за что боремся» видно в строке работы, без отчёта."""
    months = ((artifact.get("forecast") or {}).get("months") or [])
    m = next((x for x in months if isinstance(x, dict) and x.get("month") == 6), None)
    return (m or {}).get("mrr")


def work_artifacts(tree_id, include_stale=False):
    """{работа: [артефакт, ...]} текущей классификации — новые сверху.

    После второго прохода старые файлы сохраняются, но не приклеиваются по совпавшему имени
    к уже иначе классифицированной работе. Для диагностики их можно получить с
    ``include_stale=True``.
    """
    out = {}
    root = NEEDS_DIR / tree_id
    tree, _, _ = load_tree(tree_id)
    current_revision = tree_revision(tree)
    for f in sorted((root / "artifacts").glob("*/*.json")) + sorted((root / "analysis").glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict) or not data.get("work"):
            continue
        data.setdefault("kind", "analyze")
        data.setdefault("tree_revision", 0)
        if not include_stale and data["tree_revision"] != current_revision:
            continue
        if data["kind"] in MODEL_ARTIFACT_KINDS:
            data["model_family"] = artifact_family(data)
        out.setdefault(_norm(data["work"]), []).append(data)
    for lst in out.values():
        lst.sort(key=lambda a: -(a.get("created_at") or 0))
    return out


def all_analyses():
    """Разборы работ по всем деревьям, НОВЫЕ СВЕРХУ — вкладка «Отчёты».

    Порядок по дате, а не по оценке: свежий прогон должен быть виден сразу, иначе он тонет
    в хвосте длинной таблицы и выглядит как «отчёт не появился».

    Разборов три вида (`analyze`, `analyze_adv`, `analyze_product`) и два семейства модели.
    Они отвечают на разные вопросы, поэтому показываются отдельными строками; от каждого
    сочетания вида и семейства берём последний прогон по работе.
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
            for family in MODEL_FAMILIES:
                for kind in ANALYSIS_KINDS:
                    a = next((x for x in arts
                              if x.get("kind") == kind and artifact_family(x) == family), None)
                    if a is None:
                        continue
                    w = by_name.get(name) or {}
                    out.append({"tree_id": tid, "work": a.get("work"), "kind": kind,
                                "model_family": family,
                                "root": meta.get("root"), "condition": tree.get("condition"),
                                "top_freq": w.get("top_freq"), "phrases": a.get("phrases"),
                                **{k: a.get(k) for k in
                                   ("verdict", "verdict_score", "confidence",
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
                        "ranked_at": None, "ranked_by": None,
                        "works": 0, "best_score": None, "ranked": 0,
                        "segments": 0, "phrases": 0, "excluded": 0})
            continue
        _, meta = _input(params_file)
        arts = work_artifacts(tid)
        ranking = latest_ranking(tid)
        out.append({"id": tid, "error": None, "condition": tree.get("condition"),
                    "root": meta.get("root"), "root_freq": meta.get("root_freq"),
                    "created_at": int(tree_file.stat().st_mtime),
                    "ranked_at": (ranking or {}).get("created_at"),
                    "ranked_by": (ranking or {}).get("model_family"),
                    "analyzed": sum(1 for v in arts.values()
                                     if any(x.get("kind") == "analyze" for x in v)),
                    **counts(tree, [k for k, v in arts.items()
                                    if any(x.get("kind") == "analyze" for x in v)], ranking)})
    out.sort(key=lambda r: (r["created_at"] or 0), reverse=True)
    return out


def detail(tree_id):
    """Одно дерево целиком: работы с частотами фраз и прицепленными разборами."""
    tree, tree_file, params_file = load_tree(tree_id)
    freqs, meta = _input(params_file)
    arts = work_artifacts(tree_id)
    ranking = latest_ranking(tree_id)
    favorites = {_norm(name) for name in favorite_names(tree_id)}
    ranked = {_norm(w.get("name")): w for w in (ranking or {}).get("works") or []
              if isinstance(w, dict)}

    def with_freq(items):
        return sorted(({"phrase": p, "freq": freqs.get(p)} for p in (items or [])),
                      key=lambda x: (-(x["freq"] or 0), x["phrase"]))

    out_works = []
    for w in works(tree):
        mine = arts.get(_norm(w.get("name")), [])
        rank = ranked.get(_norm(w.get("name")), {})
        # Производная витринная метрика: намеренно сырая сумма частот всех формулировок
        # работы, включая сегменты. `top_freq` остаётся прежним максимумом и продолжает
        # использоваться в LLM-контрактах; сумму показываем отдельно, не выдавая её за
        # дедуплицированный уникальный спрос.
        sum_freq = sum((freqs.get(p) or 0) for p in work_phrases(w))
        # legacy-поле analysis остаётся Claude-проекцией; новый UI читает оба семейства из
        # artifacts. Так старые клиенты не начнут случайно показывать Codex как «основной».
        a = next((x for x in mine
                  if x.get("kind") == "analyze" and artifact_family(x) == "claude"), None)
        out_works.append({**{k: w.get(k) for k in CLASS_WORK_KEYS},
                          **{k: rank.get(k) for k in RANK_KEYS},
                          "favorite": _norm(w.get("name")) in favorites,
                          "sum_freq": sum_freq,
                          "phrases": with_freq(w.get("phrases")),
                          "segments": [{**{k: s.get(k) for k in SEGMENT_KEYS},
                                        "phrases": with_freq(s.get("phrases"))}
                                       for s in (w.get("segments") or [])
                                       if isinstance(s, dict)],
                          "artifacts": [{**{k: x.get(k) for k in
                                            ("kind", "created_at", "report_link", "task_id",
                                             "verdict", "verdict_score", "summary",
                                             "model_family")},
                                          "mrr6": _mrr6(x)}
                                         for x in mine],
                          "analysis": {k: a.get(k) for k in
                                       ("verdict", "verdict_score", "report_link",
                                        "created_at", "searched", "confidence",
                                        "model_family")} if a else None})
    # До отдельного анализа сохраняем порядок классификации. После — продуктовые кандидаты сверху.
    if ranking:
        out_works.sort(key=lambda w: (-(w.get("score") or 0), -(w.get("top_freq") or 0)))
    excluded = [{"phrase": e.get("phrase"), "why": e.get("why"), "note": e.get("note"),
                 "freq": freqs.get(e.get("phrase"))}
                for e in (tree.get("excluded") or []) if isinstance(e, dict)]
    excluded.sort(key=lambda e: (str(e["why"]), -(e["freq"] or 0)))
    history = refinement_history(tree_id)
    return {"id": tree_id, "condition": tree.get("condition"),
            "root": meta.get("root"), "root_freq": meta.get("root_freq"),
            "created_at": int(tree_file.stat().st_mtime),
            "revision": tree_revision(tree),
            "refined_at": tree.get("_refined_at"),
            "refined_by": tree.get("_refined_by"),
            "ranked_at": (ranking or {}).get("created_at"),
            "ranked_by": (ranking or {}).get("model_family"),
            "rank_task_id": (ranking or {}).get("task_id"),
            "refinements": history,
            "counts": counts(tree, [k for k, v in arts.items()
                                    if any(x.get("kind") == "analyze" for x in v)], ranking),
            "works": out_works, "excluded": excluded}


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


def validate_tree(payload, tree, strict=False):
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
    freq = {_norm(n.get("phrase")): n.get("freq")
            for n in payload.get("nodes", []) if isinstance(n, dict) and n.get("phrase")}
    seen, dup = set(), []
    for i, w in enumerate(ws):
        if not isinstance(w, dict):
            out.append(f"works[{i}] не объект")
            continue
        if not isinstance(w.get("name"), str) or not w["name"].strip():
            out.append(f"works[{i}]: пустое name")
        forbidden = sorted(set(w) & set(CLASS_FORBIDDEN_KEYS))
        if forbidden:
            out.append(f"works[{i}] ({w.get('name')}): классификация не должна содержать "
                       f"продуктовый анализ: {forbidden}")
        segments = w.get("segments")
        if strict and not isinstance(segments, list):
            out.append(f"works[{i}] ({w.get('name')}): segments должен быть массивом")
        if strict and not isinstance(w.get("phrases"), list):
            out.append(f"works[{i}] ({w.get('name')}): phrases должен быть массивом")
        for j, segment in enumerate(segments or []):
            if not isinstance(segment, dict):
                if strict:
                    out.append(f"works[{i}].segments[{j}] не объект")
                continue
            forbidden = sorted(set(segment) & set(CLASS_FORBIDDEN_KEYS))
            if forbidden:
                out.append(f"works[{i}].segments[{j}]: классификация не должна содержать "
                           f"продуктовый анализ: {forbidden}")
            if strict and not isinstance(segment.get("phrases"), list):
                out.append(f"works[{i}].segments[{j}]: phrases должен быть массивом")
        phrases = work_phrases(w)
        for ph in phrases:
            n = _norm(ph)
            dup.append(ph) if n in seen else seen.add(n)
        if strict:
            name = w.get("name")
            if not phrases:
                out.append(f"works[{i}] ({name}): работа не содержит фраз")
            if not isinstance(w.get("unclear"), bool):
                out.append(f"works[{i}] ({name}): unclear должен быть true или false")
            phrase_count = w.get("phrase_count")
            if (not isinstance(phrase_count, int) or isinstance(phrase_count, bool)
                    or phrase_count != len(phrases)):
                out.append(f"works[{i}] ({name}): phrase_count={w.get('phrase_count')!r}, "
                           f"фактически {len(phrases)}")
            expected_top = max((freq.get(_norm(ph)) or 0 for ph in phrases), default=0)
            if w.get("top_freq") != expected_top:
                out.append(f"works[{i}] ({name}): top_freq={w.get('top_freq')!r}, "
                           f"по входу {expected_top}")
    for e in tree.get("excluded") or []:
        ph = e.get("phrase") if isinstance(e, dict) else e
        if not isinstance(e, dict) or not ph or not (e.get("why") or "").strip():
            out.append(f"excluded: нужен объект с phrase и why, получено {e!r}"[:160])
            continue
        n = _norm(ph)
        dup.append(ph) if n in seen else seen.add(n)
    given = {_norm(n["phrase"]) for n in payload.get("nodes", [])
             if isinstance(n, dict) and n.get("phrase")}
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
    initial = {**classification_only(tree), "_revision": 0}
    _write_json_atomic(d / "params.json", payload)
    _write_json_atomic(d / "accepted.json", initial)
    return d


def save_refined_tree(tree_id, tree, task_id, family, expected_revision):
    """Сохранить полный результат второго прохода и предыдущую ревизию.

    Проверка ревизии защищает от применения устаревшего ответа, если файл успели изменить
    вручную, пока модель работала.
    """
    current, tree_file, params_file = load_tree(tree_id)
    if tree_file.name != "accepted.json" or params_file is None:
        raise NeedsError(f"дерево {tree_id} не поддерживает повторную классификацию")
    before_revision = tree_revision(current)
    if before_revision != expected_revision:
        raise NeedsError(
            f"дерево изменилось во время второго прохода: было {expected_revision}, "
            f"стало {before_revision}"
        )
    now = int(time.time())
    revision = before_revision + 1
    accepted = {**classification_only(tree), "_revision": revision, "_refined_at": now,
                "_refined_by": model_family(family), "_refine_task_id": task_id}
    revisions = tree_file.parent / "revisions"
    revisions.mkdir(parents=True, exist_ok=True)
    backup = revisions / f"revision-{before_revision}-before-{task_id}.json"
    event = revisions / f"refinement-{task_id}.json"
    _write_json_atomic(backup, current)
    before_counts, after_counts = counts(current), counts(accepted)
    meta = {"task_id": task_id, "model_family": model_family(family),
            "created_at": now, "from_revision": before_revision, "revision": revision,
            "backup": backup.name, "before": before_counts, "after": after_counts}
    _write_json_atomic(event, meta)
    _write_json_atomic(tree_file, accepted)
    return meta


def refinement_history(tree_id):
    """Метаданные вторых проходов, новые сверху; сами старые деревья остаются на диске."""
    root = NEEDS_DIR / tree_id / "revisions"
    try:
        current_revision = tree_revision(load_tree(tree_id)[0])
    except NeedsError:
        return []
    out = []
    for f in root.glob("refinement-*.json"):
        try:
            data = _read(f)
        except NeedsError:
            continue
        # Событие пишется до атомарной замены accepted.json. Если финальный replace не удался,
        # подготовленная запись не должна выглядеть как завершённый второй проход.
        if data.get("revision", current_revision + 1) > current_revision:
            continue
        out.append(data)
    out.sort(key=lambda x: -(x.get("created_at") or 0))
    return out


def work_input(tree_id, work_name, top):
    """Данные для разбора работы: сама работа, её фразы с частотами и какие фразы
    покупать под выдачу (самые частотные — они и представляют работу)."""
    tree, _, params_file = load_tree(tree_id)
    work = find_work(tree, work_name)
    ranking = latest_ranking(tree_id)
    rank = next((r for r in (ranking or {}).get("works") or []
                 if _norm(r.get("name")) == _norm(work_name)), {})
    freqs, meta = _input(params_file)
    phrases = sorted(({"phrase": p, "freq": freqs.get(p) or 0} for p in work_phrases(work)),
                     key=lambda x: (-x["freq"], x["phrase"]))
    return {"tree_id": tree_id, "condition": tree.get("condition"),
            "root": meta.get("root"),
            "work": {**{k: work.get(k) for k in CLASS_WORK_KEYS},
                     **{k: rank.get(k) for k in RANK_KEYS}},
            "segments": [{**{k: s.get(k) for k in SEGMENT_KEYS},
                          "phrases": sorted(s.get("phrases") or [],
                                            key=lambda p: -(freqs.get(p) or 0))}
                         for s in (work.get("segments") or []) if isinstance(s, dict)],
            "phrases": phrases,
            "search": [p["phrase"] for p in phrases[:max(1, top)]]}
