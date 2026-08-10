#!/usr/bin/env python3
"""
Операции конвейера (tech-design §4): загрузка дерева запросов (load, full_load), разбор слов
на исключения (stopwords_scan) и второй слой (needs_build, needs_analyze, needs_season,
needs_adjacent).

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
import collections
import json
import os
import re
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx

import needs_layer
import wscore

ROOT = wscore.ROOT
REPORTS = ROOT / "reports"
PROMPTS = ROOT / "task-worker-mcp" / "prompts"

LLM_TYPES = ("needs", "needs_refine", "needs_rank", "products", "analyze_work",
             "analyze_adv", "analyze_product", "model_test",
             "season", "adjacent", "stopwords")
MAX_NODE_DELTAS = 300       # больше node-дельт за одну операцию не шлём: только progress
PROGRESS_EVERY = 0.5        # progress краула — не чаще, чем раз в N секунд
LOG_EVERY = 50              # строка в лог на каждые N фетчей краула
SERP_TOP = 10               # топ-10 выдачи (design §6.2)
SERP_REGION = "ru"
YANDEX_LR = 225             # Россия (Яндекс)
GOOGLE_LOC = 2643           # Россия (geo target Google)
NEEDS_SERP_TOP = 1          # по скольким самым частотным фразам работы покупаем выдачу
ADJACENT_FIRST = 8          # смежных корней в первом заходе
ADJACENT_MORE = 4           # добор во втором заходе, если всплыл пропущенный корень
VERDICTS = ("BUILD", "MAYBE", "SKIP")
DUMP_ANGLES = 5             # запросов на выгрузку: топы по близким фразам пересекаются на 70-80%
DUMP_MAX_PAGES = 40         # страниц за одну выгрузку
DUMP_THIN = 1500            # текста меньше — считаем, что страницу рисует скрипт, и рендерим
DUMP_WORKERS = 8
REPORT_TEXT_CAP = 60_000    # столько текста чужого отчёта отдаём следующему разбору
FORECAST_MONTHS = (1, 2, 3, 6)   # разгон, закрепление, тренд и полугодовой итог
MODEL_TEST_SECONDS = 60           # smoke-test обязан удерживать реального исполнителя минуту

# Ожидание LLM: (база на операцию, добавка на каждую следующую часть), секунды.
# Масштабируется от числа частей, чтобы крупная операция не падала при нормальной работе
# (tech §3): минуты на толкование готовых чисел, десятки минут на сборку и разбор.
LLM_TIMEOUT = {"needs": (2400, 0), "needs_refine": (2400, 0), "needs_rank": (2400, 0),
               "products": (2400, 0),
               "analyze_work": (2400, 0), "analyze_adv": (2400, 0),
               "analyze_product": (2400, 0), "model_test": (180, 0),
               "season": (600, 0), "adjacent": (900, 300), "stopwords": (900, 0)}

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
        "SELECT id, type, status, node, params, model_family, created_at, started_at, "
        "finished_at, error "
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
    family = (params or {}).get("model_family") if isinstance(params, dict) else None
    ctx.con.execute(
        "INSERT INTO task(id, type, status, node, params, model_family, created_at) "
        "VALUES (?, ?, 'QUEUED', ?, ?, ?, ?)",
        (task_id, op, node, _dump(params), family, _now()))
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
        manual = task_id in getattr(ctx, "cancelled", ())
        if manual:
            ctx.cancelled.discard(task_id)
        why = "отменена вручную" if manual else "операция прервана (остановка сервера)"
        _finish(ctx, task_id, "FAILED", error=why)
        ctx.log("INFO" if manual else "ERROR", op, node, why)
        raise
    except Exception as e:
        _finish(ctx, task_id, "FAILED", error=f"{type(e).__name__}: {e}")
        ctx.log("ERROR", op, node, f"ошибка: {e}")
        return False
    finally:
        ctx.release(nodes, task_id)
        # занятость снимаем здесь же: иначе новая операция легко забудет это сделать и
        # единица останется навсегда «занятой». Ключ — по группе у разборов и по работе у
        # операций, которые остались на потребностях (сезонность, смежные, выгрузка, тест)
        act = {"needs_analyze": "analyze", "needs_analyze_adv": "analyze_adv",
               "needs_analyze_product": "product", "needs_model_test": "test",
               "needs_season": "season",
               "needs_adjacent": "adjacent", "needs_dump": "dump"}.get(op)
        if act and isinstance(params, dict) and params.get("tree_id"):
            family = params.get("model_family") \
                if act in {"analyze", "analyze_adv", "product", "test"} \
                else "basic"
            unit = params.get("group") or needs_layer._norm(params.get("work"))
            ctx.needs_busy.discard((params["tree_id"], unit, act, family))
        tree_action = {"needs_refine": "refine", "needs_rank": "rank",
                       "needs_products": "products"}.get(op)
        if tree_action and isinstance(params, dict) and params.get("tree_id"):
            ctx.needs_busy.discard((params["tree_id"], "", tree_action, "shared"))


def _brief(result):
    if not isinstance(result, dict):
        return "—"
    return ", ".join(f"{k}={v}" for k, v in result.items() if not isinstance(v, (dict, list)))


# ---------- обмен с LLM ----------

def _prompt(op):
    """Текст prompts/{op}.md: сервер инлайнит его в поле prompt джоба (tech §7).

    Строка `{{include _файл.md}}` заменяется содержимым соседнего файла: правила классификации
    нужны и сборке, и второму проходу дословно, а два экземпляра одного текста расходятся."""
    if op not in _prompts:
        path = PROMPTS / f"{op}.md"
        if not path.exists():
            raise RuntimeError(f"нет файла промпта: {path}")
        _prompts[op] = _expand_includes(path)
    return _prompts[op]


def _expand_includes(path):
    out = []
    for line in path.read_text(encoding="utf-8").splitlines(keepends=True):
        name = re.fullmatch(r"\{\{include ([\w.\-]+)}}\s*", line)
        if not name:
            out.append(line)
            continue
        included = path.parent / name.group(1)
        if not included.exists():
            raise RuntimeError(f"{path.name}: нет включаемого файла {included}")
        out.append(included.read_text(encoding="utf-8"))
    return "".join(out)


def _job(task_id, n, op, params):
    """Часть операции = джоб; job_id = "{task_id}:{n}", n с нуля."""
    family = params.get("model_family") if isinstance(params, dict) else None
    return {"job_id": f"{task_id}:{n}", "task_id": task_id, "type": op,
            "model_family": family, "params": params, "prompt": _prompt(op)}


async def _run_llm(ctx, op, node, jobs):
    """Положить джобы в очередь LLM и дождаться ВСЕХ частей (tech §3).
    Любой отказ или таймаут -> исключение: задача FAILED, узел не тронут.

    Пока джоб не забрал исполнитель, задача стоит в `WAITING`, а не в `RUNNING`: сервер свою
    часть сделал, работы никто не делает. `RUNNING` вернётся, когда агент возьмёт данные —
    иначе «висит без исполнителя» неотличимо от честной работы."""
    base, extra = LLM_TIMEOUT[op]
    timeout = base + extra * (len(jobs) - 1)
    family = jobs[0].get("model_family") if jobs else None
    if not ctx.llm_online(family):
        owner = f" ({family})" if family else ""
        ctx.log("WARN", op, node,
                f"LLM-петля{owner} не на связи — "
                "задача, скорее всего, провалится по таймауту")
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


async def _ensure_serp(ctx, qn, stage="needs_analyze"):
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
    problems = needs_layer.validate_tree(payload, res, strict=True)
    if problems:
        raise ValueError("сборка не прошла проверку: " + "; ".join(problems[:3]))
    tree_id = f"{needs_layer.slug(root, 40)}-{task_id[:8]}"
    needs_layer.save_tree(tree_id, payload, res)
    counts = needs_layer.counts(res)
    ctx.log("INFO", "needs_build", root,
            f"дерево потребностей собрано: {tree_id} — работ {counts['works']}, "
            f"сегментов {counts['segments']}, "
            f"исключено {counts['excluded']} из {len(payload['nodes'])} фраз")
    return {"tree_id": tree_id, **counts}


async def needs_refine(ctx, task_id, phrase, params):
    """Второй проход: перепроверить готовую классификацию и заменить её целиком.

    Исходные фразы остаются источником истины. До успешной строгой валидации текущий файл не
    меняется; при принятии предыдущая ревизия сохраняется рядом.
    """
    tree_id = str((params or {}).get("tree_id") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id:
        raise RuntimeError("нужен tree_id")
    draft, _, _ = needs_layer.load_tree(tree_id)
    source = needs_layer.load_source(tree_id)
    revision = needs_layer.tree_revision(draft)
    _save_params(ctx, task_id, {"tree_id": tree_id, "model_family": family,
                                "revision": revision,
                                "phrases": len(source.get("nodes") or []),
                                "works": len(needs_layer.works(draft))})
    job_params = {"model_family": family, "source": source, "draft": draft}
    refined = (await _run_llm(
        ctx, "needs_refine", tree_id,
        [_job(task_id, 0, "needs_refine", job_params)],
    ))[0]
    problems = needs_layer.validate_tree(source, refined, strict=True)
    if problems:
        raise ValueError("второй проход не прошёл проверку: " + "; ".join(problems[:5]))
    meta = needs_layer.save_refined_tree(
        tree_id, refined, task_id, family, expected_revision=revision,
    )
    result_counts = needs_layer.counts(refined)
    ctx.log("INFO", "needs_refine", tree_id,
            f"классификация обновлена: ревизия {revision} -> {meta['revision']}, "
            f"работ {meta['before']['works']} -> {result_counts['works']}, "
            f"семейство {family}")
    return {"tree_id": tree_id, "revision": meta["revision"],
            "model_family": family, **result_counts}


async def needs_rank(ctx, task_id, phrase, params):
    """Глубоко оценить возможность отдельного продукта по уже принятой классификации.

    Выдача и конкуренты намеренно не участвуют. Модель размечает несколько проверяемых
    факторов, итог вычисляется по фиксированным весам и caps, а результат хранится отдельно
    от accepted.json и привязан к ревизии классификации.
    """
    tree_id = str((params or {}).get("tree_id") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id:
        raise RuntimeError("нужен tree_id")
    draft, _, _ = needs_layer.load_tree(tree_id)
    source = needs_layer.load_source(tree_id)
    revision = needs_layer.tree_revision(draft)
    classification = needs_layer.classification_only(draft)
    _save_params(ctx, task_id, {"tree_id": tree_id, "model_family": family,
                                "revision": revision,
                                "phrases": len(source.get("nodes") or []),
                                "works": len(needs_layer.works(classification))})
    result = (await _run_llm(
        ctx, "needs_rank", tree_id,
        [_job(task_id, 0, "needs_rank", {
            "model_family": family, "source": source, "classification": classification,
        })],
    ))[0]
    problems = needs_layer.validate_ranking(classification, result)
    if problems:
        raise ValueError("анализ возможности продукта не прошёл проверку: "
                         + "; ".join(problems[:5]))
    saved = needs_layer.save_ranking(
        tree_id, result, task_id, family, expected_revision=revision,
    )
    scores = [w["score"] for w in saved["works"]]
    ctx.log("INFO", "needs_rank", tree_id,
            f"продуктовый рейтинг готов: работ {len(scores)}, лучший шанс {max(scores)}, "
            f"семейство {family}")
    return {"tree_id": tree_id, "revision": revision, "model_family": family,
            "works": len(scores), "best_score": max(scores)}


async def needs_products(ctx, task_id, phrase, params):
    """`Продукты`: разложить работы ветки в дерево продуктов на трёх масштабах.

    Слой между потребностями и разборами. Пока его не было, каждый разбор считал общий движок
    заново и делил рынок ветки на свою долю. Выдача сюда не идёт намеренно — она покупается под
    разбор конкретного продукта, а вопрос здесь про устройство ветки."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id:
        raise RuntimeError("нужен tree_id")
    tree, _, _ = needs_layer.load_tree(tree_id)
    revision = needs_layer.tree_revision(tree)
    data = needs_layer.products_input(tree_id)
    if not data["works"]:
        raise RuntimeError(f"в дереве {tree_id!r} нет работ")
    _save_params(ctx, task_id, {"tree_id": tree_id, "model_family": family,
                                "root": data["root"], "revision": revision,
                                "works": len(data["works"])})
    jparams = {**data, "model_family": family}
    res = (await _run_llm(ctx, "products", tree_id,
                          [_job(task_id, 0, "products", jparams)]))[0]
    problems = needs_layer.validate_products(tree, res)
    if problems:
        raise ValueError("группировка не прошла проверку: " + "; ".join(problems[:5]))
    html = res.get("report_html")
    if not isinstance(html, str) or len(html.strip()) < 100:
        raise ValueError("products не вернул report_html")
    link = f"reports/{task_id}.html"
    saved = needs_layer.save_products(tree_id, {**res, "report_link": link}, task_id, family,
                                      expected_revision=revision)
    by_level = collections.Counter(g.get("level") for g in saved["groups"])
    levels = " · ".join(f"{lvl} {by_level.get(lvl, 0)}"
                        for lvl in needs_layer.PRODUCT_LEVELS)

    REPORTS.mkdir(parents=True, exist_ok=True)
    page = _report_page(f"Продукты: {data['root']}",
                        f"работ {len(data['works'])} → групп {len(saved['groups'])} · {levels}",
                        html)
    (REPORTS / f"{task_id}.html").write_text(_with_inputs(page, jparams), encoding="utf-8")
    ctx.log("INFO", "needs_products", data["root"],
            f"[{family}] дерево продуктов собрано: работ {len(data['works'])} → "
            f"групп {len(saved['groups'])} ({levels}), ревизия {revision}")
    return {"tree_id": tree_id, "revision": revision, "model_family": family,
            "groups": len(saved["groups"]), "link": link,
            **{lvl: by_level.get(lvl, 0) for lvl in needs_layer.PRODUCT_LEVELS}}


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
<p><b>Продуктовая гипотеза:</b> шанс {w.get('score') if w.get('score') is not None else 'не считался'} ·
интент: {w.get('intent') or 'не определён'} ·
форма продукта: {w.get('product') or 'не предложена'}</p>
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
    """`Analyze` на продукте дерева продуктов: выдача -> Opus -> отчёт по нише.

    Единица разбора — **группа**, а не работа и не фраза: строится продукт, а не потребность, и
    отчёт по каждой работе внутри одного продукта был бы одним и тем же текстом с разной долей
    рынка. Выдачу покупаем по самым частотным фразам группы (`NEEDS_SERP_TOP`); остальные
    формулировки уходят в промпт списком с частотами, как ядро ключей ниши.

    Результат живёт файлами рядом с деревом, в `node` ничего не пишем: второй слой —
    толкование, его пересобирают, а модель первого слоя от этого не должна зависеть."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    group_id = str((params or {}).get("group") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id or not group_id:
        raise RuntimeError("нужны tree_id и group")
    return await _needs_analyze(ctx, task_id, tree_id, group_id, family)


async def _analyze_input(ctx, task_id, tree_id, group_id, stage, family):
    """Общий вход всех трёх разборов: группа, её фразы, выдача и накопленное по ней.

    Выдача берётся из общего оплаченного кэша, поэтому второй разбор по уже разобранному
    продукту не стоит ни одного запроса. -> (data, jparams)."""
    data = needs_layer.group_input(tree_id, group_id, NEEDS_SERP_TOP)
    if not data["phrases"]:
        raise RuntimeError(f"в группе {group_id!r} нет фраз")

    _save_params(ctx, task_id, {"tree_id": tree_id, "group": group_id,
                                "model_family": family, "works": len(data["works"]),
                                "phrases": len(data["phrases"]), "search": data["search"]})
    serps = {}
    for qn in data["search"]:
        await _ensure_serp(ctx, qn, stage=stage)
        s = wscore.load_serp(ctx.con, qn)
        serps[qn] = {e: s.get(e, {}).get("docs", []) for e in wscore.SERP_ENGINES}

    # накопленное по продукту: разбор идёт по ВСЕМ данным, что появились к этому моменту —
    # в этом и смысл повторного запуска. Сезонность и смежные ключи снимаются по работам, а
    # сюда приходят собранными со всех работ группы
    prev = needs_layer.group_artifacts(tree_id).get(str(group_id), [])
    season, adjacent = data.get("season"), data.get("adjacent")
    context = {
        "season": {k: season.get(k) for k in ("stats", "seasonal", "phase", "comment", "phrase")}
        if season else None,
        "adjacent": {k: adjacent.get(k) for k in
                     ("keys", "total_freq", "ours", "covered", "comment")} if adjacent else None,
        # выгрузки топа: сами скачанные страницы лежат каталогами, и разбор их читает с диска —
        # в промпт они не влезают, а по сниппетам цену и пейволл проверить нельзя
        "dumps": data.get("dumps") or [],
        # чужое семейство не скрываем: разбор — это довод, а не собственность модели.
        # Автор указан, чтобы расхождение читалось как расхождение, а не как своя же ошибка.
        "previous_verdicts": [{"verdict": a.get("verdict"), "verdict_score": a.get("verdict_score"),
                               "created_at": a.get("created_at"), "kind": a.get("kind"),
                               "by": needs_layer.artifact_family(a)}
                              for a in prev if a.get("kind") in ("analyze", "analyze_adv")],
    }
    jparams = {**{k: data[k] for k in ("condition", "root", "root_freq", "head",
                                       "group", "works", "phrases")},
               "model_family": family, "serps": serps, "context": context}
    return data, jparams


def _verdict_of(res, op):
    """Общая проверка ответа разбора: вердикт, оценка, непустой отчёт."""
    if not isinstance(res, dict):
        raise ValueError(f"{op} вернул не объект")
    verdict = str(res.get("recommendation") or "").strip().upper()
    if verdict not in VERDICTS:
        raise ValueError(f"неизвестный recommendation: {res.get('recommendation')!r}")
    vscore = _num(res.get("verdict_score"), 0, 100)
    if vscore is None:
        raise ValueError(f"{op} не вернул verdict_score")
    html = res.get("report_html")
    if not isinstance(html, str) or len(html.strip()) < 100:
        raise ValueError(f"{op} не вернул report_html")
    return verdict, vscore, html


def _report_text(artifact, cap=REPORT_TEXT_CAP):
    """Текст чужого отчёта для следующего разбора: он читает выводы предшественника целиком,
    а не только его оценку."""
    link = (artifact or {}).get("report_link") or ""
    if not link:
        return None
    f = REPORTS / Path(link).name
    try:
        return _clean_text(f.read_text(encoding="utf-8"))[:cap]
    except OSError:
        return None


def _forecast_of(res):
    """Прогноз продаж: месяцы 1/2/3/6, допущения с источниками, потолок, бюджет, окупаемость.

    Без него спецификация не отвечает, за что мы боремся и сколько ресурсов сюда можно вложить,
    поэтому прогноз обязателен. Таблица из нулей — тоже отказ: «продукт не взлетает» пишется
    вердиктом `SKIP`, а не пустыми числами, по которым не видно, считал ли кто-нибудь вообще."""
    f = res.get("forecast")
    if not isinstance(f, dict):
        raise ValueError("analyze_product не вернул forecast: прогноз обязателен")
    rows = {}
    for m in f.get("months") or []:
        n = _num(m.get("month"), 1, 60) if isinstance(m, dict) else None
        if n is None:
            continue
        rows[int(n)] = {"month": int(n),
                        **{k: _num(m.get(k), 0, 10 ** 9) or 0
                           for k in ("visits", "trials", "new_paying", "paying", "mrr",
                                     "revenue_cum")}}
    missing = [m for m in FORECAST_MONTHS if m not in rows]
    if missing:
        raise ValueError(f"в forecast нет месяцев: {', '.join(map(str, missing))}")
    months = [rows[m] for m in FORECAST_MONTHS]
    if not any(m["mrr"] or m["paying"] for m in months):
        raise ValueError("прогноз из одних нулей: это вердикт SKIP, а не таблица")
    assumptions = [{"name": _str(a.get("name")), "value": _str(a.get("value")),
                    "source": _str(a.get("source"))}
                   for a in (f.get("assumptions") or []) if isinstance(a, dict)]
    if not assumptions:
        raise ValueError("в forecast нет допущений: прогноз без источников не проверить")
    invest = (_str(f.get("invest_case")) or "").strip()
    if not invest:
        raise ValueError("в forecast нет invest_case: отчёт должен отвечать, зачем вкладываться")
    num_or_none = lambda v: _num(v, 0, 10 ** 12)
    ceiling, budget = f.get("ceiling") or {}, f.get("budget") or {}
    return {"months": months, "assumptions": assumptions,
            "ceiling": {"paying": num_or_none(ceiling.get("paying")),
                        "mrr": num_or_none(ceiling.get("mrr")), "why": _str(ceiling.get("why"))},
            # shared/incremental: движок ветки пишется один раз, работа сверх него стоит
            # только контента. Без этого деления каждый отчёт по ветке считает движок заново
            "budget": {"hours": num_or_none(budget.get("hours")),
                       "money": num_or_none(budget.get("money")),
                       "monthly": num_or_none(budget.get("monthly")),
                       "shared": num_or_none(budget.get("shared")),
                       "incremental": num_or_none(budget.get("incremental")),
                       "why": _str(budget.get("why"))},
            "payback": _str(f.get("payback")), "scenario_low": _str(f.get("scenario_low")),
            "invest_case": invest}


async def needs_analyze_product(ctx, task_id, phrase, params):
    """`Спецификация`: продукт группы -> спека и прогноз продаж (design §4.6).

    Третий разбор отвечает на вопрос исполнителя: что открыть в понедельник, кому продать, по
    какой цене и почему заплатят. Решение принимается по трём источникам сразу — выдача плюс
    последние отчёты «Ниша» и «Функции» целиком текстом."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    group_id = str((params or {}).get("group") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id or not group_id:
        raise RuntimeError("нужны tree_id и group")
    data, jparams = await _analyze_input(ctx, task_id, tree_id, group_id,
                                         "needs_analyze_product", family)

    prev = needs_layer.group_artifacts(tree_id).get(str(group_id), [])
    # берём ПОСЛЕДНИЙ разбор каждого вида, чьё бы семейство он ни был: свежие данные важнее
    # авторства, а кто автор — сказано в поле `by`
    niche = next((a for a in prev if a.get("kind") == "analyze"), None)
    feats = next((a for a in prev if a.get("kind") == "analyze_adv"), None)
    if not (niche or feats):
        raise RuntimeError("нужен хотя бы один предыдущий разбор: «Ниша» или «Функции»")
    jparams["context"] = {
        **jparams["context"],
        "niche": {**{k: niche.get(k) for k in ("verdict", "verdict_score", "created_at")},
                  "by": needs_layer.artifact_family(niche),
                  "report": _report_text(niche)} if niche else None,
        "features": {**{k: feats.get(k) for k in ("verdict", "verdict_score", "created_at",
                                                  "functions")},
                     "by": needs_layer.artifact_family(feats),
                     "report": _report_text(feats)} if feats else None,
    }

    res = (await _run_llm(ctx, "analyze_product", group_id,
                          [_job(task_id, 0, "analyze_product", jparams)]))[0]
    verdict, vscore, html = _verdict_of(res, "analyze_product")
    spec = res.get("spec")
    if not isinstance(spec, dict):
        raise ValueError("analyze_product не вернул spec")
    keep = ("chosen_function", "chosen_why", "product", "user", "promise", "price", "free_part",
            "paid_part", "why_pay", "find", "find_freq", "also_covers", "channel",
            "first_paying", "scope_in", "scope_out", "weeks", "unit_cost", "kill_test")
    spec = {k: spec.get(k) for k in keep}
    # спецификация без продукта, цены и причины платить — это не спецификация
    missing = [k for k in ("product", "price", "why_pay") if not (_str(spec.get(k)) or "").strip()]
    if missing:
        raise ValueError(f"в spec не заполнено: {', '.join(missing)}")

    forecast = _forecast_of(res)

    scores = {"niche": niche.get("verdict_score") if niche else None,
              "features": feats.get("verdict_score") if feats else None,
              "product": vscore}
    trail = " → ".join(f"{k} {v:g}" for k, v in scores.items() if v is not None)
    REPORTS.mkdir(parents=True, exist_ok=True)
    title = data["group"].get("name") or group_id
    page = _report_page(f"Спецификация: {title}",
                        f"{spec['product']} · {spec['price']} · оценки: {trail}",
                        html, verdict, vscore)
    (REPORTS / f"{task_id}.html").write_text(_with_inputs(page, jparams), encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_group_artifact(tree_id, group_id, "analyze_product", {
        "model_family": family,
        "verdict": verdict, "verdict_score": vscore,
        "confidence": _num(res.get("confidence"), 0, 1), "why": _str(res.get("why")),
        "report_link": link, "task_id": task_id, "created_at": _now(),
        "searched": data["search"], "spec": spec, "scores": scores, "forecast": forecast,
        "summary": f"{spec['product']} · {spec['price']}"})
    ctx.log("INFO", "needs_analyze_product", title,
            f"[{family}] {verdict} {vscore:g} · «{spec['product']}» по цене {spec['price']} · "
            f"окупаемость: {forecast['payback']} · оценки {trail}")
    return {"verdict": verdict, "verdict_score": vscore, "product": spec["product"],
            "price": spec["price"], "scores": scores, "forecast": forecast, "link": link,
            "tree_id": tree_id, "group": group_id, "model_family": family}


async def needs_analyze_adv(ctx, task_id, phrase, params):
    """«Функции»: второй разбор того же продукта с другим вопросом (design §4.5).

    Обычный разбор спрашивает «можно ли перехватить поисковый трафик» и делит спрос на
    конкуренцию. Этот спрашивает «какую ОДНУ функцию тут можно сделать, найдут ли её из поиска
    и платит ли за неё кто-то уже сегодня» — занятость ниши в нём не знаменатель, а
    подтверждение спроса. Выдача берётся из кэша, поэтому по разобранной группе он бесплатен."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    group_id = str((params or {}).get("group") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id or not group_id:
        raise RuntimeError("нужны tree_id и group")
    data, jparams = await _analyze_input(ctx, task_id, tree_id, group_id,
                                         "needs_analyze_adv", family)

    res = (await _run_llm(ctx, "analyze_adv", group_id,
                          [_job(task_id, 0, "analyze_adv", jparams)]))[0]
    verdict, vscore, html = _verdict_of(res, "analyze_adv")
    funcs = res.get("functions")
    if not isinstance(funcs, list) or not funcs:
        raise ValueError("analyze_adv не вернул ни одной функции")
    keep = ("name", "io", "entry_query", "entry_freq", "paid_proof", "edge", "money", "cost",
            "channel", "parity", "effort_weeks", "score", "why", "kill_test")
    funcs = [{k: f.get(k) for k in keep} for f in funcs if isinstance(f, dict) and f.get("name")]
    if not funcs:
        raise ValueError("в functions нет ни одной записи с именем")
    funcs.sort(key=lambda f: -(_num(f.get("score"), 0, 100) or 0))
    # вердикт без модели денег и без себестоимости — не ответ: именно так разбор скатывается
    # в «отдадим бесплатно то, за что конкурент берёт деньги»
    missing = [k for k in ("money", "cost") if not (_str(funcs[0].get(k)) or "").strip()]
    if missing:
        raise ValueError(f"у лучшей функции не заполнено: {', '.join(missing)}")

    best, title = funcs[0], data["group"].get("name") or group_id
    REPORTS.mkdir(parents=True, exist_ok=True)
    page = _report_page(f"Функции: {title}",
                        f"функций {len(funcs)} · лучшая «{best.get('name')}» "
                        f"· уверенность {_num(res.get('confidence'), 0, 1)}",
                        html, verdict, vscore)
    (REPORTS / f"{task_id}.html").write_text(_with_inputs(page, jparams), encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_group_artifact(tree_id, group_id, "analyze_adv", {
        "model_family": family,
        "verdict": verdict, "verdict_score": vscore,
        "confidence": _num(res.get("confidence"), 0, 1),
        "report_link": link, "task_id": task_id, "created_at": _now(),
        "searched": data["search"], "functions": funcs,
        "summary": f"{len(funcs)} функц.: «{best.get('name')}» — {best.get('score')}"})
    ctx.log("INFO", "needs_analyze_adv", title,
            f"[{family}] функций {len(funcs)}, лучшая «{best.get('name')}» ({best.get('score')}), "
            f"вердикт {verdict} {vscore:g}, отчёт {link}")
    return {"verdict": verdict, "verdict_score": vscore, "functions": len(funcs),
            "best": best.get("name"), "link": link, "tree_id": tree_id, "group": group_id,
            "model_family": family}


async def _needs_analyze(ctx, task_id, tree_id, group_id, family):
    data, jparams = await _analyze_input(ctx, task_id, tree_id, group_id,
                                         "needs_analyze", family)
    res = (await _run_llm(ctx, "analyze_work", group_id,
                          [_job(task_id, 0, "analyze_work", jparams)]))[0]
    verdict, vscore, html = _verdict_of(res, "analyze_work")
    # без ответа про деньги отчёт по нише бесполезен: «монетизация слабая» — это оценка, а не
    # ответ на «что продаём, кому и почему купят у нас». Раньше поле было строкой в списке
    # «Реализация», и разбор проходил приёмку, вовсе про них не сказав
    money = {k: _str(res.get(k)) for k in ("money", "who_pays", "why_pay")}
    empty = [k for k, v in money.items() if not (v or "").strip()]
    if empty:
        raise ValueError(f"analyze_work не ответил про деньги: {', '.join(empty)}")

    title = data["group"].get("name") or group_id
    REPORTS.mkdir(parents=True, exist_ok=True)
    page = _report_page(f"Ниша: {title}",
                        f"уверенность {_num(res.get('confidence'), 0, 1)} · "
                        f"пул {data['group'].get('pool')} · "
                        f"{len(data['phrases'])} формулировок", html, verdict, vscore)
    (REPORTS / f"{task_id}.html").write_text(_with_inputs(page, jparams), encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_group_artifact(tree_id, group_id, "analyze", {
        "model_family": family,
        "verdict": verdict, "verdict_score": vscore,
        "confidence": _num(res.get("confidence"), 0, 1),
        "report_link": link, "task_id": task_id, "created_at": _now(),
        "searched": data["search"], "phrases": len(data["phrases"]),
        **money, "summary": money["money"]})
    ctx.log("INFO", "needs_analyze", title,
            f"[{family}] вердикт {verdict}, verdict_score={vscore:g}, отчёт {link} ({len(html)} симв.), "
            f"выдача по {len(data['search'])} фраз(ам)")
    return {"verdict": verdict, "verdict_score": vscore, "link": link,
            "tree_id": tree_id, "group": group_id, "model_family": family}


async def needs_model_test(ctx, task_id, phrase, params):
    """Минутный smoke-test семейного диспетчера с простым HTML-отчётом-пустышкой."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    work_name = str((params or {}).get("work") or "").strip()
    family = needs_layer.model_family((params or {}).get("model_family"), "claude")
    if not tree_id or not work_name:
        raise RuntimeError("нужны tree_id и work")
    # Повторно проверяем файловый вход уже внутри задачи: дерево могли удалить после POST.
    tree, _, _ = needs_layer.load_tree(tree_id)
    needs_layer.find_work(tree, work_name)
    minimum = max(0.0, float(MODEL_TEST_SECONDS))
    requested_model = "haiku" if family == "claude" else "gpt-5.6-luna"
    _save_params(ctx, task_id, {"tree_id": tree_id, "work": work_name,
                                "model_family": family,
                                "minimum_runtime_seconds": minimum,
                                "requested_model": requested_model})
    jparams = {"tree_id": tree_id, "work": work_name, "model_family": family,
               "minimum_runtime_seconds": minimum, "requested_model": requested_model}
    started = time.time()
    res = (await _run_llm(ctx, "model_test", work_name,
                          [_job(task_id, 0, "model_test", jparams)]))[0]
    if not isinstance(res, dict):
        raise ValueError("model_test вернул не объект")
    returned_family = str(res.get("model_family") or "").strip().lower()
    if returned_family != family:
        raise ValueError(f"model_test вернул семейство {returned_family!r}, ожидалось {family!r}")
    html = res.get("report_html")
    if not isinstance(html, str) or len(html.strip()) < 100:
        raise ValueError("model_test не вернул простой report_html")
    message = (_str(res.get("message"), 500) or "Тестовый отчёт сформирован").strip()
    duration = round(time.time() - started, 1)
    page = _report_page(f"Test {family}: {work_name}",
                        f"{requested_model} · {duration:.1f} c", html)
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"{task_id}.html").write_text(page, encoding="utf-8")
    link = f"reports/{task_id}.html"
    needs_layer.save_artifact(tree_id, work_name, "model_test", {
        "model_family": family, "report_link": link, "task_id": task_id,
        "created_at": _now(), "summary": f"{message} · {duration:.1f} c",
        "duration_seconds": duration, "requested_model": requested_model,
    })
    ctx.log("INFO", "needs_model_test", work_name,
            f"[{family}] минутный тест готов за {duration:.1f} c, отчёт {link}")
    return {"link": link, "tree_id": tree_id, "work": work_name,
            "model_family": family, "requested_model": requested_model,
            "duration_seconds": duration}


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


