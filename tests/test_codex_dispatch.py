"""Встроенный Codex-dispatcher: CLI, сигналы и формирование исполнителей."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import pytest

from taskworker import codex_dispatch
from taskworker import mcp_server


def test_parse_signals_accepts_only_short_safe_envelopes():
    assert codex_dispatch.parse_signals(
        '[{"job_id":"abc:0","type":"needs"},{"job_id":"x-2:1","type":"adjacent"}]'
    ) == [("abc:0", "needs"), ("x-2:1", "adjacent")]

    for bad in ('{}', '[1]', '[{"job_id":"a;rm","type":"needs"}]', '[{"job_id":"a:0"}]'):
        with pytest.raises(ValueError):
            codex_dispatch.parse_signals(bad)

    assert codex_dispatch.parse_signals(
        '[{"job_id":"c:0","type":"model_test","model_family":"codex"}]',
        model_family="codex",
    ) == [("c:0", "model_test")]
    with pytest.raises(ValueError, match="чужое семейство"):
        codex_dispatch.parse_signals(
            '[{"job_id":"x:0","type":"model_test","model_family":"claude"}]',
            model_family="codex",
        )


@pytest.mark.parametrize(
    ("job_type", "model", "effort"),
    [
        ("needs", "gpt-5.6-sol", "xhigh"),
        ("needs_refine", "gpt-5.6-sol", "xhigh"),
        ("needs_rank", "gpt-5.6-sol", "xhigh"),
        ("analyze_product", "gpt-5.6-sol", "xhigh"),
        ("model_test", "gpt-5.6-luna", "low"),
        ("season", "gpt-5.6-terra", "low"),
        ("adjacent", "gpt-5.6-terra", "medium"),
        ("stopwords", "gpt-5.6-terra", "low"),
        ("future_type", "gpt-5.6-sol", "xhigh"),
    ],
)
def test_worker_command_pins_model_effort_and_fast(tmp_path, monkeypatch, job_type, model, effort):
    logs = tmp_path / "project-logs"
    monkeypatch.setattr(codex_dispatch, "log_dir", lambda: logs)
    command, final_path, worker_log, got_model, got_effort = codex_dispatch.build_worker_command(
        "deadbeef:0",
        job_type,
        worker_dir=tmp_path / "worker",
        state_dir=tmp_path / "state",
        fast=True,
    )

    assert command[:6] == [
        "codex", "--ask-for-approval", "never", "--search", "exec", "--ephemeral"
    ]
    assert command.index("--ask-for-approval") < command.index("exec")
    assert command.index("--search") < command.index("exec")
    assert command[command.index("--model") + 1] == model
    assert f'model_reasoning_effort="{effort}"' in command
    assert 'mcp_servers.taskworker.enabled_tools=["get_job","submit_result"]' in command
    assert 'mcp_servers.taskworker.required=true' in command
    assert 'mcp_servers.taskworker.tools.get_job.approval_mode="approve"' in command
    assert 'mcp_servers.taskworker.tools.submit_result.approval_mode="approve"' in command
    assert "features.fast_mode=true" in command
    assert 'service_tier="fast"' in command
    assert command[command.index("--add-dir") + 1] == str(logs)
    assert "taskworker.get_job" in command[-1]
    assert "Если get_job объявил params.input_file" in command[-1]
    assert "~/.codex/sessions" in command[-1]
    assert "SUBMITTED deadbeef:0" in command[-1]
    assert final_path.name == "deadbeef_0.final.txt"
    assert worker_log.name == "deadbeef_0.log"
    assert (got_model, got_effort) == (model, effort)


def test_large_server_job_uses_declared_input_and_result_files(tmp_path, monkeypatch):
    monkeypatch.setattr(mcp_server, "log_dir", lambda: tmp_path)
    job = {"job_id": "large:0", "type": "analyze_product",
           "params": {"blob": "я" * 60000}, "prompt": "строгий prompt"}

    compact = mcp_server._job_for_agent(job)
    input_file = Path(compact["params"]["input_file"])
    result_file = Path(compact["result_file"])

    assert json.loads(input_file.read_text(encoding="utf-8")) == job
    assert hashlib.sha256(input_file.read_bytes()).hexdigest() == compact["params"]["input_sha256"]
    assert input_file.stat().st_mode & 0o777 == 0o600
    result_file.write_text('{"ok":true}', encoding="utf-8")
    assert mcp_server._result_from_server_file("large:0") == ({"ok": True}, None)


def test_small_server_job_stays_inline():
    job = {"job_id": "small:0", "type": "season",
           "params": {"phrase": "телеграм"}, "prompt": "короткий prompt"}

    assert mcp_server._job_for_agent(job) is job


def test_standard_worker_does_not_force_fast(tmp_path, monkeypatch):
    monkeypatch.setattr(codex_dispatch, "log_dir", lambda: tmp_path / "logs")
    command, *_ = codex_dispatch.build_worker_command(
        "a:0", "season", worker_dir=tmp_path, state_dir=tmp_path, fast=False
    )
    assert "features.fast_mode=true" not in command
    assert 'service_tier="fast"' not in command


def test_ingest_is_durable_and_deduplicates(tmp_path):
    supervisor = codex_dispatch.Supervisor(
        state_dir=tmp_path,
        worker_dir=tmp_path,
        taskworker="taskworker",
        max_workers=2,
        fast=False,
    )
    supervisor.prepare()
    ledger = {"version": 1, "jobs": {}}

    assert supervisor.ingest(ledger, [("one:0", "needs")]) == 1
    assert supervisor.ingest(ledger, [("one:0", "needs")]) == 0
    saved = json.loads((tmp_path / "ledger.json").read_text(encoding="utf-8"))
    assert saved["jobs"]["one:0"]["status"] == "pending"


def _write_executable(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")
    path.chmod(0o755)


def test_background_start_status_stop_without_generated_script(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_taskworker = fake_bin / "taskworker"
    fake_codex = fake_bin / "codex"
    state_dir = tmp_path / "state"
    worker_dir = tmp_path / "worker"
    worker_dir.mkdir()

    _write_executable(
        fake_taskworker,
        f"""#!{sys.executable}
