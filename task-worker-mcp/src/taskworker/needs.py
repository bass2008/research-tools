"""Тип задачи `needs` — сборка дерева потребностей по ветке дерева запросов.

Пока это лаборатория, а не часть конвейера: джобы живут локально (без FastAPI), чтобы
проверять промпт. Интерфейс агента при этом ровно тот же, что в бою (`get_job` /
`submit_result`), — проверяем то, что потом и поедет.

Вход агенту — JSON, а не доступ к базе: сравнивать прогоны можно только при идентичном
входе, иначе разница объясняется выбором среза, а не промптом. Базу читает эта обвязка,
строго `mode=ro` (в `cache` оплаченные данные).
"""

from __future__ import annotations

import json
import sqlite3
import time
import unicodedata
from itertools import combinations
from pathlib import Path

from .config import log_dir, repo_root

FLOOR = 50            # ниже — валидные листья, но в сборку по умолчанию не берём (design §4)
HEAD_FREQ = 30000     # выше — голова, интент размыт по определению
JOB_TYPE = "needs"
LOCAL_PREFIX = "local-"

PROMPT_FILE = Path(__file__).resolve().parents[2] / "prompts" / "needs.md"
REFERENCE_DIR = Path(__file__).resolve().parents[2] / "reference"


def lab_dir() -> Path:
    d = log_dir() / "needs-lab"
    d.mkdir(parents=True, exist_ok=True)
    return d


def db_path() -> Path:
    return repo_root() / "semcore.db"