_CSS_CACHE = {}


def _report_css():
    """Стили отчёта — из `templates/report.html`, единственного места, где они описаны."""
    if "css" not in _CSS_CACHE:
        try:
            t = (PROMPTS.parent / "templates" / "report.html").read_text(encoding="utf-8")
            _CSS_CACHE["css"] = re.search(r"<style>(.*?)</style>", t, re.S).group(1)
        except (OSError, AttributeError):
            _CSS_CACHE["css"] = ("body{font:16px/1.6 system-ui;max-width:900px;margin:2rem auto;"
                                 "padding:0 1rem}table{border-collapse:collapse;width:100%}"
                                 "td,th{border-bottom:1px solid #8884;padding:.4em .6em}")
    return _CSS_CACHE["css"]


def _mini_report(title, subtitle, body, verdict=None, score=None):
    """Готовая страница отчёта: оболочка и стили НАШИ, от модели приходит только тело.

    Модель регулярно возвращает фрагмент без <html> и <style> — в браузере это нечитаемо.
    Полагаться на то, что она соберёт документ, нельзя: шаблон лежит в репозитории, а агент
    в репозиторий за файлами не ходит. Шапка с крупным вердиктом — из того же шаблона: по ней
    отчёт читается с первого экрана, не вчитываясь в текст."""
    hero = ""
    if verdict:
        hero = (f'<div class="hero"><span class="verdict {verdict}">{verdict}</span>'
                f'<span><span class="bigscore">{score:g}</span>'
                f'<span class="muted">/100</span></span>'
                f'<span class="muted">{subtitle}</span></div>')
    else:
        hero = f'<p class="muted sub">{subtitle}</p>'
    return (f"<!doctype html><html lang=ru><head><meta charset=utf-8>"
            f"<meta name=viewport content=\"width=device-width, initial-scale=1\">"
            f"<title>{title}</title><style>{_report_css()}</style></head><body>"
            f"<h1>{title}</h1>{hero}{body}</body></html>")


