#!/usr/bin/env python3
"""
FastAPI-сервер поверх модели (nodes+edges в semcore.db).

GET /api/expand?q=<фраза>
  -> если пул фразы ещё не запрашивался, тянет XMLRiver (кэш) и пишет в модель;
     затем отдаёт ПРОЕКЦИЮ пула из модели: локальная вложенность по словам +
     метки cached(queried)/childCount(total_refinements) для двухцветного "+".
  Модель персистентна: раскрытое переживает перезапуск; узлы — задел под скоринг.

GET /  -> собранный React-фронт (frontend/dist).

Запуск: conda run -n research3.12 uvicorn server:app --port 8000 --reload
"""
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles

import wscore

app = FastAPI(title="Wordstat tree")
ROOT = Path(__file__).parent
DIST = ROOT / "frontend" / "dist"


@app.get("/api/expand")
def expand(q: str = Query(..., description="Фраза-маркер")):
    qn = wscore.normalize(q)
    con = wscore.connect()
    try:
        row = con.execute(
            "SELECT queried, freq, total_refinements FROM node WHERE phrase = ?", (qn,)
        ).fetchone()
        if not row or not row[0]:
            own_freq, total = wscore.load_phrase(con, qn)  # ещё не запрашивали -> тянем
        else:
            own_freq, total = row[1], row[2]
        children = wscore.project(con, qn)
        return {"query": qn, "freq": own_freq, "total": total,
                "count": len(children), "children": children}
    finally:
        con.close()


# Фронт (React build). Монтируется последним, чтобы не перехватывать /api.
if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="app")
