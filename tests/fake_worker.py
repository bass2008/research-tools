"""Фальшивый воркер: ведёт себя как Claude-петля, но вместо интеллекта отдаёт заготовки.

Зачем: пока обмен джобами не проверен без LLM, любой сбой в реальном прогоне неотличим —
виноват сервер или промпт (testing-plan §0, §5). Воркер ходит по тем же внутренним
эндпоинтам, что и `task-worker-mcp` (tech §6.3), с теми же заголовками
`X-Internal-Token` / `X-Caller`:

    GET  /internal/llm/watch?max_jobs=&timeout=   -> [{job_id, type, model_family}] (диспетчер)
    GET  /internal/llm/job/{job_id}               -> {job_id,type,params,model_family,prompt} (агент)
    POST /internal/llm/result {job_id, ok, …}     -> {accepted}           (агент)

Транспорт — любой объект с методами `get`/`post` в стиле httpx: `TestClient` в тестах или
`httpx.Client` против живого сервера (браузерный E2E, testing-plan §8).

Режимы (таблица testing-plan §5) задаются полем `mode`:

| mode              | что делает воркер                                             |
|-------------------|---------------------------------------------------------------|
| `ok`              | берёт джоб, возвращает корректную заготовку                    |
| `error`           | возвращает ошибку (`ok=false`)                                 |
| `bad_json`        | возвращает строку, которая не разбирается как JSON             |
| `silent`          | забрал сигнал и молчит: данные джоба даже не запрашивает       |
| `late`            | отвечает уже после таймаута операции                           |
| `unknown_job`     | отвечает на несуществующий `job_id`                            |
| `dispatcher_takes`| забирает данные джоба «от лица диспетчера» (нарушение tech §7.1)|
| `die`             | забрал данные джоба и умер, ничего не вернув                   |
"""
import json
import threading
import time

MODES = ("ok", "error", "bad_json", "silent", "late", "unknown_job", "dispatcher_takes", "die")

# Отчёт-заготовка: обязательные разделы шаблона templates/report.html — analyze проверяет,
# что HTML не пустой (>100 символов), а тест «отчёт содержит разделы» ищет заголовки.
REPORT_SECTIONS = ("Скоркарта", "Спрос и рынок", "Конкуренция в выдаче", "Незакрытая потребность",
                   "Реализация", "Экономика и монетизация", "Дистрибуция / выход на трафик",
                   "Риски, допущения, пробелы", "Вывод", "Опорная выдача")


def report_html(phrase, verdict="BUILD", verdict_score=82):
    body = "\n".join(f"<h2>{s}</h2><p>заготовка фальшивого воркера</p>" for s in REPORT_SECTIONS)
    return (f"<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\">"
            f"<title>Ниша: {phrase}</title></head><body><h1>{phrase}</h1>"
            f"<p class=\"tldr\">Вердикт {verdict}, verdict_score {verdict_score}.</p>"
            f"{body}</body></html>")