import os, pathlib, sys, time
args = sys.argv[1:]
if args[args.index('--model-family') + 1] != 'codex':
    raise SystemExit(9)
timeout = float(args[args.index('--timeout') + 1])
counter = pathlib.Path(os.environ['FAKE_WATCH_COUNTER'])
seen = int(counter.read_text() or '0') if counter.exists() else 0
counter.write_text(str(seen + 1))
if seen == 0:
    print('[{{"job_id":"fake:0","type":"season"}}]', flush=True)
elif timeout > 2:
    time.sleep(30)
else:
    print('[]', flush=True)
""",
    )
    _write_executable(
        fake_codex,
        f"""#!{sys.executable}
import os, sys
args = sys.argv[1:]
if args == ['--version']:
    print('codex-cli fake')
elif args[:3] == ['mcp', 'get', 'taskworker']:
    print('taskworker')
    print('  command: ' + os.environ['FAKE_TASKWORKER'])
    print('  args: mcp')
elif 'exec' in args:
    final = args[args.index('--output-last-message') + 1]
    pathlib = __import__('pathlib')
    pathlib.Path(final).write_text('SUBMITTED fake:0 season result\\n')
    print('SUBMITTED fake:0 season result')
else:
    raise SystemExit(2)
""",
    )
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    env["FAKE_TASKWORKER"] = str(fake_taskworker)
    env["FAKE_WATCH_COUNTER"] = str(tmp_path / "watch-counter")
    base = [sys.executable, "-m", "taskworker.codex_dispatch"]

    started = subprocess.run(
        base
        + [
            "start",
            "--state-dir",
            str(state_dir),
            "--worker-dir",
            str(worker_dir),
            "--taskworker",
            str(fake_taskworker),
            "--fast",
        ],
        env=env,
        text=True,
        capture_output=True,
        timeout=30,
    )
    assert started.returncode == 0, started.stdout + started.stderr
    assert not (state_dir / "supervisor.py").exists()
    assert (state_dir / "bootstrap.log").stat().st_mode & 0o777 == 0o600

    deadline = time.time() + 10
    while True:
        status = subprocess.run(
            base + ["status", "--state-dir", str(state_dir), "--json"],
            env=env,
            text=True,
            capture_output=True,
            timeout=10,
        )
        payload = json.loads(status.stdout)
        if payload.get("counts", {}).get("finished") == 1 or time.time() >= deadline:
            break
        time.sleep(0.1)
    assert status.returncode == 0
    assert payload["alive"] is True
    assert payload["status"] == "running"
    assert payload["fast_mode"] is True
    assert payload["model_family"] == "codex"
    assert payload["counts"]["finished"] == 1

    stopped = subprocess.run(
        base + ["stop", "--state-dir", str(state_dir)],
        env=env,
        text=True,
        capture_output=True,
        timeout=25,
    )
    assert stopped.returncode == 0, stopped.stdout + stopped.stderr
