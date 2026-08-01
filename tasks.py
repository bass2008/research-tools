#!/usr/bin/env python3
"""
Операции конвейера drill (tech-design §4): load, full_load, search, classify, score,
analyze, drill.

Правила, общие для всех операций:
- одна операция = одна строка `task` (дробление на LLM-джобы — деталь транспорта, tech §3);
- операция обновляет строку task (QUEUED -> RUNNING -> DONE|FAILED), публикует события
  и пишет модель; переходы статусов — строго по design §2;
- любой отказ (таймаут, ошибка агента, невалидный JSON, падение сети) -> task FAILED,
  ошибка в лог, УЗЕЛ ОСТАЁТСЯ КАК БЫЛ. Ретраев нет;
- в БД пишем только из event-loop-треда; блокирующая сеть — через run_in_executor.

Рантайм (соединение с БД, шина событий, очередь, семафоры, обмен с LLM) приходит
объектом `ctx` из server.py — здесь его не создают, чтобы не было кольца импортов.
"""
import asyncio
import json
import os
import re
import time
import uuid
import xml.etree.ElementTree as ET

import httpx

import needs_layer
import wscore

ROOT = wscore.ROOT
REPORTS = ROOT / "reports"
PROMPTS = ROOT / "task-worker-mcp" / "prompts"

LLM_TYPES = ("classify", "score", "analyze", "needs", "analyze_work", "season", "adjacent")
SCORE_BATCH = 12            # фраз в одном score-джобе (tech §3: батч 8-15)
DRILL_WIDTH = 4             # кандидатов drill параллельно (СВОЙ семафор, не очередь задач)
MAX_NODE_DELTAS = 300       # больше node-дельт за одну операцию не шлём: только progress
PROGRESS_EVERY = 0.5        # progress краула — не чаще, чем раз в N секунд
LOG_EVERY = 50              # строка в лог на каждые N фетчей краула
SERP_TOP = 10               # топ-10 выдачи (design §6.2)
SERP_REGION = "ru"
YANDEX_LR = 225             # Россия (Яндекс)
GOOGLE_LOC = 2643           # Россия (geo target Google)
HEAD_FREQ = 30000           # freq выше -> classify всегда CATEGORY (design §2)
NEEDS_SERP_TOP = 1          # по скольким самым частотным фразам работы покупаем выдачу
ADJACENT_FIRST = 8          # смежных корней в первом заходе
ADJACENT_MORE = 4           # добор во втором заходе, если всплыл пропущенный корень
VERDICTS = ("BUILD", "MAYBE", "SKIP")

# Ожидание LLM: (база на операцию, добавка на каждую следующую часть), секунды.
# Масштабируется от числа частей, чтобы крупная операция не падала при нормальной работе
# (tech §3): минуты для classify/score, десятки минут для analyze.
LLM_TIMEOUT = {"classify": (300, 90), "score": (300, 90), "analyze": (2400, 0),
               "needs": (2400, 0), "analyze_work": (2400, 0),
               "season": (600, 0), "adjacent": (900, 300)}

_serp_client = httpx.Client(timeout=60)
_prompts = {}


def _now():
    return int(time.time())


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


# ---------- строка task ----------

def _task_row(ctx, task_id):
    r = ctx.con.execute(
        "SELECT id, type, status, node, params, created_at, started_at, finished_at, error "
        "FROM task WHERE id = ?", (task_id,)).fetchone()
    return dict(r) if r else None


def _task_event(ctx, task_id):
    """Событие task (tech §6.2) — вкладка Task."""
    row = _task_row(ctx, task_id)
    if row:
        row.pop("params", None)
        ctx.publish("task", row)


def create_task(ctx, op, node, params=None):
    """Новая строка task в статусе QUEUED. -> task_id (uuid4-hex)."""
    task_id = uuid.uuid4().hex
    ctx.con.execute(
        "INSERT INTO task(id, type, status, node, params, created_at) VALUES (?, ?, 'QUEUED', ?, ?, ?)",
        (task_id, op, node, _dump(params), _now()))
    ctx.con.commit()
    _task_event(ctx, task_id)
    return task_id


def _dump(obj, cap=2_000_000):
    if obj is None:
        return None
    s = json.dumps(obj, ensure_ascii=False)
    return s if len(s) <= cap else s[:cap]


def _save_params(ctx, task_id, params):
    """Дописать params операции (считаются в момент исполнения, а не постановки)."""
    ctx.con.execute("UPDATE task SET params = ? WHERE id = ?", (_dump(params), task_id))
    ctx.con.commit()


def set_task_status(ctx, task_id, status):
    """Сменить статус задачи и разослать событие. Отдельная точка, потому что статус меняют
    и операция, и брокер LLM (исполнитель забрал джоб)."""
    ctx.con.execute("UPDATE task SET status = ? WHERE id = ?", (status, task_id))
    ctx.con.commit()
    _task_event(ctx, task_id)


def _finish(ctx, task_id, status, result=None, error=None):
    ctx.con.execute("UPDATE task SET status = ?, finished_at = ?, result = ?, error = ? WHERE id = ?",
                    (status, _now(), _dump(result), error, task_id))
    ctx.con.commit()
    _task_event(ctx, task_id)


# ---------- постановка и исполнение ----------

def enqueue(ctx, op, phrase, params=None):
    """Команда HTTP: строка task + блокировка узла + постановка в очередь. -> task_id.
    Синхронна: ручка отвечает ack сразу, выполнение фоновое (tech §2)."""
    node = wscore.normalize(phrase)
    task_id = create_task(ctx, op, node, params)
    ctx.acquire([node], task_id)
    ctx.queue.put_nowait(task_id)
    ctx.log("INFO", op, node, f"задача {task_id[:8]} поставлена в очередь")
    return task_id


async def run_step(ctx, op, phrase, params=None, lock=None):
    """Шаг drill ИНЛАЙН (await, не через очередь — иначе вложенные ожидания делят пул).
    Своя строка task и своя блокировка на своих узлах. -> True, если шаг удался."""
    node = wscore.normalize(phrase)
    task_id = create_task(ctx, op, node, params)
    nodes = [wscore.normalize(p) for p in (lock if lock is not None else [node])]
    ctx.acquire(nodes, task_id)
    return await execute(ctx, task_id, lock=nodes)