def _connect_ro() -> sqlite3.Connection:
    con = sqlite3.connect(f"file:{db_path()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def _norm(s: str) -> str:
    return unicodedata.normalize("NFC", " ".join((s or "").split())).lower()


# ---------- payload ----------

def build_payload(root: str, min_freq: int = FLOOR, max_freq: int | None = None) -> dict:
    """Ветка как JSON: {root, root_freq, nodes:[{phrase, freq, children}]}.

    `children` — только те дети, что сами попали в payload, иначе агент увидит ссылки на
    фразы, которых у него нет."""
    root = _norm(root)
    con = _connect_ro()
    try:
        row = con.execute("SELECT phrase, COALESCE(freq,0) f, status FROM node WHERE phrase = ?",
                          (root,)).fetchone()
        if row is None:
            raise LookupError(f"узла нет в дереве: {root!r}")
        subtree = [r["ph"] for r in con.execute(
            """WITH RECURSIVE sub(ph) AS (
                 SELECT ? UNION SELECT e.child FROM sub JOIN edge e ON e.parent = sub.ph)
               SELECT ph FROM sub""", (root,))]
        qs = ",".join("?" * len(subtree))
        freq = {r["phrase"]: r["f"] for r in con.execute(
            f"SELECT phrase, COALESCE(freq,0) f FROM node WHERE phrase IN ({qs})", subtree)}
        kept = {p for p, f in freq.items()
                if f >= min_freq and (max_freq is None or f <= max_freq)}
        kept.add(root)
        edges: dict[str, list[str]] = {}
        for r in con.execute(
                f"SELECT parent, child FROM edge WHERE parent IN ({qs})", subtree):
            if r["parent"] in kept and r["child"] in kept:
                edges.setdefault(r["parent"], []).append(r["child"])
    finally:
        con.close()

    nodes = [{"phrase": p, "freq": freq[p],
              "children": sorted(edges.get(p, []), key=lambda c: (-freq[c], c))}
             for p in sorted(kept, key=lambda p: (-freq[p], p))]
    return {"root": root, "root_freq": freq[root], "status": row["status"],
            "min_freq": min_freq, "max_freq": max_freq,
            "floor": FLOOR, "head_freq": HEAD_FREQ,
            "subtree_total": len(subtree), "nodes": nodes}


# ---------- локальные джобы ----------

def job_dir(job_id: str) -> Path:
    return lab_dir() / job_id


def _job_file(job_id: str) -> Path:
    return job_dir(job_id) / "job.json"


def is_local(job_id: str) -> bool:
    return job_id.startswith(LOCAL_PREFIX)


def _sha(path: Path) -> str:
    import hashlib

    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_job(payload: dict, tag: str = "") -> str:
    """Джоб — каталог: `params.json` (вход), `result.json` (куда писать ответ), `job.json`.

    Данные передаём ФАЙЛОМ, а не значением: и вход (65 КБ), и ответ (~47 тыс. символов) не
    должны ехать через вызов инструмента — обрезка по длине там проходит молча и даёт
    валидный JSON без хвоста. Пути объявляет обвязка; модель их не выбирает.
    Хэш входа храним, чтобы можно было доказать, что два прогона получили одно и то же."""
    n = 1 + sum(1 for _ in lab_dir().glob(f"{LOCAL_PREFIX}{JOB_TYPE}-*"))
    job_id = f"{LOCAL_PREFIX}{JOB_TYPE}-{n:03d}" + (f"-{tag}" if tag else "")
    d = job_dir(job_id)
    d.mkdir(parents=True, exist_ok=True)
    (d / "params.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1),
                                   encoding="utf-8")
    (d / "prompt.md").write_text(PROMPT_FILE.read_text(encoding="utf-8"), encoding="utf-8")
    job = {"job_id": job_id, "type": JOB_TYPE,
           "input_file": str(d / "params.json"), "input_sha256": _sha(d / "params.json"),
           "result_file": str(d / "result.json"),
           "root": payload["root"], "root_freq": payload["root_freq"],
           "phrase_count": len(payload["nodes"]),
           "created_at": int(time.time()), "error": None}
    _job_file(job_id).write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
    return job_id


def load_job(job_id: str) -> dict:
    """Запись джоба + подтянутые из файлов вход и ответ (как их видит обвязка)."""
    f = _job_file(job_id)
    if not f.is_file():
        raise LookupError(f"локального джоба нет: {job_id}")
    job = json.loads(f.read_text(encoding="utf-8"))
    job["params"] = json.loads(Path(job["input_file"]).read_text(encoding="utf-8"))
    job["prompt"] = (job_dir(job_id) / "prompt.md").read_text(encoding="utf-8")
    accepted = job_dir(job_id) / "accepted.json"
    job["result"] = json.loads(accepted.read_text(encoding="utf-8")) if accepted.is_file() else None
    return job


def job_for_agent(job_id: str) -> dict:
    """Что уходит агенту: сводка, путь к входу, путь для ответа и промпт. Фраз в ответе
    инструмента нет — за ними агент идёт в файл."""
    job = json.loads(_job_file(job_id).read_text(encoding="utf-8"))
    return {"job_id": job_id, "type": job["type"], "prompt":
            (job_dir(job_id) / "prompt.md").read_text(encoding="utf-8"),
            "params": {"root": job["root"], "root_freq": job["root_freq"],
                       "phrase_count": job["phrase_count"],
                       "input_file": job["input_file"]},
            "result_file": job["result_file"],
            "как отдать ответ": "запиши JSON в result_file и вызови submit_result(job_id) "
                                "без параметра result — обвязка прочитает файл сама"}


def validate(payload: dict, tree) -> list[str]:
    """Что не так с ответом. Пусто = принимаем.

    Синтаксис JSON проверит транспорт, здесь важнее то, что остаётся валидным JSON и всё
    равно неверно: потерянные и выдуманные фразы, дубли, несходящиеся счётчики."""
    if not isinstance(tree, dict):
        return [f"ответ должен быть объектом, а не {type(tree).__name__}"]
    out: list[str] = []
    works = tree.get("works")
    if not isinstance(works, list) or not works:
        out.append("нет непустого списка works")
        works = works if isinstance(works, list) else []
    for i, w in enumerate(works):
        if not isinstance(w, dict):
            out.append(f"works[{i}] не объект")
            continue
        if not (w.get("name") or "").strip():
            out.append(f"works[{i}]: пустое name")
        phrases = w.get("phrases")
        if not isinstance(phrases, list):
            out.append(f"works[{i}] ({w.get('name')}): phrases не список")
        segs = w.get("segments") or []
        total = len(phrases or []) + sum(len(s.get("phrases") or []) for s in segs
                                        if isinstance(s, dict))
        if isinstance(w.get("phrase_count"), int) and w["phrase_count"] != total:
            out.append(f"works[{i}] ({w.get('name')}): phrase_count={w['phrase_count']}, "
                       f"а фраз {total}")

    given = {n["phrase"] for n in payload.get("nodes", [])}
    seen: set[str] = set()
    dup: list[str] = []
    for w in works:
        if not isinstance(w, dict):
            continue
        every = list(w.get("phrases") or []) + [p for s in (w.get("segments") or [])
                                                if isinstance(s, dict)
                                                for p in (s.get("phrases") or [])]
        for ph in every:
            n = _norm(ph)
            dup.append(ph) if n in seen else seen.add(n)
    for e in tree.get("excluded") or []:
        ph = e.get("phrase", "") if isinstance(e, dict) else e
        why = (e.get("why") or "").strip() if isinstance(e, dict) else ""
        if not isinstance(e, dict) or not ph or not why:
            out.append(f"excluded: нужен объект с phrase и why, получено {e!r}"[:160])
            continue
        n = _norm(ph)
        dup.append(ph) if n in seen else seen.add(n)

    lost, invented = sorted(given - seen), sorted(seen - given)
    if lost:
        out.append(f"потеряно {len(lost)} входных фраз (каждая должна встретиться ровно один "
                   f"раз), например: {lost[:5]}")
    if invented:
        out.append(f"{len(invented)} фраз, которых нет во входе: {invented[:5]}")
    if dup:
        out.append(f"{len(dup)} фраз встречаются больше одного раза: {dup[:5]}")
    return out


def save_result(job_id: str, result=None, error: str | None = None,
                result_file: str | None = None) -> dict:
    """Принять ответ. Ответ приходит ФАЙЛОМ (`result_file` джоба) либо значением.

    Путь берём из джоба, а не из вызова: путь, пришедший от модели, — это чтение
    произвольного файла по её указке. Переданный `result_file` разрешаем только если он
    совпадает с объявленным. Ответ принимается только целиком прошедшим `validate`."""
    record = json.loads(_job_file(job_id).read_text(encoding="utf-8"))
    declared = Path(record["result_file"])
    if result_file and Path(result_file).resolve() != declared.resolve():
        return {"accepted": False, "job_id": job_id,
                "problems": [f"ответ читаем только из объявленного result_file: {declared}"]}
    if result is None and error is None:
        if not declared.is_file():
            return {"accepted": False, "job_id": job_id,
                    "problems": [f"файла ответа нет: {declared}"]}
        try:
            result = json.loads(declared.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            return {"accepted": False, "job_id": job_id,
                    "problems": [f"в {declared.name} невалидный JSON: {exc}"],
                    "hint": "частая причина — ответ обрезан по длине; перезапиши файл целиком"}

    params = json.loads(Path(record["input_file"]).read_text(encoding="utf-8"))
    problems = validate(params, result) if result is not None else []
    if problems:
        attempts = job_dir(job_id) / "rejected"
        attempts.mkdir(exist_ok=True)
        (attempts / f"{int(time.time())}.json").write_text(
            json.dumps({"problems": problems, "result": result}, ensure_ascii=False, indent=1),
            encoding="utf-8")
        return {"accepted": False, "job_id": job_id, "problems": problems,
                "hint": "исправь перечисленное и вызови submit_result снова"}
    if result is not None:
        (job_dir(job_id) / "accepted.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    record["error"] = error
    record["finished_at"] = int(time.time())
    _job_file(job_id).write_text(json.dumps(record, ensure_ascii=False, indent=1),
                                 encoding="utf-8")
    return {"accepted": True, "job_id": job_id,
            "stored": str(job_dir(job_id) / "accepted.json")}


# ---------- разбор ответа и сравнение с эталоном ----------

def flatten(tree: dict) -> tuple[dict[str, str], dict[str, str]]:
    """-> ({фраза: имя работы}, {фраза: причина исключения}).

    Сегменты сворачиваем к их работе: модель вправе дробить мельче нас, и сравнивать
    осмысленно на уровне работ."""
    works: dict[str, str] = {}
    excluded: dict[str, str] = {}
    for w in tree.get("works") or []:
        name = (w.get("name") or "").strip()
        for ph in w.get("phrases") or []:
            works[_norm(ph)] = name
        for seg in w.get("segments") or []:
            for ph in seg.get("phrases") or []:
                works[_norm(ph)] = name
    for e in tree.get("excluded") or []:
        if isinstance(e, str):
            excluded[_norm(e)] = "?"
        else:
            excluded[_norm(e.get("phrase", ""))] = (e.get("why") or "?").strip()
    return works, excluded


def flatten_fine(tree: dict) -> dict[str, str]:
    """{фраза: 'работа / сегмент'} — самое мелкое разбиение, что дал агент.

    Нужно для проверки изоляции: щель считается найденной, если узкая потребность лежит в
    своей группе, а не размазана по общей работе. Работой она стала или сегментом — не важно."""
    fine: dict[str, str] = {}
    for w in tree.get("works") or []:
        name = (w.get("name") or "").strip()
        for ph in w.get("phrases") or []:
            fine[_norm(ph)] = name
        for seg in w.get("segments") or []:
            for ph in seg.get("phrases") or []:
                fine[_norm(ph)] = f"{name} / {(seg.get('name') or '').strip()}"
    return fine


def check_isolation(reference: dict, tree: dict) -> list[dict]:
    """Изолировал ли агент узкие потребности, которые мы считаем кандидатами в щель.

    Изоляция = все фразы потребности лежат в ОДНОЙ группе, и в неё не затянуты опорные
    фразы других работ. Прочие фразы в группе загрязнением НЕ считаются: наш эталон —
    выборка опор, а не полный список, и «сделать логотип» из шести логотипных фраз —
    ровно то, чего мы и хотели (на этом первая версия проверки и врала)."""
    fine = flatten_fine(tree)
    _, excluded = flatten(tree)
    ref_work_of = {_norm(p): g for g, ps in (reference.get("works") or {}).items() for p in ps}
    out = []
    for name, phrases in (reference.get("expected_isolated") or {}).items():
        got = {_norm(p): fine.get(_norm(p)) for p in phrases}
        present = {p: g for p, g in got.items() if g}
        groups = set(present.values())
        own = {ref_work_of.get(p) for p in present} - {None}
        others = {p for p, g in fine.items() if g in groups} - set(present)
        alien = {p: ref_work_of[p] for p in others
                 if p in ref_work_of and ref_work_of[p] not in own}
        out.append({
            "узкая потребность": name,
            "изолирована": bool(present) and len(groups) == 1 and not alien,
            "группа у агента": sorted(groups) or None,
            "фраз не найдено": [p for p, g in got.items() if not g
                                and p not in excluded] or None,
            "выброшено агентом": {p: excluded[p] for p in got if p in excluded} or None,
            "затянуто из других работ": alien or None,
            "прочих фраз в группе": len(others),
        })
    return out


def coverage(payload: dict, tree: dict) -> dict:
    """Каждая входная фраза должна быть либо в работе, либо в excluded — ровно один раз."""
    given = {n["phrase"] for n in payload["nodes"]}
    works, excluded = flatten(tree)
    placed = set(works) | set(excluded)
    return {"given": len(given), "placed": len(placed & given),
            "missing": sorted(given - placed)[:20],
            "missing_count": len(given - placed),
            "invented": sorted(placed - given)[:20],
            "invented_count": len(placed - given),
            "both_work_and_excluded": sorted(set(works) & set(excluded))[:20],
            "works": len(tree.get("works") or []),
            "segments": sum(len(w.get("segments") or []) for w in tree.get("works") or [])}


def compare(reference: dict, tree: dict) -> dict:
    """Сходство сборок по опорным фразам, без сравнения названий.

    Названия работ у модели свои — сравниваем РАЗБИЕНИЕ: для каждой пары опорных фраз
    совпадает ли ответ «в одной работе или в разных». Плюс отдельно — совпал ли выброс
    (бренды/каталоги/потребление/мусор)."""
    ref_works = {_norm(p): g for g, ps in (reference.get("works") or {}).items() for p in ps}
    ref_excluded = {_norm(p): why for why, ps in (reference.get("excluded") or {}).items()
                    for p in ps}
    got_works, got_excluded = flatten(tree)

    anchors = [p for p in ref_works if p in got_works or p in got_excluded]
    agree = disagree = 0
    for a, b in combinations(sorted(anchors), 2):
        same_ref = ref_works[a] == ref_works[b]
        same_got = (a in got_works and b in got_works and got_works[a] == got_works[b])
        agree += same_ref == same_got
        disagree += same_ref != same_got

    misplaced = [{"phrase": p, "эталон": ref_works[p],
                  "агент": got_works.get(p) or f"выброшено ({got_excluded.get(p)})"}
                 for p in anchors
                 if p in got_excluded]                      # работа, которую агент выбросил
    lost = sorted(set(ref_works) - set(got_works) - set(got_excluded))

    ex_hit = sorted(p for p in ref_excluded if p in got_excluded)
    ex_miss = sorted(p for p in ref_excluded if p not in got_excluded)
    total = agree + disagree
    return {
        "опорных фраз": len(anchors),
        "согласие по парам": round(100 * agree / total, 1) if total else None,
        "пар сравнено": total,
        "работы, выброшенные агентом": misplaced,
        "опорные фразы, которых нет в ответе": lost[:20],
        "выброс: совпал": len(ex_hit),
        "выброс: не выброшено агентом": [{"phrase": p, "ожидали": ref_excluded[p]}
                                         for p in ex_miss],
        "групп у агента": len(set(got_works.values())),
        "групп в эталоне": len(set(ref_works.values())),
        "изоляция узких потребностей": check_isolation(reference, tree),
    }


def as_reference(tree: dict, source: str = "") -> dict:
    """Ответ агента в формате эталона — чтобы сравнивать прогон с прогоном (v1 против v2)
    той же меркой, что с ручной сборкой."""
    works: dict[str, list[str]] = {}
    excluded: dict[str, list[str]] = {}
    for ph, name in flatten(tree)[0].items():
        works.setdefault(name or "?", []).append(ph)
    for ph, why in flatten(tree)[1].items():
        excluded.setdefault(why or "?", []).append(ph)
    return {"branch": tree.get("condition") or "", "source": source,
            "condition": tree.get("condition"), "works": works, "excluded": excluded,
            "expected_isolated": {}}


def load_reference(name_or_path: str) -> dict:
    p = Path(name_or_path)
    if not p.is_file():
        p = REFERENCE_DIR / f"{name_or_path}.json"
    if not p.is_file():
        raise LookupError(f"эталон не найден: {name_or_path}")
    return json.loads(p.read_text(encoding="utf-8"))
