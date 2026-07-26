#!/usr/bin/env python3
"""Точка входа uvicorn для E2E: тот же server.app, ничего не подменяется, кроме таймаута
ожидания LLM.

Зачем: боевой таймаут — минуты (tasks.LLM_TIMEOUT), а сценарий 18 «петля не запущена»
проверяет именно падение по таймауту. Ждать 5 минут в браузерном тесте нельзя, поэтому
E2E_LLM_TIMEOUT задаёт секунды. Больше здесь ничего не происходит: маршруты, статика,
очередь и обмен джобами — настоящие.
"""
import os

import tasks
from server import app  # noqa: F401  (uvicorn берёт app отсюда)

_t = float(os.environ.get("E2E_LLM_TIMEOUT") or 0)
if _t > 0:
    tasks.LLM_TIMEOUT = {op: (_t, 0.0) for op in tasks.LLM_TIMEOUT}