async def execute(ctx, task_id, lock=None):
    """Выполнить задачу: RUNNING -> DONE|FAILED, события/лог, снятие блокировки.
    Исключение операции не всплывает наружу: это штатный отказ (task FAILED + лог)."""
    row = _task_row(ctx, task_id)
    if row is None:
        ctx.log("ERROR", "queue", None, f"задача {task_id} исчезла из журнала")
        return False
    op, node = row["type"], row["node"]
    nodes = [p for p in (lock if lock is not None else [node]) if p]
    params = json.loads(row["params"]) if row["params"] else None
    ctx.con.execute("UPDATE task SET status = 'RUNNING', started_at = ? WHERE id = ?", (_now(), task_id))
    ctx.con.commit()
    _task_event(ctx, task_id)
    ctx.log("INFO", op, node, "старт")
    t0 = time.time()
    try:
        if op not in OPS:
            raise ValueError(f"неизвестная операция: {op}")
        result = await OPS[op](ctx, task_id, node, params)
        _finish(ctx, task_id, "DONE", result=result)
        ctx.log("INFO", op, node, f"готово за {time.time() - t0:.1f} c: {_brief(result)}")
        return True
    except asyncio.CancelledError:
        _finish(ctx, task_id, "FAILED", error="операция прервана (остановка сервера)")
        ctx.log("ERROR", op, node, "операция прервана")
        raise
    except Exception as e:
        _finish(ctx, task_id, "FAILED", error=f"{type(e).__name__}: {e}")
        ctx.log("ERROR", op, node, f"ошибка: {e}")
        return False
    finally:
        ctx.release(nodes, task_id)
        # занятость работы во втором слое снимаем здесь же: иначе новая операция легко
        # забудет это сделать и работа останется навсегда «занятой»
        act = {"needs_analyze": "analyze", "needs_season": "season",
               "needs_adjacent": "adjacent"}.get(op)
        if act and isinstance(params, dict) and params.get("tree_id"):
            ctx.needs_busy.discard((params["tree_id"],
                                    needs_layer._norm(params.get("work")), act))


def _brief(result):
    if not isinstance(result, dict):
        return "—"
    return ", ".join(f"{k}={v}" for k, v in result.items() if not isinstance(v, (dict, list)))


# ---------- обмен с LLM ----------

def _prompt(op):
    """Текст prompts/{op}.md: сервер инлайнит его в поле prompt джоба (tech §7)."""
    if op not in _prompts:
        path = PROMPTS / f"{op}.md"
        if not path.exists():
            raise RuntimeError(f"нет файла промпта: {path}")
        _prompts[op] = path.read_text(encoding="utf-8")
    return _prompts[op]


def _job(task_id, n, op, params):
    """Часть операции = джоб; job_id = "{task_id}:{n}", n с нуля."""
    return {"job_id": f"{task_id}:{n}", "task_id": task_id, "type": op,
            "params": params, "prompt": _prompt(op)}


async def _run_llm(ctx, op, node, jobs):
    """Положить джобы в очередь LLM и дождаться ВСЕХ частей (tech §3).
    Любой отказ или таймаут -> исключение: задача FAILED, узел не тронут.

    Пока джоб не забрал исполнитель, задача стоит в `WAITING`, а не в `RUNNING`: сервер свою
    часть сделал, работы никто не делает. `RUNNING` вернётся, когда агент возьмёт данные —
    иначе «висит без исполнителя» неотличимо от честной работы."""
    base, extra = LLM_TIMEOUT[op]
    timeout = base + extra * (len(jobs) - 1)
    if not ctx.llm_online():
        ctx.log("WARN", op, node,
                "LLM-петля не на связи — задача, скорее всего, провалится по таймауту")
    ctx.log("INFO", op, node, f"в очередь LLM: {len(jobs)} джоб(ов), таймаут {timeout:.0f} c")
    ctx.publish("progress", {"stage": op, "node": node, "done": 0, "total": len(jobs)})

    def on_done(n):
        ctx.publish("progress", {"stage": op, "node": node, "done": n, "total": len(jobs)})

    task_id = jobs[0]["task_id"]
    set_task_status(ctx, task_id, "WAITING")
    try:
        return await ctx.llm.run(jobs, timeout, on_done)
    finally:
        # задача идёт к DONE/FAILED через _finish; на случай ошибки после взятия джоба
        # оставляем строку в понятном состоянии, а не в «ждёт исполнителя»
        row = _task_row(ctx, task_id)
        if row and row["status"] == "WAITING":
            set_task_status(ctx, task_id, "RUNNING")


def _results(res, key="results"):
    """Ответ агента -> список результатов; форма не та -> ValueError (task FAILED)."""
    if isinstance(res, dict):
        res = res.get(key, res.get("items"))
    if not isinstance(res, list):
        raise ValueError(f"в ответе LLM нет массива {key}")
    return [it for it in res if isinstance(it, dict)]


def _str(v, cap=4000):
    """Текст из ответа LLM (что угодно -> строка или None): в БД летит только TEXT."""
    if v is None or v == "":
        return None
    if not isinstance(v, str):
        v = json.dumps(v, ensure_ascii=False)
    return v[:cap]


def _publish_node(ctx, phrase):
    """node-дельта по фразе (узел мог исчезнуть — тогда молчим)."""
    obj = wscore.node_object(ctx.con, phrase)
    if obj:
        ctx.publish("node", obj)


def _num(v, lo=None, hi=None):
    """Число из ответа LLM или None (мусор молча не пишем в модель)."""
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if lo is not None:
        f = max(lo, f)
    if hi is not None:
        f = min(hi, f)
    return f


# ---------- XMLRiver: пул фразы и выдача ----------

async def _fetch_pool(ctx, phrase):
    """Пул фразы (сеть/кэш) в executor под семафором XMLRiver; в БД тут не пишем."""
    loop = asyncio.get_running_loop()
    async with ctx.net:
        return await loop.run_in_executor(None, wscore.fetch_phrase, phrase, wscore.LIMIT, ctx.db)


def _serp_request(engine, phrase):
    """Блокирующий запрос выдачи к XMLRiver (только executor-тред): топ-10, регион ru."""
    wscore.load_env()
    url = os.environ.get("XMLRIVER_YANDEX_URL" if engine == "yandex" else "XMLRIVER_GOOGLE_URL")
    if not url:
        raise RuntimeError(f"не задан URL выдачи для движка {engine}")
    params = {"user": os.environ.get("XMLRIVER_USER", ""), "key": os.environ.get("XMLRIVER_KEY", ""),
              "query": phrase, "groupby": SERP_TOP}
    params["lr" if engine == "yandex" else "loc"] = YANDEX_LR if engine == "yandex" else GOOGLE_LOC
    last = None
    for attempt in range(len(wscore.RETRY_DELAYS) + 1):
        if attempt:
            time.sleep(wscore.RETRY_DELAYS[attempt - 1])   # 10 c, 30 c, 60 c
        try:
            r = _serp_client.get(url, params=params)
            r.raise_for_status()
            return _parse_serp(r.text)
        except (wscore.XmlRiverError, httpx.TransportError, httpx.HTTPStatusError) as e:
            last = e                                        # транзиентно: пробуем снова
    raise RuntimeError(f"выдача {engine} по {phrase!r} не получена за "
                       f"{len(wscore.RETRY_DELAYS) + 1} попыток: {last}")


