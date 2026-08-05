"""Автономный Codex-dispatcher для очереди taskworker.

Команда живёт в установленном пакете: на старте не генерирует Python-код. Supervisor получает
только короткие сигналы ``{job_id, type}`` через ``taskworker wait-jobs`` и запускает отдельный
``codex exec`` на каждый джоб. Полные ``params`` и ``prompt`` забирает уже Codex-исполнитель
через MCP.
"""

from __future__ import annotations

import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
from typing import Any

from . import app_client
from .config import log_dir, repo_root

DEFAULT_MAX_WORKERS = 8
WATCH_TIMEOUT = 45
STARTUP_WATCH_TIMEOUT = 2
RETRY_PAUSE = 5
START_TIMEOUT = 20
STOP_TIMEOUT = 15
JOB_ID_RE = re.compile(r"^[A-Za-z0-9._:-]+$")

MODELS: dict[str, tuple[str, str]] = {
    "needs": ("gpt-5.6-sol", "xhigh"),
    "needs_refine": ("gpt-5.6-sol", "xhigh"),
    "analyze_work": ("gpt-5.6-sol", "xhigh"),
    "analyze_adv": ("gpt-5.6-sol", "xhigh"),
    "analyze_product": ("gpt-5.6-sol", "xhigh"),
    "model_test": ("gpt-5.6-luna", "low"),
    "season": ("gpt-5.6-terra", "low"),
    "adjacent": ("gpt-5.6-terra", "medium"),
    "stopwords": ("gpt-5.6-terra", "low"),
}


def default_state_dir() -> Path:
    return log_dir() / "codex-dispatcher"


def default_worker_dir() -> Path:
    candidate = repo_root() / "worker"
    return candidate if candidate.is_dir() else Path.cwd()


def taskworker_executable() -> str:
    found = shutil.which("taskworker")
    if found:
        return found
    candidate = Path(sys.executable).with_name("taskworker")
    return str(candidate)


