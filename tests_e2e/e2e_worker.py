#!/usr/bin/env python3
"""Фальшивый LLM-воркер для браузерных E2E (testing-plan §5).

Ведёт себя как петля Claude Code, но вместо интеллекта отдаёт заготовки: висит на
`watch`, забирает `job_id`, берёт данные джоба и возвращает заранее заданный ответ.
Заголовок `X-Caller` различает диспетчера и агента (testing-plan §1.2): сигнал берёт
диспетчер, данные и результат — агент.

Режимы (они же тест-кейсы §5):

| Режим | Поведение |
|---|---|
| `ok` | корректный ответ по типу джоба |
| `hold` | забрал джоб и держит результат, пока тест не позовёт `release()` |
| `error` | возвращает `ok:false` — операция должна упасть, узел остаться как был |
| `bad_json` | возвращает строку, которая не разбирается как JSON |

Живёт в отдельном треде: `watch` блокирующий, а сервер — в другом процессе.
"""
import json
import threading
import time

import httpx

import seed

WATCH_SLICE = 2.0        # таймаут одного watch: петля регулярно «показывается» серверу
HOLD_LIMIT = 120.0       # предохранитель режима hold, чтобы тред не жил вечно
POLL = 0.05


class FakeWorker:
    """Фальшивая петля: start(mode) — поднять, release() — отпустить hold, stop() — снять."""

    def __init__(self, base_url, token, kinds=None, score=80.0,
                 verdict="BUILD", verdict_score=77.0):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.kinds = kinds or {}          # фраза -> kind (по умолчанию transactional)
        self.score = score
        self.verdict = verdict
        self.verdict_score = verdict_score
        self.mode = "ok"
        self.taken = []                   # какие джобы забрали: [(job_id, type)]
        self.submitted = []               # что отправили: [(job_id, accepted)]
        self.errors = []                  # сбои самого воркера — видно в отчёте о падении
        self._stop = threading.Event()
        self._go = threading.Event()
        self._thread = None

    # ---------- управление ----------

    def start(self, mode="ok"):
        self.mode = mode
        self._stop.clear()
        self._go.clear()
        self._thread = threading.Thread(target=self._loop, name="fake-llm", daemon=True)
        self._thread.start()
        return self

    def release(self):
        """Отпустить результат, который держит режим hold."""
        self._go.set()

    def stop(self):
        self._stop.set()
        self._go.set()
        if self._thread is not None:
            self._thread.join(timeout=15)
            self._thread = None

    # ---------- петля ----------

    def _headers(self, caller):
        return {"X-Internal-Token": self.token, "X-Caller": caller}

    def _loop(self):
        with httpx.Client(timeout=httpx.Timeout(60.0, connect=5.0)) as client:
            while not self._stop.is_set():
                try:
                    r = client.get(f"{self.base_url}/internal/llm/watch",
                                   params={"max_jobs": 8, "timeout": WATCH_SLICE},
                                   headers=self._headers("dispatcher"))
                    jobs = r.json() if r.status_code == 200 else []
                except (httpx.HTTPError, ValueError) as e:
                    # сервер перезапускается (сценарий 17) — петля просто ждёт и повторяет
                    self.errors.append(f"watch: {type(e).__name__}: {e}")
                    self._sleep(0.2)
                    continue
                for sig in jobs:
                    if self._stop.is_set():
                        return
                    self._one(client, sig)

    def _one(self, client, sig):
        """Один джоб: данные берёт агент, результат отправляет тоже агент (tech §6.3)."""
        job_id = sig.get("job_id")
        try:
            r = client.get(f"{self.base_url}/internal/llm/job/{job_id}",
                           headers=self._headers("agent"))
            if r.status_code != 200:
                self.errors.append(f"get_job {job_id}: HTTP {r.status_code}")
                return
            job = r.json()
        except (httpx.HTTPError, ValueError) as e:
            self.errors.append(f"get_job {job_id}: {type(e).__name__}: {e}")
            return
        self.taken.append((job_id, job.get("type")))
        if self.mode == "hold" and not self._wait_release():
            return
        body = {"job_id": job_id, "ok": True, "result": self._answer(job)}
        if self.mode == "error":
            body = {"job_id": job_id, "ok": False, "error": "фальшивый воркер: намеренная ошибка"}
        elif self.mode == "bad_json":
            body = {"job_id": job_id, "ok": True, "result": '{"results": [ не json'}
        try:
            r = client.post(f"{self.base_url}/internal/llm/result", json=body,
                            headers=self._headers("agent"))
            self.submitted.append((job_id, bool((r.json() or {}).get("accepted"))))
        except (httpx.HTTPError, ValueError) as e:
            self.errors.append(f"result {job_id}: {type(e).__name__}: {e}")

    def _wait_release(self):
        """Держим результат до release()/stop(). -> False, если воркер снимают."""
        deadline = time.monotonic() + HOLD_LIMIT
        while not self._go.wait(POLL):
            if self._stop.is_set() or time.monotonic() > deadline:
                return False
        return not self._stop.is_set()

    def _sleep(self, sec):
        self._stop.wait(sec)

    # ---------- заготовки ответов ----------

    def _answer(self, job):
        """Ответ по типу джоба — форма из design §6 и prompts/{type}.md."""
        kind_of = self.kinds
        params = job.get("params") or {}
        if job["type"] == "classify":
            return {"results": [
                {"phrase": n["phrase"], "kind": kind_of.get(n["phrase"], "transactional"),
                 "confidence": 0.9, "reason": "фальшивый воркер: разметка по умолчанию"}
                for n in params.get("nodes", [])]}
        if job["type"] == "score":
            return {"results": [
                {"phrase": it["phrase"], "score": self.score,
                 "competition_yandex": 35, "competition_google": 40,
                 "weights": {"yandex": 0.6, "google": 0.4},
                 "description": "спрос есть, профильного инструмента в топе нет",
                 "signals": [{"code": "NO_DEDICATED_TOOL", "weight": 40,
                              "evidence": "фальшивый воркер"}]}
                for it in params.get("items", [])]}
        if job["type"] == "analyze":
            phrase = params.get("phrase", "")
            return {"recommendation": self.verdict, "verdict_score": self.verdict_score,
                    "confidence": 0.8,
                    "report_html": seed.report_html(phrase, self.verdict, self.verdict_score)}
        raise ValueError(f"фальшивый воркер не знает тип джоба: {job['type']}")

    def dump(self):
        """Состояние воркера строкой — идёт в артефакты упавшего теста."""
        return json.dumps({"mode": self.mode, "taken": self.taken,
                           "submitted": self.submitted, "errors": self.errors},
                          ensure_ascii=False, indent=2)