def _text(el):
    """Текст элемента вместе с вложенными <hlword> (Яндекс подсвечивает совпадения)."""
    if el is None:
        return ""
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def _parse_serp(xml):
    """XML XMLRiver (формат Яндекс XML) -> {found, docs: [{rank,url,title,snippet}]}."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        raise RuntimeError(f"XMLRiver вернул не XML: {e}") from None
    err = root.find(".//error")
    if err is not None:
        code = err.get("code")
        msg = f"XMLRiver: {_text(err) or 'ошибка'} (code={code})"
        # code=500 «Выполните перезапрос» — источник сам просит повторить (design §0)
        if str(code) in {str(c) for c in wscore.XMLRIVER_TRANSIENT_CODES}:
            raise wscore.XmlRiverError(msg)
        raise RuntimeError(msg)
    found_el = root.find(".//found")
    found = None
    if found_el is not None and (found_el.text or "").strip().isdigit():
        found = int(found_el.text.strip())
    docs = []
    for doc in root.iter("doc"):
        if len(docs) >= SERP_TOP:
            break
        passages = " ".join(x for x in (_text(p) for p in doc.iter("passage")) if x)
        docs.append({"rank": len(docs) + 1,
                     "url": _text(doc.find("url")) or _text(doc.find("displayurl")),
                     "title": _text(doc.find("title")),
                     "snippet": passages or _text(doc.find("headline"))})
    return {"found": found, "docs": docs}


async def _fetch_serp(ctx, engine, phrase):
    loop = asyncio.get_running_loop()
    async with ctx.net:
        return await loop.run_in_executor(None, _serp_request, engine, phrase)


# ---------- операции: не-LLM ----------

async def load(ctx, task_id, phrase, params):
    """Пул одной фразы — один уровень вниз, браузинг (NEW -> LOADED)."""
    qn, own_freq, refs, pool_ts = await _fetch_pool(ctx, phrase)
    wscore.save_phrase(ctx.con, qn, own_freq, refs, pool_ts=pool_ts)
    ctx.publish("node", wscore.set_status(ctx.con, qn, "LOADED"))
    ctx.publish("children", {"parent": qn, "children": wscore.project(ctx.con, qn)})
    ctx.log("INFO", "load", qn, f"пул загружен: freq={own_freq}, уточнений {len(refs)}")
    return {"freq": own_freq, "children": len(refs)}


async def full_load(ctx, task_id, phrase, params):
    """Краул поддерева до конца (design §4). Прогресс — агрегированным событием progress,
    без node-дельты на каждый из тысяч узлов (tech §6.2)."""
    root = wscore.normalize(phrase)
    state = {"ts": 0.0}

    def on_progress(done, total, p):
        now = time.monotonic()
        if now - state["ts"] >= PROGRESS_EVERY or done >= total:
            state["ts"] = now
            ctx.publish("progress", {"stage": "full_load", "node": root, "done": done, "total": total})
        if done % LOG_EVERY == 0:
            ctx.log("INFO", "full_load", root, f"краул: {done}/{total} фетчей, последний — {p}")

    async with ctx.crawl:   # краулы не наслаиваются: внутри уже wscore.WORKERS фетчей
        res = await wscore.crawl_subtree(ctx.con, root, on_progress=on_progress)
    ctx.publish("progress", {"stage": "full_load", "node": root,
                             "done": res["fetched"], "total": res["fetched"]})
    for p, msg in res["errors"][:20]:
        ctx.log("WARN", "full_load", p, f"фетч не удался: {msg}")
    if any(p == root for p, _ in res["errors"]):
        raise RuntimeError(f"не удалось загрузить сам корень: {dict(res['errors'])[root]}")
    _publish_node(ctx, root)
    ctx.publish("children", {"parent": root, "children": wscore.project(ctx.con, root)})
    extra = ""
    if res.get("rechecked"):
        # частота узла могла пересечь FLOOR уже после решения по нему — тогда краул делает
        # ещё круг; видеть это полезно, иначе цифра фетчей выглядит необъяснимо большой
        extra += f", кругов перепроверки {res['rechecked']}"
    if res.get("left"):
        extra += f", НЕ ЗАГРУЖЕНО узлов >= FLOOR: {res['left']}"
    ctx.log("INFO" if not res.get("left") else "WARN", "full_load", root,
            f"поддерево загружено: узлов {res['nodes']}, фетчей {res['fetched']}, "
            f"ошибок {len(res['errors'])}{extra} -> FULLY_LOADED")
    return {"nodes": res["nodes"], "fetched": res["fetched"], "errors": len(res["errors"]),
            "rechecked": res.get("rechecked", 0), "left": res.get("left", 0)}


async def _ensure_serp(ctx, qn, stage="search"):
    """Выдача по фразе есть в `serp` — иначе купить и сохранить. -> {движок: сколько док.}.

    Инвариант: пишем ОБЕ выдачи или ни одной — падение движка не оставляет частичной.
    Таблица `serp` — оплаченный кэш с ключом «фраза+движок», поэтому повтор бесплатен, и
    разбор работы во втором слое переиспользует то, что купил узловой `search`, и наоборот."""
    have = wscore.load_serp(ctx.con, qn)
    if all(e in have for e in wscore.SERP_ENGINES):
        ctx.log("INFO", stage, qn, "выдача уже в serp — в сеть не идём")
        return {e: len(have[e]["docs"]) for e in wscore.SERP_ENGINES}
    if wscore.cache_only():
        raise RuntimeError("режим только кэш: выдачи для фразы нет в serp")
    serps = {}
    for engine in wscore.SERP_ENGINES:   # последовательно: источник платный
        serps[engine] = await _fetch_serp(ctx, engine, qn)
    wscore.save_serp(ctx.con, qn, serps)  # no-partial проверяется внутри
    counts = {e: len(serps[e]["docs"]) for e in wscore.SERP_ENGINES}
    ctx.log("INFO", stage, qn,
            f"выдача сохранена: yandex {counts['yandex']} док., google {counts['google']} док.")
    return counts


async def search(ctx, task_id, phrase, params):
    """Выдача Яндекс+Google, топ-10, регион ru (TRANSACTIONAL -> SEARCHED)."""
    qn = wscore.normalize(phrase)
    _save_params(ctx, task_id, {"phrase": qn, "engines": list(wscore.SERP_ENGINES),
                                "top": SERP_TOP, "region": SERP_REGION})
    counts = await _ensure_serp(ctx, qn)
    ctx.publish("node", wscore.set_status(ctx.con, qn, "SEARCHED"))
    return {"yandex": counts["yandex"], "google": counts["google"]}


# ---------- операции: LLM ----------

async def classify(ctx, task_id, phrase, params):
    """Разметка поддерева по интенту чанками по ~120 узлов (FULLY_LOADED -> интент).
    task.node — корень поддерева, чтобы строка в журнале была читаемой (tech §4)."""
    root = wscore.normalize(phrase)
    chunks = wscore.subtree_for_classify(ctx.con, root)
    nodes = [n for c in chunks for n in c]
    if not nodes:
        raise RuntimeError("нечего классифицировать: поддерево пусто")
    # в журнал кладём лёгкую сводку: сами nodes уходят в params джобов, а не в БД
    _save_params(ctx, task_id, {"root": root, "nodes": len(nodes), "jobs": len(chunks)})
    jobs = [_job(task_id, i, "classify", {"root": root, "nodes": c}) for i, c in enumerate(chunks)]
    answers = await _run_llm(ctx, "classify", root, jobs)

    marks = {}
    for res in answers:
        for it in _results(res):
            p = wscore.normalize(it.get("phrase") or "")
            if p:
                marks[p] = it
    counts, missing, skipped, sent = {}, 0, 0, 0
    for n in nodes:
        p = n["phrase"]
        it = marks.get(p)
        if it is None:
            missing += 1
            continue
        kind = wscore.normalize(it.get("kind") or "")
        if kind not in wscore.KIND_STATUS:
            ctx.log("WARN", "classify", p, f"неизвестный kind от LLM: {it.get('kind')!r}")
            missing += 1
            continue
        row = wscore.get_node(ctx.con, p)
        if row is None or row["status"] != "FULLY_LOADED":
            skipped += 1          # идемпотентность: уже размечен или ушёл дальше
            continue
        if (row["freq"] or 0) > HEAD_FREQ and kind != "category":
            ctx.log("INFO", "classify", p,
                    f"freq={row['freq']} > {HEAD_FREQ}: {kind} -> category (голова, интент размыт)")
            kind = "category"
        delta = wscore.set_status(ctx.con, p, wscore.KIND_STATUS[kind], kind=kind,
                                  classify_conf=_num(it.get("confidence"), 0, 1),
                                  classify_reason=_str(it.get("reason")))
        counts[kind] = counts.get(kind, 0) + 1
        if sent < MAX_NODE_DELTAS:   # тысячи дельт затопили бы канал (tech §6.2)
            ctx.publish("node", delta)
            sent += 1
    _publish_node(ctx, root)
    marked = sum(counts.values())
    ctx.log("INFO", "classify", root,
            f"размечено {marked} из {len(nodes)}: "
            + (", ".join(f"{k}={v}" for k, v in sorted(counts.items())) or "—")
            + f"; пропущено {skipped}, без разметки {missing}")
    # Ничего не разметили, хотя узлы ждали разметки — это отказ, а не успех: иначе
    # сломанный промпт выглядел бы как выполненная операция (design §0 «никаких немых падений»).
    # Случай «всё уже размечено ранее» (marked=0, missing=0, skipped>0) отказом НЕ считаем.
    if marked == 0 and missing:
        raise RuntimeError(f"не разметлен ни один узел из {len(nodes)} "
                           f"(без разметки {missing}): похоже, сломан промпт или схема ответа")
    return {"nodes": len(nodes), "jobs": len(jobs), "marked": marked,
            "skipped": skipped, "missing": missing, **counts}


async def score(ctx, task_id, phrase, params):
    """Оценка по выдаче батчами 8-15 фраз (SEARCHED -> SCORED|LOW_SCORED).
    params может нести список фраз (drill оценивает пачку одной операцией); task.node —
    первая фраза батча, полный список в params, чтобы UI показал «фраза +N»."""
    phrases = [wscore.normalize(p) for p in ((params or {}).get("phrases") or [phrase])]
    _save_params(ctx, task_id, {"phrases": phrases})
    items, skipped = [], 0
    for p in phrases:
        row = wscore.get_node(ctx.con, p)
        if row is None:
            continue
        if row["status"] != "SEARCHED":
            skipped += 1          # идемпотентность: уже оценён или ещё не искали
            continue
        serp = wscore.load_serp(ctx.con, p)
        if not all(e in serp for e in wscore.SERP_ENGINES):
            ctx.log("ERROR", "score", p, "нет сохранённой выдачи — оценивать нечего")
            continue
        items.append({"phrase": p, "freq": row["freq"] or 0,
                      "yandex": serp["yandex"]["docs"], "google": serp["google"]["docs"]})
    if not items:
        raise RuntimeError(f"нет фраз с выдачей для оценки (пропущено {skipped})")
    batches = list(_chunks(items, SCORE_BATCH))
    jobs = [_job(task_id, i, "score", {"items": b}) for i, b in enumerate(batches)]
    answers = await _run_llm(ctx, "score", items[0]["phrase"], jobs)

    wanted = {i["phrase"] for i in items}
    high = low = nulls = 0
    for res in answers:
        for it in _results(res):
            p = wscore.normalize(it.get("phrase") or "")
            if p not in wanted:
                ctx.log("WARN", "score", p or None, "LLM вернул фразу, которой не было во входе")
                continue
            cy = _num(it.get("competition_yandex"), 0, 100)
            cg = _num(it.get("competition_google"), 0, 100)
            weights = it.get("weights") if isinstance(it.get("weights"), dict) else None
            raw = {"competition_yandex": None if cy is None else int(cy),
                   "competition_google": None if cg is None else int(cg),
                   "score_weights": _dump(weights),
                   "description": _str(it.get("description")),
                   "signals_json": _dump(it.get("signals") if isinstance(it.get("signals"), list) else None)}
            sc = _num(it.get("score"), 0, 100)
            head = f"y={raw['competition_yandex']}, g={raw['competition_google']}, веса {weights}"
            if sc is None:
                # оценить нечего: узел остаётся SEARCHED, ошибка в лог (design §2)
                nulls += 1
                ctx.log("ERROR", "score", p, f"{head} -> score=null, оценить нечего, узел остаётся SEARCHED")
                ctx.publish("node", wscore.set_status(
                    ctx.con, p, None, error="score = null: оценить нечего", error_stage="score", **raw))
                continue
            status = "SCORED" if sc > wscore.SCORE_THRESHOLD else "LOW_SCORED"
            ctx.publish("node", wscore.set_status(ctx.con, p, status, score=sc, **raw))
            ctx.log("INFO", "score", p, f"{head} -> score={sc:g} -> {status}")
            high += status == "SCORED"
            low += status == "LOW_SCORED"
    # Ни одна фраза не обработана, хотя ждали оценки — отказ, а не успех (см. classify).
    if high + low + nulls == 0 and not skipped:
        raise RuntimeError(f"не оценена ни одна из {len(items)} фраз: "
                           "похоже, сломан промпт или схема ответа")
    return {"phrases": len(items), "jobs": len(jobs), "scored": high, "low_scored": low,
            "nulls": nulls, "skipped": skipped}


async def analyze(ctx, task_id, phrase, params):
    """Разбор ниши одним джобом (SCORED -> ANALYZED): HTML-отчёт на диск + строка report.
    Имя файла и report.id = id этой операции (tech §6 «Правила»)."""
    qn = wscore.normalize(phrase)
    row = wscore.get_node(ctx.con, qn)
    if row is None:
        raise RuntimeError("узел исчез из модели")
    serp = wscore.load_serp(ctx.con, qn)
    jparams = {"phrase": qn, "freq": row["freq"] or 0, "score": row["score"],
               "description": row["description"],
               "yandex": serp.get("yandex", {}).get("docs", []),
               "google": serp.get("google", {}).get("docs", [])}
    _save_params(ctx, task_id, {k: v for k, v in jparams.items() if k not in ("yandex", "google")})
    res = (await _run_llm(ctx, "analyze", qn, [_job(task_id, 0, "analyze", jparams)]))[0]
    if not isinstance(res, dict):
        raise ValueError("analyze вернул не объект")
    verdict = str(res.get("recommendation") or "").strip().upper()
    if verdict not in VERDICTS:
        raise ValueError(f"неизвестный recommendation: {res.get('recommendation')!r}")
    vscore = _num(res.get("verdict_score"), 0, 100)
    if vscore is None:
        raise ValueError("analyze не вернул verdict_score")
    html = res.get("report_html")
    if not isinstance(html, str) or len(html.strip()) < 100:
        raise ValueError("analyze не вернул report_html")

    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"{task_id}.html").write_text(html, encoding="utf-8")
    link = f"reports/{task_id}.html"
    wscore.save_report(ctx.con, task_id, qn, link)
    ctx.publish("node", wscore.set_status(ctx.con, qn, "ANALYZED",
                                          verdict=verdict, verdict_score=vscore))
    ctx.publish("report", wscore.report_row(ctx.con, task_id))
    ctx.log("INFO", "analyze", qn,
            f"вердикт {verdict}, verdict_score={vscore:g}, отчёт {link} ({len(html)} симв.)")
    return {"verdict": verdict, "verdict_score": vscore, "link": link}


# ---------- второй слой: сборка дерева потребностей и разбор работы ----------

async def needs_build(ctx, task_id, phrase, params):
    """Собрать дерево потребностей по загруженной ветке (FULLY_LOADED -> файл в needs-lab).

    Заменяет узловой `classify`: тот ходил пачками по узлам и ветку целиком не видел, а вся
    суть — в сравнении внутри ветки (узкая работа на 589 — шум сама по себе и заметная щель
    рядом с работой на 3 861). Поэтому единица здесь — ВЕТКА, одним джобом.

    Результат — файлом рядом с деревом, в `node` не пишем ничего: второй слой одноразовый."""
    root = wscore.normalize(phrase)
    payload = needs_layer.build_payload(ctx.con, root)
    if len(payload["nodes"]) < 2:
        raise RuntimeError(f"в ветке {root!r} нечего собирать: фраз {len(payload['nodes'])}")
    _save_params(ctx, task_id, {"root": root, "phrases": len(payload["nodes"]),
                                "subtree": payload["subtree_total"]})
    res = (await _run_llm(ctx, "needs", root, [_job(task_id, 0, "needs", payload)]))[0]
    problems = needs_layer.validate_tree(payload, res)
    if problems:
        raise ValueError("сборка не прошла проверку: " + "; ".join(problems[:3]))
    tree_id = f"{needs_layer.slug(root, 40)}-{task_id[:8]}"
    needs_layer.save_tree(tree_id, payload, res)
    counts = needs_layer.counts(res)
    ctx.log("INFO", "needs_build", root,
            f"дерево потребностей собрано: {tree_id} — работ {counts['works']}, "
            f"сегментов {counts['segments']}, щелей {counts['gaps']}, "
            f"исключено {counts['excluded']} из {len(payload['nodes'])} фраз")
    return {"tree_id": tree_id, **counts}


# ---------- разбор работы (второй слой) ----------

def _with_inputs(html, jp):
    """Дописать в отчёт свёрнутый блок «Входные данные».

    Печатает его СЕРВЕР, а не модель: иначе отчёт может разойтись с тем, что реально пришло
    на вход, и проверить вывод будет нечем. Здесь же честно перечислено, чего НЕ было."""
    c = jp.get("context") or {}
    se, ad = c.get("season"), c.get("adjacent")
    w = jp.get("work") or {}
    ph = jp.get("phrases") or []
    rows = "".join(f"<tr><td>{x['phrase']}</td><td style='text-align:right'>{x['freq']}</td></tr>"
                   for x in ph[:20])
    more = f"<p>…и ещё {len(ph) - 20} формулировок.</p>" if len(ph) > 20 else ""
    serp = "<br>".join(
        f"«{k}» — " + ", ".join(f"{e}: {len(v)} док." for e, v in s.items())
        for k, s in (jp.get("serps") or {}).items()) or "<b>не покупалась</b>"
    if se:
        st = se.get("stats") or {}
        season = (f"{'есть' if se.get('seasonal') else 'нет'} · размах ×{st.get('amplitude')} · "
                  f"пик {', '.join(st.get('peak_months') or []) or '—'} · "
                  f"дно {', '.join(st.get('trough_months') or []) or '—'} · "
                  f"сейчас «{se.get('phase') or '—'}» · год к году ×{st.get('yoy')} · "
                  f"{st.get('points')} мес. по фразе «{se.get('phrase')}»")
    else:
        season = ("<b>не считалась</b> — спрос взят как есть, без поправки на месяц замера")
    if ad:
        keys = ", ".join(f"{k} ({v})" for k, v in
                         sorted((ad.get("keys") or {}).items(), key=lambda kv: -(kv[1] or 0))[:12])
        adj = (f"{len(ad.get('keys') or {})} корней, суммарно {ad.get('total_freq')} против "
               f"{ad.get('ours')} в нашей ветке, покрытие по оценке модели "
               f"{ad.get('covered', '—')}%<br>{keys}")
    else:
        adj = ("<b>не собирались</b> — измерен спрос только со словом-технологией, "
               "настоящий размер ниши может быть кратно больше")
    prev = ", ".join(f"{x.get('verdict')} {x.get('verdict_score')}"
                     for x in (c.get("previous_verdicts") or [])) or "нет, это первый"
    block = f"""