def canned(job, kinds=None, scores=None, verdict="BUILD", verdict_score=82, confidence=0.9):
    """Заготовка ответа по типу джоба: форма — как в design §6, выравнивание по `phrase`."""
    params = job.get("params") or {}
    if job["type"] == "needs_refine":
        # По умолчанию второй проход принимает исходный draft без смысловых изменений;
        # отдельные тесты передают answer и проверяют реальные переносы между работами.
        return params.get("draft")
    if job["type"] == "stopwords":
        # первое слово входа кладём в stop, остальное не трогаем: тестам важен транспорт,
        # а не качество разметки
        words = [w["word"] for w in params.get("words", [])]
        return {"stop": [{"word": w, "why": "заготовка"} for w in words[:1]],
                "brand": [], "unwanted": []}
    if job["type"] == "analyze_adv":
        # второй разбор возвращает функции, а не только вердикт по работе
        name = (params.get("work") or {}).get("name", "")
        return {"functions": [
                    {"name": f"делает {name}", "io": "вход -> выход",
                     "entry_query": (params.get("phrases") or [{}])[0].get("phrase", ""),
                     "entry_freq": (params.get("phrases") or [{}])[0].get("freq", 0),
                     "paid_proof": "заготовка: платный аналог есть",
                     "edge": "без регистрации", "channel": "магазин расширений",
                     "money": "заготовка: платный тариф 300 ₽/мес за пакетную обработку",
                     "cost": "заготовка: 2 ₽ за вызов модели",
                     "parity": "заготовка: выгрузка обратно на площадку",
                     "effort_weeks": 3, "score": verdict_score, "why": "заготовка",
                     "kill_test": "если платных аналогов нет — гипотеза мертва"}],
                "recommendation": verdict, "verdict_score": verdict_score, "confidence": 0.6,
                "report_html": report_html(name, verdict, verdict_score)}
    if job["type"] == "analyze_product":
        # третий разбор возвращает спецификацию продукта; product/price/why_pay приёмник
        # проверяет на непустоту
        name = (params.get("work") or {}).get("name", "")
        phr = (params.get("phrases") or [{}])[0]
        return {"spec": {"chosen_function": f"делает {name}", "chosen_why": "заготовка",
                         "product": f"делает {name} за минуту", "user": "заготовка: кто и когда",
                         "promise": "результат за минуту без регистрации",
                         "price": "199 ₽/мес", "free_part": "три штуки в день",
                         "paid_part": "пакет и экспорт без водяного знака",
                         "why_pay": "у соседа водяной знак снимается только за $9/мес",
                         "find": phr.get("phrase", ""), "find_freq": phr.get("freq", 0),
                         "channel": "магазин расширений", "first_paying": "пост в профильном чате",
                         "scope_in": ["одна функция"], "scope_out": ["редактор", "командный режим"],
                         "weeks": 4, "unit_cost": "2 ₽ за вызов модели",
                         "kill_test": "лендинг с кнопкой оплаты за неделю"},
                "forecast": {
                    "assumptions": [{"name": "визит -> попробовал", "value": "20%",
                                     "source": "ориентир промпта"}],
                    "months": [{"month": m, "visits": 100 * m, "trials": 20 * m,
                                "new_paying": m, "paying": m, "mrr": 199 * m,
                                "revenue_cum": 199 * m * m} for m in (1, 2, 3, 6)],
                    "ceiling": {"paying": 200, "mrr": 39800, "why": "заготовка"},
                    "budget": {"hours": 120, "money": 240000, "monthly": 3000,
                               "why": "заготовка"},
                    "payback": "не окупается за шесть месяцев",
                    "scenario_low": "заготовка: 400 ₽/мес на шестом месяце",
                    "invest_case": "заготовка: зачем вкладываться"},
                "recommendation": verdict, "verdict_score": verdict_score, "confidence": 0.6,
                "why": "заготовка", "report_html": report_html(name, verdict, verdict_score)}
    if job["type"] == "model_test":
        family = str(params.get("model_family") or "claude")
        model = str(params.get("requested_model") or "test-model")
        name = str(params.get("work") or "тестовая работа")
        return {
            "model_family": family,
            "message": "Тестовый отчёт сформирован",
            "report_html": (
                f"<h2>Минутный тест пройден</h2><p>Работа: {name}. Семейство: {family}. "
                f"Модель: {model}.</p><p>Это отчёт-пустышка без бизнес-выводов, score, "
                "конкурентов и прогноза денег.</p>"
            ),
        }
    if job["type"] == "analyze_work":
        # единица разбора — работа: в отчёт идёт её имя, а не фраза
        name = (params.get("work") or {}).get("name", "")
        return {"recommendation": verdict, "verdict_score": verdict_score, "confidence": 0.7,
                "report_html": report_html(name, verdict, verdict_score)}
    raise AssertionError(f"фальшивый воркер не знает тип джоба: {job['type']!r}")