def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _atomic_json(path: Path, value: Any) -> None:
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def _atomic_text(path: Path, value: str) -> None:
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        handle.write(value)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def _read_json(path: Path, fallback: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def _pid_alive(pid: Any) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _pid_is_dispatcher(pid: int) -> bool:
    if not _pid_alive(pid):
        return False
    try:
        command = (Path("/proc") / str(pid) / "cmdline").read_bytes().replace(b"\0", b" ")
    except OSError:
        return True  # На системе без /proc остаётся проверка PID и lock внутри run.
    return b"taskworker.codex_dispatch" in command and b" run" in command


def _safe_job_id(job_id: str) -> str:
    return job_id.replace(":", "_")


def _counts(ledger: dict[str, Any]) -> dict[str, int]:
    result = {"pending": 0, "running": 0, "finished": 0, "failed": 0}
    for job in ledger.get("jobs", {}).values():
        status = job.get("status")
        if status in result:
            result[status] += 1
    return result


def parse_signals(stdout: str, model_family: str | None = None) -> list[tuple[str, str]]:
    """Проверить stdout wait-jobs и вернуть пары ``(job_id, type)``."""
    try:
        batch = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise ValueError(f"wait-jobs вернул невалидный JSON: {exc}") from exc
    if not isinstance(batch, list):
        raise ValueError(f"wait-jobs вернул {type(batch).__name__}, ожидался список")
    signals: list[tuple[str, str]] = []
    for item in batch:
        if not isinstance(item, dict):
            raise ValueError("элемент wait-jobs не объект")
        job_id, job_type = item.get("job_id"), item.get("type")
        if not isinstance(job_id, str) or not JOB_ID_RE.fullmatch(job_id):
            raise ValueError("wait-jobs вернул небезопасный или пустой job_id")
        if not isinstance(job_type, str) or not job_type:
            raise ValueError(f"wait-jobs вернул пустой type для {job_id}")
        family = item.get("model_family")
        if model_family and family not in (None, model_family):
            raise ValueError(
                f"wait-jobs вернул чужое семейство {family!r} для {job_id}; ожидалось {model_family}"
            )
        signals.append((job_id, job_type))
    return signals


def worker_prompt(job_id: str, job_type: str) -> str:
    return f"""Ты не диспетчер, а единственный исполнитель джоба taskworker.
job_id = {job_id}; ожидаемый type = {job_type}.

1. Не запускай dispatcher, wait-jobs, status и других агентов.
2. Вызови MCP taskworker.get_job(\"{job_id}\") ровно для этого job_id.
3. Если get_job вернул error, не выдумывай работу. Отправь submit_result с краткой проверенной
   ошибкой, если джоб ещё принимает ответ, и закончи.
4. Проверь фактические job_id и type. Если get_job объявил params.input_file, прочитай этот JSON
   полностью, проверь его job_id/type и SHA-256, и дальше используй params/prompt именно из него.
   Иначе выполни params/prompt прямо из get_job. Единственные входы — ответ get_job, объявленный
   им input_file и внешние источники, прямо требуемые prompt. Не ищи и не читай другие файлы
   проекта, прошлые отчёты, logs/worker-logs, ~/.codex/sessions или чужие сессии.
5. Верни валидный JSON точно по схеме prompt. Не обрезай HTML, массивы и обязательные поля.
6. Если get_job объявил result_file, запиши полный JSON ровно туда и вызови
   submit_result(\"{job_id}\") без result. Иначе передай JSON параметром result.
7. Успех — только accepted:true. accepted:false с problems разрешает исправить перечисленное и
   повторно отправить тот же джоб. Unknown/expired без исправимых problems не ретраить.
8. Нет достоверного результата — отправь error, не выдумывай данные.
9. Не меняй базу и файлы проекта; input_file только читай, писать можно лишь в result_file.
10. Финальный ответ — ровно одна строка: SUBMITTED {job_id} {job_type} result|error. Не пиши
    SUBMITTED до accepted:true.
"""


def build_worker_command(
    job_id: str,
    job_type: str,
    *,
    worker_dir: Path,
    state_dir: Path,
    fast: bool,
) -> tuple[list[str], Path, Path, str, str]:
    model, effort = MODELS.get(job_type, ("gpt-5.6-sol", "xhigh"))
    safe_id = _safe_job_id(job_id)
    final_path = state_dir / "workers" / f"{safe_id}.final.txt"
    worker_log = state_dir / "worker-logs" / f"{safe_id}.log"
    command = [
        "codex", "--ask-for-approval", "never", "--search",
        "exec", "--ephemeral",
        "--cd", str(worker_dir),
        "--model", model,
        "-c", f'model_reasoning_effort="{effort}"',
        "-c", 'mcp_servers.taskworker.enabled_tools=["get_job","submit_result"]',
        "-c", 'mcp_servers.taskworker.required=true',
        "-c", 'mcp_servers.taskworker.tool_timeout_sec=300',
        "-c", 'mcp_servers.taskworker.tools.get_job.approval_mode="approve"',
        "-c", 'mcp_servers.taskworker.tools.submit_result.approval_mode="approve"',
        "--sandbox", "workspace-write",
        "--add-dir", str(log_dir()),
        "--output-last-message", str(final_path),
    ]
    if fast:
        command += ["-c", "features.fast_mode=true", "-c", 'service_tier="fast"']
    command.append(worker_prompt(job_id, job_type))
    return command, final_path, worker_log, model, effort


def _marker_present(path: Path, job_id: str, job_type: str) -> bool:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return False
    allowed = {
        f"SUBMITTED {job_id} {job_type} result",
        f"SUBMITTED {job_id} {job_type} error",
    }
    return any(line.strip() in allowed for line in lines)


def _codex_mcp_registration(taskworker: str) -> tuple[bool, str]:
    """Проверить/создать user-scope регистрацию taskworker для новых codex exec."""
    check = subprocess.run(
        ["codex", "mcp", "get", "taskworker"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        timeout=20,
    )
    if check.returncode == 0:
        expected_command = f"command: {taskworker}"
        if expected_command not in check.stdout or "args: mcp" not in check.stdout:
            return False, "MCP taskworker уже зарегистрирован с другой командой"
        return True, "MCP taskworker уже зарегистрирован"
    add = subprocess.run(
        ["codex", "mcp", "add", "taskworker", "--", taskworker, "mcp"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
        timeout=20,
    )
    if add.returncode != 0:
        return False, f"не удалось зарегистрировать MCP taskworker: {add.stdout.strip()}"
    return True, "MCP taskworker зарегистрирован"


class Supervisor:
    def __init__(
        self,
        *,
        state_dir: Path,
        worker_dir: Path,
        taskworker: str,
        max_workers: int,
        fast: bool,
    ) -> None:
        self.state_dir = state_dir
        self.worker_dir = worker_dir
        self.taskworker = taskworker
        self.max_workers = max_workers
        self.fast = fast
        self.workers_dir = state_dir / "workers"
        self.worker_logs_dir = state_dir / "worker-logs"
        self.ledger_path = state_dir / "ledger.json"
        self.state_path = state_dir / "state.json"
        self.pid_path = state_dir / "dispatcher.pid"
        self.lock_path = state_dir / "dispatcher.lock"
        self.log_path = state_dir / "dispatcher.log"
        self.stop_requested = False
        self.wait_process: subprocess.Popen[str] | None = None
        self.worker_processes: dict[str, subprocess.Popen[bytes]] = {}
        self.worker_log_handles: dict[str, Any] = {}
        self.started_at = iso_now()
        self.last_watch_at: str | None = None
        self.unavailable_since: str | None = None
        self.codex_version = "unknown"

    def prepare(self) -> None:
        os.umask(0o077)
        for directory in (self.state_dir, self.workers_dir, self.worker_logs_dir):
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(directory, 0o700)

    def log(self, message: str) -> None:
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(f"{iso_now()} {message}\n")

    def load_ledger(self) -> dict[str, Any]:
        if not self.ledger_path.exists():
            return {"version": 1, "jobs": {}}
        ledger = _read_json(self.ledger_path)
        if not isinstance(ledger, dict) or not isinstance(ledger.get("jobs"), dict):
            raise RuntimeError(f"повреждён ledger: {self.ledger_path}")
        return ledger

    def save_ledger(self, ledger: dict[str, Any]) -> None:
        ledger["updated_at"] = iso_now()
        _atomic_json(self.ledger_path, ledger)

    def write_state(self, ledger: dict[str, Any], status: str, message: str | None = None) -> None:
        state = {
            "pid": os.getpid(),
            "started_at": self.started_at,
            "updated_at": iso_now(),
            "working_directory": str(self.worker_dir),
            "model_family": "codex",
            "tier": "fast" if self.fast else "configured-default",
            "fast_mode": self.fast,
            "parallel_limit": self.max_workers,
            "codex_version": self.codex_version,
            "status": status,
            "last_watch_at": self.last_watch_at,
            "unavailable_since": self.unavailable_since,
            "counts": _counts(ledger),
        }
        if message:
            state["message"] = message
        _atomic_json(self.state_path, state)

    def handle_signal(self, signum: int, _frame: Any) -> None:
        self.stop_requested = True
        self.log(f"signal={signum}; stop accepting jobs")
        if self.wait_process is not None and self.wait_process.poll() is None:
            try:
                self.wait_process.terminate()
            except ProcessLookupError:
                pass

    def ingest(self, ledger: dict[str, Any], signals: list[tuple[str, str]]) -> int:
        added = 0
        for job_id, job_type in signals:
            if job_id in ledger["jobs"]:
                self.log(f"duplicate signal ignored job_id={job_id} type={job_type}")
                continue
            ledger["jobs"][job_id] = {
                "job_id": job_id,
                "type": job_type,
                "status": "pending",
                "discovered_at": iso_now(),
                "pid": None,
                "pgid": None,
                "exit_code": None,
            }
            added += 1
        if added:
            self.save_ledger(ledger)
            for job_id, job_type in signals:
                if ledger["jobs"].get(job_id, {}).get("status") == "pending":
                    self.log(f"signal saved job_id={job_id} type={job_type}")
        return added

    def start_worker(self, ledger: dict[str, Any], job_id: str) -> None:
        job = ledger["jobs"][job_id]
        command, final_path, worker_log, model, effort = build_worker_command(
            job_id,
            job["type"],
            worker_dir=self.worker_dir,
            state_dir=self.state_dir,
            fast=self.fast,
        )
        if job["type"] not in MODELS:
            self.log(f"unknown type={job['type']} job_id={job_id}; fallback=sol/xhigh")
        handle = worker_log.open("ab", buffering=0)
        try:
            process = subprocess.Popen(
                command,
                cwd=self.worker_dir,
                stdin=subprocess.DEVNULL,
                stdout=handle,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                close_fds=True,
            )
        except Exception as exc:
            handle.close()
            job.update({
                "status": "failed",
                "finished_at": iso_now(),
                "reason": f"worker start failed: {type(exc).__name__}",
                "model": model,
                "effort": effort,
            })
            self.save_ledger(ledger)
            self.log(f"worker start failed job_id={job_id} error={type(exc).__name__}")
            self.submit_lifecycle_error(job_id, f"Codex не запустился: {type(exc).__name__}")
            return
        job.update({
            "status": "running",
            "started_at": iso_now(),
            "pid": process.pid,
            "pgid": process.pid,
            "model": model,
            "effort": effort,
            "tier": "fast" if self.fast else "configured-default",
            "final_file": str(final_path),
        })
        self.save_ledger(ledger)
        self.worker_processes[job_id] = process
        self.worker_log_handles[job_id] = handle
        self.log(
            f"worker started job_id={job_id} type={job['type']} model={model} "
            f"effort={effort} pid={process.pid}"
        )

    def submit_lifecycle_error(self, job_id: str, error: str) -> None:
        try:
            answer = app_client.submit_result(job_id, error=error, caller="agent")
        except app_client.AppError as exc:
            self.log(f"lifecycle error not submitted job_id={job_id} error={type(exc).__name__}")
            return
        self.log(f"lifecycle error job_id={job_id} accepted={bool(answer.get('accepted'))}")

    def reap_workers(self, ledger: dict[str, Any]) -> bool:
        changed = False
        for job_id, process in list(self.worker_processes.items()):
            exit_code = process.poll()
            if exit_code is None:
                continue
            handle = self.worker_log_handles.pop(job_id, None)
            if handle is not None:
                handle.close()
            self.worker_processes.pop(job_id, None)
            job = ledger["jobs"][job_id]
            final_path = Path(job.get("final_file") or "")
            submitted = exit_code == 0 and _marker_present(final_path, job_id, job["type"])
            job.update({
                "status": "finished" if submitted else "failed",
                "finished_at": iso_now(),
                "exit_code": exit_code,
                "reason": None if submitted else "нет подтверждённого SUBMITTED marker",
            })
            self.log(
                f"worker finished job_id={job_id} exit={exit_code} "
                f"outcome={'finished' if submitted else 'failed'}"
            )
            if not submitted:
                self.submit_lifecycle_error(job_id, f"Codex завершился до подтверждённого submit (exit {exit_code})")
            changed = True

        for job_id, job in ledger["jobs"].items():
            if job.get("status") != "running" or job_id in self.worker_processes:
                continue
            if _pid_alive(job.get("pid")):
                continue
            final_path = Path(job.get("final_file") or "")
            submitted = _marker_present(final_path, job_id, job["type"])
            job.update({
                "status": "finished" if submitted else "failed",
                "finished_at": iso_now(),
                "reason": None if submitted else "worker PID исчез без SUBMITTED marker",
            })
            if not submitted:
                self.submit_lifecycle_error(job_id, "Codex worker исчез до подтверждённого submit")
            changed = True
        if changed:
            self.save_ledger(ledger)
        return changed

    def launch_pending(self, ledger: dict[str, Any]) -> bool:
        running = sum(1 for job in ledger["jobs"].values() if job.get("status") == "running")
        available = max(0, self.max_workers - running)
        pending = [
            job_id for job_id, job in ledger["jobs"].items() if job.get("status") == "pending"
        ]
        selected = pending[:available]
        for job_id in selected:
            self.start_worker(ledger, job_id)
        return bool(selected)

    def watch_once(
        self,
        timeout: int,
        *,
        ledger: dict[str, Any] | None = None,
    ) -> tuple[int, str]:
        self.wait_process = subprocess.Popen(
            [self.taskworker, "wait-jobs", "--model-family", "codex",
             "--max-jobs", "10", "--timeout", str(timeout)],
            cwd=self.worker_dir,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        self.log(f"watch started pid={self.wait_process.pid} timeout={timeout}")
        next_housekeeping = 0.0
        while self.wait_process.poll() is None and not self.stop_requested:
            if ledger is not None and time.monotonic() >= next_housekeeping:
                changed = self.reap_workers(ledger)
                changed = self.launch_pending(ledger) or changed
                if changed:
                    self.write_state(ledger, "running")
                next_housekeeping = time.monotonic() + 0.5
            time.sleep(0.25)
        stdout, stderr = self.wait_process.communicate()
        exit_code = self.wait_process.returncode
        self.wait_process = None
        if exit_code != 0:
            detail = " ".join(line.strip() for line in stderr.splitlines() if line.strip())[-500:]
            return exit_code, detail or "wait-jobs завершился с ошибкой"
        return 0, stdout

    def run(self) -> int:
        self.prepare()
        lock_handle = self.lock_path.open("a+")
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Codex-dispatcher уже запущен", file=sys.stderr)
            return 73

        signal.signal(signal.SIGTERM, self.handle_signal)
        signal.signal(signal.SIGINT, self.handle_signal)
        ledger = self.load_ledger()
        self.save_ledger(ledger)
        version = subprocess.run(
            ["codex", "--version"],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
            timeout=15,
        )
        self.codex_version = version.stdout.strip() or f"unknown(exit={version.returncode})"
        _atomic_text(self.pid_path, f"{os.getpid()}\n")
        self.log(
            f"START pid={os.getpid()} tier={'fast' if self.fast else 'configured-default'} "
            f"limit={self.max_workers} codex={self.codex_version}"
        )
        self.reap_workers(ledger)
        self.launch_pending(ledger)
        self.write_state(ledger, "starting")

        try:
            exit_code, output = self.watch_once(STARTUP_WATCH_TIMEOUT)
            if self.stop_requested:
                return 0
            if exit_code != 0:
                self.unavailable_since = iso_now()
                self.write_state(ledger, "failed", output)
                self.log(f"startup watch failed: {output}")
                return 1
            signals = parse_signals(output, model_family="codex")
            added = self.ingest(ledger, signals)
            self.last_watch_at = iso_now()
            self.launch_pending(ledger)
            self.write_state(ledger, "running")
            self.log(f"startup watch healthy jobs={added}")

            while not self.stop_requested:
                self.reap_workers(ledger)
                self.launch_pending(ledger)
                exit_code, output = self.watch_once(WATCH_TIMEOUT, ledger=ledger)
                if self.stop_requested:
                    break
                if exit_code != 0:
                    self.unavailable_since = self.unavailable_since or iso_now()
                    self.write_state(ledger, "degraded", output)
                    self.log(f"watch failed: {output}")
                    deadline = time.time() + RETRY_PAUSE
                    while time.time() < deadline and not self.stop_requested:
                        time.sleep(0.25)
                    continue
                try:
                    signals = parse_signals(output, model_family="codex")
                except ValueError as exc:
                    self.unavailable_since = self.unavailable_since or iso_now()
                    self.write_state(ledger, "degraded", str(exc))
                    self.log(f"watch parse failed: {exc}")
                    continue
                added = self.ingest(ledger, signals)
                self.last_watch_at = iso_now()
                self.unavailable_since = None
                self.launch_pending(ledger)
                self.write_state(ledger, "running")
                self.log(f"watch healthy jobs={added}")
            return 0
        except Exception as exc:
            self.write_state(ledger, "failed", f"{type(exc).__name__}: {exc}")
            self.log(f"FATAL {type(exc).__name__}: {exc}")
            return 1
        finally:
            if self.wait_process is not None and self.wait_process.poll() is None:
                try:
                    self.wait_process.terminate()
                    self.wait_process.wait(timeout=10)
                except (ProcessLookupError, subprocess.TimeoutExpired):
                    pass
            self.reap_workers(ledger)
            for handle in self.worker_log_handles.values():
                handle.close()
            self.write_state(
                ledger,
                "stopped" if self.stop_requested else _read_json(self.state_path, {}).get("status", "failed"),
                "dispatcher stopped; already-running Codex workers left alive" if self.stop_requested else None,
            )
            self.log(f"STOP pid={os.getpid()} active_workers={_counts(ledger)['running']}")


def _status_payload(state_dir: Path) -> dict[str, Any]:
    state = _read_json(state_dir / "state.json", {})
    pid = state.get("pid") if isinstance(state, dict) else None
    alive = _pid_is_dispatcher(pid) if isinstance(pid, int) else False
    if not isinstance(state, dict):
        state = {}
    state["alive"] = alive
    if not alive and state.get("status") not in {"stopped", "failed"}:
        state["status"] = "stale"
    state["state_dir"] = str(state_dir)
    return state


def command_status(state_dir: Path, *, as_json: bool = False) -> int:
    payload = _status_payload(state_dir)
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        counts = payload.get("counts") or {}
        print(
            f"Codex-dispatcher: {payload.get('status', 'not-started')}; "
            f"pid={payload.get('pid', '-')}; alive={payload.get('alive', False)}; "
            f"tier={payload.get('tier', '-')}; "
            f"running={counts.get('running', 0)}; pending={counts.get('pending', 0)}"
        )
    return 0 if payload.get("alive") and payload.get("status") == "running" else 1


def command_start(
    *,
    state_dir: Path,
    worker_dir: Path,
    taskworker: str,
    max_workers: int,
    fast: bool,
) -> int:
    current = _status_payload(state_dir)
    if current.get("alive"):
        print(
            f"Codex-dispatcher уже запущен: pid={current.get('pid')}, "
            f"status={current.get('status')}"
        )
        return 0 if current.get("status") == "running" else 1
    if shutil.which("codex") is None:
        print("codex не найден в PATH", file=sys.stderr)
        return 1
    ok, message = _codex_mcp_registration(taskworker)
    if not ok:
        print(message, file=sys.stderr)
        return 1

    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(state_dir, 0o700)
    bootstrap_path = state_dir / "bootstrap.log"
    bootstrap = bootstrap_path.open("ab", buffering=0)
    os.chmod(bootstrap_path, 0o600)
    command = [
        sys.executable,
        "-m",
        "taskworker.codex_dispatch",
        "run",
        "--state-dir",
        str(state_dir),
        "--worker-dir",
        str(worker_dir),
        "--taskworker",
        taskworker,
        "--max-workers",
        str(max_workers),
    ]
    if fast:
        command.append("--fast")
    process = subprocess.Popen(
        command,
        cwd=worker_dir,
        stdin=subprocess.DEVNULL,
        stdout=bootstrap,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )
    bootstrap.close()
    deadline = time.time() + START_TIMEOUT
    last: dict[str, Any] = {}
    while time.time() < deadline:
        time.sleep(0.25)
        last = _status_payload(state_dir)
        if last.get("pid") == process.pid and last.get("status") == "running" and last.get("alive"):
            print(
                f"Codex-dispatcher запущен: pid={process.pid}, "
                f"tier={'fast' if fast else 'configured-default'}, max_workers={max_workers}; {message}"
            )
            return 0
        if process.poll() is not None or last.get("status") == "failed":
            break
    detail = last.get("message") or f"процесс завершился с кодом {process.poll()}"
    print(f"Codex-dispatcher не запущен: {detail}", file=sys.stderr)
    return 1


def command_stop(state_dir: Path) -> int:
    payload = _status_payload(state_dir)
    pid = payload.get("pid")
    if not isinstance(pid, int) or not payload.get("alive"):
        print("Codex-dispatcher не запущен")
        return 0
    if not _pid_is_dispatcher(pid):
        print(f"PID {pid} не похож на taskworker Codex-dispatcher; не останавливаю", file=sys.stderr)
        return 1
    os.kill(pid, signal.SIGTERM)
    deadline = time.time() + STOP_TIMEOUT
    while time.time() < deadline:
        if not _pid_alive(pid):
            print(f"Codex-dispatcher остановлен: pid={pid}")
            return 0
        time.sleep(0.25)
    print(f"Codex-dispatcher pid={pid} не остановился за {STOP_TIMEOUT} с", file=sys.stderr)
    return 1


def build_parser():
    import argparse

    parser = argparse.ArgumentParser(prog="taskworker codex-dispatch")
    sub = parser.add_subparsers(dest="action", required=True)

    def common(p):
        p.add_argument("--state-dir", type=Path, default=default_state_dir())

    start = sub.add_parser("start", help="запустить Codex-dispatcher в фоне")
    common(start)
    start.add_argument("--worker-dir", type=Path, default=default_worker_dir())
    start.add_argument("--taskworker", default=taskworker_executable())
    start.add_argument("--max-workers", type=int, default=DEFAULT_MAX_WORKERS)
    start.add_argument("--fast", action="store_true", help="явно включить Codex Fast tier")

    status = sub.add_parser("status", help="показать здоровье dispatcher")
    common(status)
    status.add_argument("--json", action="store_true")

    stop = sub.add_parser("stop", help="точечно остановить dispatcher")
    common(stop)

    run = sub.add_parser("run", help="внутренний foreground-режим")
    common(run)
    run.add_argument("--worker-dir", type=Path, default=default_worker_dir())
    run.add_argument("--taskworker", default=taskworker_executable())
    run.add_argument("--max-workers", type=int, default=DEFAULT_MAX_WORKERS)
    run.add_argument("--fast", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.action == "start":
        if args.max_workers < 1:
            print("--max-workers должен быть >= 1", file=sys.stderr)
            return 2
        return command_start(
            state_dir=args.state_dir.resolve(),
            worker_dir=args.worker_dir.resolve(),
            taskworker=args.taskworker,
            max_workers=args.max_workers,
            fast=args.fast,
        )
    if args.action == "status":
        return command_status(args.state_dir.resolve(), as_json=args.json)
    if args.action == "stop":
        return command_stop(args.state_dir.resolve())
    if args.max_workers < 1:
        print("--max-workers должен быть >= 1", file=sys.stderr)
        return 2
    supervisor = Supervisor(
        state_dir=args.state_dir.resolve(),
        worker_dir=args.worker_dir.resolve(),
        taskworker=args.taskworker,
        max_workers=args.max_workers,
        fast=args.fast,
    )
    return supervisor.run()


if __name__ == "__main__":
    raise SystemExit(main())