<details style="margin-top:32px;border-top:1px solid #e3e6ea;padding-top:12px">
<summary style="cursor:pointer;font-weight:600">Входные данные</summary>
<div style="font-size:14px">
<p>Что было у модели в момент разбора — на этом и только на этом стоят выводы выше.</p>
<p><b>Работа:</b> {w.get('name')} · формулировок {len(ph)} ·
условие ветки: {jp.get('condition') or '—'} · ветка: {jp.get('root') or '—'}</p>
<p><b>Гипотезы сборки:</b> оценка {w.get('score')} ·
щель: {'да' if w.get('gap_candidate') else 'нет'} ·
занято: {w.get('occupied_by') or 'не названо'}</p>
<p><b>Выдача:</b><br>{serp}</p>
<p><b>Сезонность:</b> {season}</p>
<p><b>Смежные ключи:</b> {adj}</p>
<p><b>Прошлые разборы этой работы:</b> {prev}</p>
<h2>Ядро ключей</h2>
<table style="border-collapse:collapse;width:100%">
<tr><th style="text-align:left">формулировка</th><th style="text-align:right">частота</th></tr>
{rows}</table>{more}
</div></details>
"""
    return html.replace("</body>", block + "</body>") if "</body>" in html else html + block


async def needs_analyze(ctx, task_id, phrase, params):
    """`Analyze` на работе дерева потребностей: выдача -> Opus -> отчёт по нише.

    Единица разбора — **работа**, а не фраза: одну нишу выражают десятки формулировок, и
    отчёт по каждой из них был бы одним и тем же текстом. Выдачу покупаем по самым частотным
    фразам работы (`NEEDS_SERP_TOP`) — они её и представляют; остальные формулировки уходят в
    промпт списком с частотами, как ядро ключей ниши.

    Результат живёт файлами рядом с деревом, в `node` ничего не пишем: второй слой —
    толкование, его пересобирают, а модель первого слоя от этого не должна зависеть."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    work_name = str((params or {}).get("work") or "").strip()
    if not tree_id or not work_name:
        raise RuntimeError("нужны tree_id и work")
    return await _needs_analyze(ctx, task_id, tree_id, work_name)