def _report_page(title, subtitle, html, verdict=None, score=None):
    """Ответ модели -> страница. Полный документ оставляем как есть, фрагмент заворачиваем."""
    return (html if "<html" in html[:2000].lower()
            else _mini_report(title, subtitle, html, verdict, score))


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


# ---------- выгрузка выдачи (полные страницы, без LLM) ----------

def _clean_text(html):
    h = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", html)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h)).strip()


def _http_page(url, timeout=15):
    """Обычная загрузка. -> (html, статус). Дёшево и покрывает большинство страниц."""
    import urllib.request
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "ru,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(2_000_000).decode("utf-8", "ignore"), r.status


def _render_page(url, timeout=25000):
    """Догрузка браузером — только для страниц, которые скрипт рисует на клиенте.

    Замерено на реальной выдаче: сырым HTTP читаются 17 ссылок из 18, и не читается ровно
    та, где живёт инструмент. Статьи отдаются как есть, SPA-инструменты — нет."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True)
        try:
            page = b.new_page(user_agent="Mozilla/5.0 (X11; Linux x86_64) Chrome/120")
            page.goto(url, wait_until="networkidle", timeout=timeout)
            return page.content(), 200
        finally:
            b.close()


def _fetch_page(url):
    """Страница целиком: сначала HTTP, при отказе или пустоте — браузер.
    -> {html, status, text_len, method}."""
    try:
        html, status = _http_page(url)
        if len(_clean_text(html)) >= DUMP_THIN:
            return {"html": html, "status": status, "text_len": len(_clean_text(html)),
                    "method": "http"}
        thin = html
    except Exception as e:
        thin, status = "", f"{type(e).__name__}"
    try:
        html, _ = _render_page(url)
        return {"html": html, "status": 200, "text_len": len(_clean_text(html)),
                "method": "render"}
    except Exception as e:
        return {"html": thin, "status": status if thin else f"{type(e).__name__}",
                "text_len": len(_clean_text(thin)), "method": "http" if thin else "failed"}


_MARKERS = (("как", ("как", "инструкц", "пошагов", "самом")),
            ("бесплатно", ("бесплатн", "без регистрац", "онлайн бесплатн")),
            ("деньги", ("цена", "стоимость", "купить", "сервис", "подписк", "тариф")))


def _dump_queries(ctx, tree_id, unit, data, by_group=False):
    """Углы выгрузки: не все формулировки, а разные ИНТЕНТЫ.

    Топ-10 по шести близким фразам пересекается на 70-80% — платить шесть раз за одни и те же
    домены незачем. Ценность даёт разный интент: головная фраза, фраза кандидата из Adv-разбора,
    «как это делают руками», «бесплатно», коммерческая."""
    picked, seen = [], set()

    def add(ph, why):
        ph = wscore.normalize(ph or "")
        if ph and ph not in seen:
            seen.add(ph)
            picked.append({"query": ph, "why": why})

    phrases = data["phrases"]
    add(phrases[0]["phrase"], "головная фраза продукта" if by_group else "головная фраза работы")

    prev = (needs_layer.group_artifacts(tree_id).get(str(unit), []) if by_group
            else needs_layer.work_artifacts(tree_id).get(needs_layer._norm(unit), []))
    adv = next((a for a in prev if a.get("kind") == "analyze_adv"), None)
    if adv and (adv.get("functions") or []):
        add((adv["functions"][0] or {}).get("entry_query"), "входная фраза кандидата (Adv)")

    # остальные углы ищем среди фраз ветки: они уже собраны краулом, искать в сети нечего
    _, tree_file, params_file = needs_layer.load_tree(tree_id)
    branch, _ = needs_layer._input(params_file)
    core = wscore.words_of(phrases[0]["phrase"])
    pool = sorted(((p, f or 0) for p, f in branch.items()), key=lambda x: -x[1])
    for label, marks in _MARKERS:
        for p, f in pool:
            if len(picked) >= DUMP_ANGLES:
                break
            if any(m in p for m in marks) and len(wscore.words_of(p) & core) >= 2:
                add(p, f"угол «{label}» ({f})")
                break
    for p in phrases[1:]:
        if len(picked) >= DUMP_ANGLES:
            break
        add(p["phrase"], "вторая по частоте формулировка")
    return picked[:DUMP_ANGLES]


def _dump_index(root, work_name, queries, saved):
    """index.html рядом с выгрузкой: по нему её открывают из интерфейса."""
    rows = "".join(
        f"<tr><td>{i['engine']}</td><td class=num>{i['rank']}</td>"
        f"<td><a href=\"{i['file']}\">{i['domain']}</a></td>"
        f"<td class=muted>{i['query']}</td><td class=num>{i['text_len']}</td>"
        f"<td class=muted>{i['method']} · {i['status']}</td></tr>" for i in saved)
    qs = "".join(f"<li><b>{q['query']}</b> — {q['why']}</li>" for q in queries)
    body = (f"<h2>Запросы ({len(queries)})</h2><ul>{qs}</ul>"
            f"<h2>Страницы ({len(saved)})</h2><table><tr><th>движок</th><th class=num>поз.</th>"
            f"<th>домен</th><th>запрос</th><th class=num>текста</th><th>как взято</th></tr>"
            f"{rows}</table>")
    (root / "index.html").write_text(
        _mini_report(f"Выгрузка выдачи: {work_name}",
                     f"{len(saved)} страниц по {len(queries)} запросам", body),
        encoding="utf-8")


async def needs_dump(ctx, task_id, phrase, params):
    """Полная выгрузка топ-10: страницы целиком, чтобы их читал человек или модель.

    Операция без LLM: выбрать углы, докупить выдачу, скачать страницы, разложить по папкам
    `reports/<единица>/<движок>/<запрос>/`. Скачивание бесплатно — платит только выдача.

    Единица — **группа**, если она передана: разборы идут по продукту, и проверять цены с
    пейволлами надо по его дверям, а не по одной работе из двадцати. По работе выгрузка тоже
    остаётся: она полезна сама по себе, когда группировки ещё нет."""
    tree_id = str((params or {}).get("tree_id") or "").strip()
    group_id = str((params or {}).get("group") or "").strip()
    work_name = str((params or {}).get("work") or "").strip()
    if not tree_id or not (group_id or work_name):
        raise RuntimeError("нужны tree_id и group или work")
    by_group = bool(group_id)
    unit = group_id or work_name
    data = (needs_layer.group_input(tree_id, group_id, NEEDS_SERP_TOP) if by_group
            else needs_layer.work_input(tree_id, work_name, NEEDS_SERP_TOP))
    if not data["phrases"]:
        raise RuntimeError(f"в {unit!r} нет фраз")
    label = (data["group"].get("name") or group_id) if by_group else work_name

    queries = _dump_queries(ctx, tree_id, unit, data, by_group=by_group)
    _save_params(ctx, task_id, {"tree_id": tree_id,
                                **({"group": group_id} if by_group else {"work": work_name}),
                                "queries": [q["query"] for q in queries]})
    ctx.log("INFO", "needs_dump", label,
            "углы: " + "; ".join(f"{q['query']} — {q['why']}" for q in queries))

    targets = {}
    for q in queries:
        # угол, по которому выдачу не достать (нет в кэше в режиме cache-only, отказ источника),
        # пропускаем: одна недоступная фраза не должна ронять всю выгрузку
        try:
            await _ensure_serp(ctx, q["query"], stage="needs_dump")
        except Exception as e:
            q["error"] = f"{type(e).__name__}: {e}"
            ctx.log("WARN", "needs_dump", label, f"угол «{q['query']}» пропущен: {e}")
            continue
        serp = wscore.load_serp(ctx.con, q["query"])
        for engine in wscore.SERP_ENGINES:
            for doc in serp.get(engine, {}).get("docs", []):
                url = doc.get("url")
                if url and url not in targets and len(targets) < DUMP_MAX_PAGES:
                    targets[url] = {"engine": engine, "rank": doc.get("rank"),
                                    "query": q["query"], "title": doc.get("title", "")}

    if not targets:
        raise RuntimeError("ни по одному углу не удалось получить выдачу")
    root = REPORTS / needs_layer.slug(unit)
    loop = asyncio.get_running_loop()
    got = await asyncio.gather(*[loop.run_in_executor(None, _fetch_page, u) for u in targets])

    saved = []
    for (url, meta), page in zip(targets.items(), got):
        dom = re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", url)
        d = root / meta["engine"] / needs_layer.slug(meta["query"])
        d.mkdir(parents=True, exist_ok=True)
        name = f"{meta['rank'] or 0:02d}-{needs_layer.slug(dom)}.html"
        (d / name).write_text(page["html"] or "", encoding="utf-8")
        saved.append({**meta, "url": url, "domain": dom, "status": page["status"],
                      "text_len": page["text_len"], "method": page["method"],
                      "file": f"{meta['engine']}/{needs_layer.slug(meta['query'])}/{name}"})
    saved.sort(key=lambda i: (i["engine"], i["query"], i["rank"] or 0))
    (root / "index.json").write_text(json.dumps(
        {"unit": unit, "by_group": by_group, "tree_id": tree_id, "created_at": _now(),
         "queries": queries, "pages": saved}, ensure_ascii=False, indent=1), encoding="utf-8")
    _dump_index(root, label, queries, saved)

    ok = sum(1 for i in saved if i["method"] != "failed")
    rendered = sum(1 for i in saved if i["method"] == "render")
    link = f"reports/{needs_layer.slug(unit)}/index.html"
    payload = {"task_id": task_id, "created_at": _now(), "report_link": link,
               "queries": [q["query"] for q in queries], "pages": len(saved), "ok": ok,
               "summary": f"{ok} из {len(saved)} страниц, {rendered} через браузер, "
                          f"{len(queries)} запросов"}
    if by_group:
        needs_layer.save_group_artifact(tree_id, group_id, "dump", payload)
    else:
        needs_layer.save_artifact(tree_id, work_name, "dump", payload)
    ctx.log("INFO", "needs_dump", label,
            f"выгружено {ok}/{len(saved)} страниц ({rendered} рендером) в {root.name}/")
    return {"pages": len(saved), "ok": ok, "rendered": rendered, "queries": len(queries),
            "link": link, "dir": str(root)}


# ---------- стоп-слова ----------

STOP_WORDS_CAP = 400        # столько слов отдаём модели за раз: дальше хвост из единичных


async def stopwords_scan(ctx, task_id, phrase, params):
    """Разбор слов ветки на стоп-слова, бренды и нежелательное (design §4.10).

    Результат — ПРЕДЛОЖЕНИЕ, а не фильтр: в БД попадает только то, что пользователь принял
    руками. Уже сохранённые слова на вход не идут — их классифицировали один раз; а слово,
    которое пользователь отклонил, модель предложит снова, потому что «отклонённого» мы не
    храним: список исключений — это то, что человек подтвердил, и ничего больше."""
    root = wscore.normalize(phrase)
    saved = [w["word"] for w in wscore.stopwords(ctx.con)]
    words, total = wscore.word_stats(ctx.con, root, exclude=saved, cap=STOP_WORDS_CAP)
    if not words:
        raise RuntimeError(f"в поддереве {root!r} не осталось неразобранных слов")
    _save_params(ctx, task_id, {"root": root, "words": len(words), "words_total": total,
                                "saved": len(saved)})
    if total > len(words):
        ctx.log("WARN", "stopwords", root,
                f"слов в ветке {total}, отдаём {len(words)} самых частых — остальные "
                f"встречаются реже всего")

    jparams = {"root": root, "root_freq": wscore.get_node(ctx.con, root)["freq"],
               "already_saved": saved, "words": words}
    res = (await _run_llm(ctx, "stopwords", root,
                          [_job(task_id, 0, "stopwords", jparams)]))[0]
    if not isinstance(res, dict):
        raise ValueError("stopwords вернул не объект")
    if not any(k in res for k in wscore.STOP_KINDS):
        # пустая категория — нормально, ответ без единой категории — уже не разбор
        raise ValueError("stopwords не вернул ни одной категории")

    known = {w["word"] for w in words}
    out, dropped = {}, 0
    for kind in wscore.STOP_KINDS:
        picked = []
        for it in res.get(kind) or []:
            w = wscore.normalize(it.get("word") if isinstance(it, dict) else it)
            if w not in known:          # выдуманное слово в список не пускаем
                dropped += 1
                continue
            picked.append({"word": w, "why": _str(it.get("why")) if isinstance(it, dict) else ""})
        out[kind] = picked
    if dropped:
        ctx.log("WARN", "stopwords", root, f"пропущено {dropped} слов: их не было во входе")
    ctx.log("INFO", "stopwords", root,
            "предложено: " + ", ".join(f"{k} {len(v)}" for k, v in out.items()))
    return {"root": root, "words_seen": len(words), "words_total": total, **out}


OPS = {"load": load, "full_load": full_load, "stopwords_scan": stopwords_scan,
       "needs_dump": needs_dump,
       "needs_build": needs_build, "needs_refine": needs_refine, "needs_rank": needs_rank,
       "needs_products": needs_products,
       "needs_analyze": needs_analyze,
       "needs_analyze_adv": needs_analyze_adv,
       "needs_analyze_product": needs_analyze_product,
       "needs_model_test": needs_model_test,
       "needs_season": needs_season, "needs_adjacent": needs_adjacent}


# ---------- тестовая постановка джоба (testing-plan §1.1) ----------

def enqueue_bare_job(ctx, op, params, model_family=None):
    """Положить один LLM-джоб с готовыми params — без краула и без записи в модель.
    Нужно, чтобы обмен джобами проверялся фальшивым воркером. -> (task_id, job_id)."""
    if op not in LLM_TYPES:
        raise ValueError(f"неизвестный тип джоба: {op}")
    job_params = params
    if model_family:
        job_params = {**(params if isinstance(params, dict) else {"value": params}),
                      "model_family": model_family}
    task_id = create_task(ctx, op, None, {"test": True, "model_family": model_family})
    ctx.con.execute("UPDATE task SET status = 'RUNNING', started_at = ? WHERE id = ?", (_now(), task_id))
    ctx.con.commit()
    _task_event(ctx, task_id)
    job = _job(task_id, 0, op, job_params)

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