class FakeWorker:
    """Петля-заготовка. Один экземпляр = один режим поведения."""

    def __init__(self, http, token, mode="ok", answer=None, kinds=None, scores=None,
                 verdict="BUILD", verdict_score=82, late_after=None, model_family=None):
        assert mode in MODES, f"неизвестный режим: {mode!r}"
        self.http = http
        self.token = token
        self.mode = mode
        self.answer = answer                # answer(job) -> результат (перебивает заготовку)
        self.kinds = kinds or {}
        self.scores = scores or {}
        self.verdict = verdict
        self.verdict_score = verdict_score
        self.late_after = late_after        # сколько ждать перед опоздавшим ответом
        self.model_family = model_family    # семейный dispatcher; None = старый/default Claude
        self.seen = []                      # сигналы, которые пришли из watch
        self.taken = []                     # job_id, по которым забирали данные
        self.done = []                      # [{job_id, accepted, mode}]
        self.errors = []                    # проблемы транспорта (для диагностики теста)
        self._stop = threading.Event()
        self._thread = None

    # ---------- сырые вызовы границы (tech §6.3) ----------

    def _hdr(self, caller):
        return {"X-Internal-Token": self.token, "X-Caller": caller}

    def watch(self, max_jobs=8, timeout=5.0, caller="dispatcher", model_family=None):
        params = {"max_jobs": max_jobs, "timeout": timeout}
        if model_family:
            params["model_family"] = model_family
        r = self.http.get("/internal/llm/watch", params=params,
                          headers=self._hdr(caller))
        assert r.status_code == 200, f"watch -> {r.status_code}: {r.text[:200]}"
        jobs = r.json()
        self.seen += jobs
        return jobs

    def get_job(self, job_id, caller="agent"):
        """Данные джоба или None, если сервер ответил 404 (неизвестен/просрочен)."""
        r = self.http.get(f"/internal/llm/job/{job_id}", headers=self._hdr(caller))
        if r.status_code == 404:
            return None
        assert r.status_code == 200, f"get_job -> {r.status_code}: {r.text[:200]}"
        self.taken.append(job_id)
        return r.json()

    def submit(self, job_id, ok=True, result=None, error=None, caller="agent"):
        """Вернуть результат или ошибку. -> accepted (False = джоб просрочен/неизвестен)."""
        body = {"job_id": job_id, "ok": ok}
        if ok:
            body["result"] = result
        else:
            body["error"] = error or "агент вернул ошибку без описания"
        r = self.http.post("/internal/llm/result", json=body, headers=self._hdr(caller))
        assert r.status_code == 200, f"result -> {r.status_code}: {r.text[:200]}"
        accepted = bool(r.json().get("accepted"))
        self.done.append({"job_id": job_id, "accepted": accepted, "mode": self.mode})
        return accepted

    # ---------- поведение по режиму ----------

    def result_for(self, job):
        if self.answer is not None:
            return self.answer(job)
        return canned(job, self.kinds, self.scores, self.verdict, self.verdict_score)

    def handle(self, signal):
        """Отработать один сигнал `{job_id, type}` согласно режиму."""
        job_id = signal["job_id"]
        if self.mode == "silent":
            return None                                   # даже данные не забираем
        if self.mode == "unknown_job":
            return self.submit(f"{job_id}-нетакого", result={"results": []})
        caller = "dispatcher" if self.mode == "dispatcher_takes" else "agent"
        job = self.get_job(job_id, caller=caller)
        if job is None:
            self.errors.append(f"джоб {job_id} недоступен")
            return None
        if self.mode == "die":
            return None                                   # забрал и умер
        if self.mode == "error":
            return self.submit(job_id, ok=False, error="тестовый режим: агент упал")
        if self.mode == "bad_json":
            return self.submit(job_id, result="{\"results\": [ это не JSON")
        if self.mode == "late":
            time.sleep(self.late_after if self.late_after is not None else 2.0)
        return self.submit(job_id, result=self.result_for(job))

    def run_once(self, max_jobs=8, timeout=5.0):
        """Один оборот петли: дождаться пачку и обработать её. -> список сигналов."""
        jobs = self.watch(max_jobs=max_jobs, timeout=timeout, model_family=self.model_family)
        for signal in jobs:
            self.handle(signal)
        return jobs

    # ---------- фоновая петля (для drill и многошаговых сценариев) ----------

    def _loop(self, max_jobs, timeout):
        while not self._stop.is_set():
            try:
                jobs = self.watch(max_jobs=max_jobs, timeout=timeout,
                                  model_family=self.model_family)
            except Exception as e:                      # сервер погас — петля тихо выходит
                self.errors.append(f"watch: {type(e).__name__}: {e}")
                return
            for signal in jobs:
                if self._stop.is_set():
                    return
                try:
                    self.handle(signal)
                except Exception as e:                  # падение агента петлю не останавливает
                    self.errors.append(f"{signal['job_id']}: {type(e).__name__}: {e}")

    def start(self, max_jobs=8, timeout=1.0):
        """Поднять петлю в отдельном треде (сервер живёт в своём — так же, как в бою)."""
        self._thread = threading.Thread(target=self._loop, args=(max_jobs, timeout),
                                        name="fake-worker", daemon=True)
        self._thread.start()
        return self

    def stop(self, timeout=5.0):
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout)
            self._thread = None

    def __enter__(self):
        return self.start()

    def __exit__(self, *exc):
        self.stop()


def json_dumps(obj):
    """Ответ строкой — так его отдаёт агент, когда пишет JSON текстом."""
    return json.dumps(obj, ensure_ascii=False)