async def _needs_analyze(ctx, task_id, tree_id, work_name):
    data = needs_layer.work_input(tree_id, work_name, NEEDS_SERP_TOP)
    if not data["phrases"]:
        raise RuntimeError(f"в работе {work_name!r} нет фраз")

    _save_params(ctx, task_id, {"tree_id": tree_id, "work": work_name,
                                "phrases": len(data["phrases"]), "search": data["search"]})
    serps = {}
    for qn in data["search"]:
        await _ensure_serp(ctx, qn, stage="needs_analyze")
        s = wscore.load_serp(ctx.con, qn)
        serps[qn] = {e: s.get(e, {}).get("docs", []) for e in wscore.SERP_ENGINES}

    # накопленное по работе: разбор идёт по ВСЕМ данным, что появились к этому моменту —
    # в этом и смысл повторного запуска
    prev = needs_layer.work_artifacts(tree_id).get(needs_layer._norm(work_name), [])
    season = next((a for a in prev if a.get("kind") == "season"), None)
    adjacent = next((a for a in prev if a.get("kind") == "adjacent"), None)
    context = {
        "season": {k: season.get(k) for k in ("stats", "seasonal", "phase", "comment", "phrase")}
        if season else None,
        "adjacent": {k: adjacent.get(k) for k in
                     ("keys", "total_freq", "ours", "covered", "comment")} if adjacent else None,
        "previous_verdicts": [{"verdict": a.get("verdict"), "verdict_score": a.get("verdict_score"),
                               "created_at": a.get("created_at")}
                              for a in prev if a.get("kind") == "analyze"],
    }
    jparams = {**{k: data[k] for k in ("condition", "root", "work", "segments", "phrases")},
               "serps": serps, "context": context}
    res = (await _run_llm(ctx, "analyze_work", work_name,
                          [_job(task_id, 0, "analyze_work", jparams)]))[0]
    if not isinstance(res, dict):
        raise ValueError("analyze_work вернул не объект")
    verdict = str(res.get("recommendation") or "").strip().upper()
    if verdict not in VERDICTS:
        raise ValueError(f"неизвестный recommendation: {res.get('recommendation')!r}")
    vscore = _num(res.get("verdict_score"), 0, 100)
    if vscore is None:
        raise ValueError("analyze_work не вернул verdict_score")
    html = res.get("report_html")
    if not isinstance(html, str) or len(html.strip()) < 100:
        raise ValueError("analyze_work не вернул report_html")

    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"{task_id}.html").write_text(_with_inputs(html, jparams), encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_artifact(tree_id, work_name, "analyze", {
        "verdict": verdict, "verdict_score": vscore,
        "confidence": _num(res.get("confidence"), 0, 1),
        "report_link": link, "task_id": task_id, "created_at": _now(),
        "searched": data["search"], "phrases": len(data["phrases"])})
    ctx.log("INFO", "needs_analyze", work_name,
            f"вердикт {verdict}, verdict_score={vscore:g}, отчёт {link} ({len(html)} симв.), "
            f"выдача по {len(data['search'])} фраз(ам)")
    return {"verdict": verdict, "verdict_score": vscore, "link": link,
            "tree_id": tree_id, "work": work_name}


# ---------- сезонность и смежные ключи ----------

def _work_ctx(tree_id, work_name):
    """Работа и её данные из второго слоя (общее начало у season/adjacent)."""
    if not tree_id or not work_name:
        raise RuntimeError("нужны tree_id и work")
    data = needs_layer.work_input(tree_id, work_name, NEEDS_SERP_TOP)
    if not data["phrases"]:
        raise RuntimeError(f"в работе {work_name!r} нет фраз")
    return data


def _chart(series, cap=560, h=120):
    """Столбики истории прямо в отчёте: SVG строим сами, у LLM просим только смысл."""
    if not series:
        return ""
    mx = max(v["y"] for v in series) or 1
    w = max(6, cap // max(1, len(series)) - 4)
    bars, labels = [], []
    for i, v in enumerate(series):
        bh = max(1, round(v["y"] / mx * (h - 18)))
        x = i * (w + 4)
        bars.append(f'<rect x="{x}" y="{h - bh}" width="{w}" height="{bh}" fill="#5b9bff">'
                    f'<title>{v["ym"]}: {v["y"]}</title></rect>')
        if v["ym"].endswith(("-01", "-09")):
            labels.append(f'<text x="{x}" y="{h + 12}" font-size="9" fill="#888">{v["ym"]}</text>')
    return (f'<svg viewBox="0 0 {len(series) * (w + 4)} {h + 16}" width="100%" height="160">'
            + "".join(bars) + "".join(labels) + "</svg>")


def _mini_report(title, subtitle, body):
    return (f"<!doctype html><html lang=ru><head><meta charset=utf-8><title>{title}</title>"
            "<style>body{font:15px/1.5 system-ui;max-width:820px;margin:40px auto;padding:0 16px}"
            "h1{font-size:22px;margin:0 0 4px}.sub{color:#888;margin:0 0 24px}"
            "table{border-collapse:collapse;width:100%;font-size:14px}"
            "td,th{border-bottom:1px solid #e3e6ea;padding:5px 8px;text-align:left}"
            ".num{text-align:right}blockquote{background:#f6f8fa;border:0;margin:18px 0;"
            "padding:14px 16px;border-radius:8px}</style></head><body>"
            f"<h1>{title}</h1><p class=sub>{subtitle}</p>{body}</body></html>")


async def needs_season(ctx, task_id, phrase, params):
    """Сезонность работы: история частоты по ОДНОЙ её самой частотной фразе.

    По одной намеренно: формулировки одной работы колеблются вместе, и профиль у них общий —
    платить за двадцать копий незачем. Один платный запрос на работу."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    work_name = str((params or {}).get("work") or "").strip()
    data = _work_ctx(tree_id, work_name)
    top = data["phrases"][0]["phrase"]
    _save_params(ctx, task_id, {"tree_id": tree_id, "work": work_name, "phrase": top})

    loop = asyncio.get_running_loop()
    async with ctx.net:
        series = await loop.run_in_executor(None, wscore.fetch_history, top,
                                            wscore.HISTORY_MONTHS, ctx.db)
    stats = wscore.season_stats(series)
    ctx.log("INFO", "needs_season", work_name,
            f"история по {top!r}: точек {stats.get('points')}, размах x{stats.get('amplitude')}, "
            f"пики {stats.get('peak_months')}, год к году x{stats.get('yoy')}")

    res = (await _run_llm(ctx, "season", work_name, [_job(task_id, 0, "season", {
        "work": work_name, "phrase": top, "series": series, "stats": stats})]))[0]
    if not isinstance(res, dict) or not (res.get("comment") or "").strip():
        raise ValueError("season не вернул comment")

    rows = "".join(f"<tr><td>{v['ym']}</td><td class=num>{v['y']}</td></tr>" for v in series)
    body = (f"<blockquote>{res['comment']}</blockquote>"
            f"<p><b>Сезонность:</b> {'есть' if res.get('seasonal') else 'нет'} · "
            f"размах ×{res.get('amplitude_x') or stats.get('amplitude')} · "
            f"сейчас {res.get('phase') or '—'} · пик {res.get('peak') or '—'} · "
            f"дно {res.get('trough') or '—'} · тренд {res.get('trend') or '—'}</p>"
            + _chart(series) +
            f"<h2>Ряд</h2><table><tr><th>месяц</th><th class=num>показов</th></tr>{rows}</table>")
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"{task_id}.html").write_text(
        _mini_report(f"Сезонность: {work_name}", f"по фразе «{top}», {len(series)} месяцев", body),
        encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_artifact(tree_id, work_name, "season", {
        "task_id": task_id, "created_at": _now(), "report_link": link, "phrase": top,
        "series": series, "stats": stats,
        "summary": f"{'сезонность есть' if res.get('seasonal') else 'сезонности нет'}, "
                   f"размах ×{res.get('amplitude_x') or stats.get('amplitude')}, "
                   f"сейчас {res.get('phase') or '—'}",
        "seasonal": bool(res.get("seasonal")), "phase": res.get("phase"),
        "comment": _str(res.get("comment"))})
    ctx.log("INFO", "needs_season", work_name, f"отчёт {link}")
    return {"seasonal": bool(res.get("seasonal")), "amplitude": stats.get("amplitude"),
            "link": link}


async def needs_adjacent(ctx, task_id, phrase, params):
    """Смежные ключи работы: как ту же работу ищут БЕЗ слова-технологии.

    Дерево выросло из одной ветки, поэтому мерит спрос только среди тех, кто уже думает про
    технологию. Берём пул каждого предложенного корня — он сразу даёт его уточнения с
    частотами, поэтому 6-8 запросов покрывают нишу, а не дают 8 чисел. Второй заход —
    добор корня, который всплыл в пулах: он и страхует от «просрали нишу»."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    work_name = str((params or {}).get("work") or "").strip()
    data = _work_ctx(tree_id, work_name)
    base = {"work": work_name, "why": data["work"].get("why"), "phrases": data["phrases"][:25]}
    _save_params(ctx, task_id, {"tree_id": tree_id, "work": work_name})

    first = (await _run_llm(ctx, "adjacent", work_name,
                            [_job(task_id, 0, "adjacent", {**base, "measured": {}})]))[0]
    keys = [wscore.normalize(k) for k in (first or {}).get("keys") or []][:ADJACENT_FIRST]
    if not keys:
        raise ValueError("adjacent не предложил ни одного корня")

    measured = {}

    async def measure(batch):
        for k in batch:
            if k in measured:
                continue
            qn, own, refs, _ts = await _fetch_pool(ctx, k)
            measured[qn] = {"freq": own or 0,
                            "top": [{"phrase": p, "freq": f} for p, f in refs[:12]],
                            "refinements": len(refs)}
            # пул куплен в общий кэш, но деревом запросов не является: без пометки
            # пересборка модели из кэша втянула бы его уточнения в факты
            wscore.mark_probe(ctx.con, [qn], "adjacent")

    await measure(keys)
    ctx.log("INFO", "needs_adjacent", work_name,
            f"первый заход: {len(measured)} корней, сумма частот "
            f"{sum(m['freq'] for m in measured.values())}")

    second = (await _run_llm(ctx, "adjacent", work_name,
                             [_job(task_id, 1, "adjacent", {**base, "measured": measured})]))[0]
    more = [wscore.normalize(k) for k in (second or {}).get("more_keys") or []][:ADJACENT_MORE]
    if more:
        await measure(more)
        ctx.log("INFO", "needs_adjacent", work_name, f"добор: +{len(more)} корней")
        second = (await _run_llm(ctx, "adjacent", work_name,
                                 [_job(task_id, 2, "adjacent", {**base, "measured": measured})]))[0]

    ours = max((p["freq"] or 0) for p in data["phrases"])
    total = sum(m["freq"] for m in measured.values())
    rows = "".join(
        f"<tr><td>{k}</td><td class=num>{m['freq']}</td><td class=num>{m['refinements']}</td></tr>"
        for k, m in sorted(measured.items(), key=lambda kv: -kv[1]["freq"]))
    body = (f"<blockquote>{(second or {}).get('comment') or ''}</blockquote>"
            f"<p><b>Наша ветка:</b> {ours} (самая частотная формулировка со словом-технологией)."
            f" <b>Смежные корни:</b> {total} суммарно — "
            f"×{round(total / ours, 1) if ours else '—'} от измеренного."
            f" Покрытие по оценке модели: {(second or {}).get('covered', '—')}%.</p>"
            f"<h2>Корни</h2><table><tr><th>фраза</th><th class=num>частота</th>"
            f"<th class=num>уточнений</th></tr>{rows}</table>")
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"{task_id}.html").write_text(
        _mini_report(f"Смежные ключи: {work_name}",
                     f"{len(measured)} корней без слова-технологии", body), encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_artifact(tree_id, work_name, "adjacent", {
        "task_id": task_id, "created_at": _now(), "report_link": link,
        "keys": {k: m["freq"] for k, m in measured.items()}, "total_freq": total,
        "ours": ours, "covered": (second or {}).get("covered"),
        "summary": f"{len(measured)} корней, суммарно {total} — "
                   f"×{round(total / ours, 1) if ours else '—'} от нашей ветки",
        "comment": _str((second or {}).get("comment"))})
    ctx.log("INFO", "needs_adjacent", work_name,
            f"корней {len(measured)}, суммарно {total} против {ours} у нас, отчёт {link}")
    return {"keys": len(measured), "total_freq": total, "ours": ours, "link": link}


# ---------- drill ----------

def _subtree_with(ctx, root, statuses):
    """Узлы поддерева в указанных статусах, по убыванию частоты."""
    phrases = wscore.subtree_phrases(ctx.con, root)
    found = []
    for chunk in _chunks(phrases, 400):
        qs = ",".join("?" * len(chunk))
        ss = ",".join("?" * len(statuses))
        found += ctx.con.execute(
            f"SELECT phrase, COALESCE(freq, 0) FROM node "
            f"WHERE phrase IN ({qs}) AND status IN ({ss})", (*chunk, *statuses)).fetchall()
    found.sort(key=lambda r: -r[1])
    return [r[0] for r in found]


async def drill(ctx, task_id, phrase, params):
    """Оркестратор (tech §4): full_load -> classify -> по каждому TRANSACTIONAL
    search -> score -> по каждому SCORED analyze. Отдельной ручки-порога нет: планку
    задаёт порог score. Каждый шаг изолирован (падение -> лог, идём дальше),
    идемпотентен (узлы в целевом статусе пропускаются) и заводит свою строку task;
    блокировку на корне drill держит до конца."""
    root = wscore.normalize(phrase)
    width = asyncio.Semaphore(DRILL_WIDTH)   # ОТДЕЛЬНЫЙ семафор фан-аута, не очередь задач
    prog = {"done": 0, "total": 0}
    stats = {"search": 0, "score": 0, "analyze": 0, "failed": 0}

    def bump(total=0, done=0):
        prog["total"] += total
        prog["done"] += done
        ctx.publish("progress", {"stage": "drill", "node": root, **prog})

    async def step(op, node, sparams=None, lock=None):
        try:
            ok = await run_step(ctx, op, node, sparams, lock)
        except Exception as e:   # сам шаг ошибку уже залогировал; тут — страховка
            ctx.log("ERROR", "drill", node, f"шаг {op} упал: {type(e).__name__}: {e}")
            ok = False
        if not ok:
            stats["failed"] += 1
        bump(done=1)
        return ok

    # 1. загрузка поддерева
    if _subtree_with(ctx, root, ("NEW", "LOADED")):
        bump(total=1)
        await step("full_load", root)
    else:
        ctx.log("INFO", "drill", root, "поддерево уже загружено — full_load пропущен")

    # 2. разметка по интенту
    if _subtree_with(ctx, root, ("FULLY_LOADED",)):
        bump(total=1)
        await step("classify", root)
    else:
        ctx.log("INFO", "drill", root, "нечего классифицировать — classify пропущен")

    # 3. выдача по всем transactional-узлам поддерева
    cands = _subtree_with(ctx, root, ("TRANSACTIONAL",))
    ctx.log("INFO", "drill", root, f"кандидатов на search: {len(cands)}")
    if cands:
        bump(total=len(cands))

        async def one_search(p):
            async with width:
                if await step("search", p):
                    stats["search"] += 1

        await asyncio.gather(*(one_search(p) for p in cands))

    # 4. оценка: одна операция на всю пачку (батчи 8-15 фраз внутри)
    ready = _subtree_with(ctx, root, ("SEARCHED",))
    ctx.log("INFO", "drill", root, f"кандидатов на score: {len(ready)}")
    if ready:
        bump(total=1)
        if await step("score", ready[0], {"phrases": ready}, lock=ready):
            stats["score"] = len(ready) - len(_subtree_with(ctx, root, ("SEARCHED",)))

    # 5. разбор всех перспективных
    good = _subtree_with(ctx, root, ("SCORED",))
    ctx.log("INFO", "drill", root, f"кандидатов на analyze: {len(good)}")
    if good:
        bump(total=len(good))

        async def one_analyze(p):
            async with width:
                if await step("analyze", p):
                    stats["analyze"] += 1

        await asyncio.gather(*(one_analyze(p) for p in good))

    left = _subtree_with(ctx, root, ("NEW", "LOADED", "FULLY_LOADED", "TRANSACTIONAL",
                                     "SEARCHED", "SCORED"))
    _publish_node(ctx, root)
    ctx.log("INFO", "drill", root,
            f"итог: search {stats['search']}, score {stats['score']}, analyze {stats['analyze']}, "
            f"неудачных шагов {stats['failed']}, нетерминальных узлов осталось {len(left)}")
    return {**stats, "non_terminal_left": len(left)}


OPS = {"load": load, "full_load": full_load, "search": search,
       "needs_build": needs_build, "needs_analyze": needs_analyze,
       "needs_season": needs_season, "needs_adjacent": needs_adjacent,
       "classify": classify, "score": score, "analyze": analyze, "drill": drill}


# ---------- тестовая постановка джоба (testing-plan §1.1) ----------

def enqueue_bare_job(ctx, op, params):
    """Положить один LLM-джоб с готовыми params — без краула и без записи в модель.
    Нужно, чтобы обмен джобами проверялся фальшивым воркером. -> (task_id, job_id)."""
    if op not in LLM_TYPES:
        raise ValueError(f"неизвестный тип джоба: {op}")
    task_id = create_task(ctx, op, None, {"test": True})
    ctx.con.execute("UPDATE task SET status = 'RUNNING', started_at = ? WHERE id = ?", (_now(), task_id))
    ctx.con.commit()
    _task_event(ctx, task_id)
    job = _job(task_id, 0, op, params)

    async def wait():
        try:
            res = await _run_llm(ctx, op, None, [job])
            keys = sorted(res[0].keys()) if isinstance(res[0], dict) else None
            _finish(ctx, task_id, "DONE", result={"test": True, "keys": keys})
            ctx.log("INFO", op, None, f"тестовый джоб {job['job_id']}: результат принят")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            _finish(ctx, task_id, "FAILED", error=f"{type(e).__name__}: {e}")
            ctx.log("ERROR", op, None, f"тестовый джоб {job['job_id']}: {e}")

    ctx.spawn(wait())
    return task_id, job["job_id"]
