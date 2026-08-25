from __future__ import annotations

from sqlalchemy.orm import Session

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import errors, monitor, payments, presence, tariffs
from .db import get_db
from .config import settings
from .routers import ROUTERS
from .schemas import PulseIn


def create_app() -> FastAPI:
    settings.check()
    app = FastAPI(title=settings.app_name, version="0.1.0",
                  docs_url="/api/docs", openapi_url="/api/openapi.json")
    if settings.origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )
    for router in ROUTERS:
        app.include_router(router, prefix=settings.api_prefix)

    @app.get(f"{settings.api_prefix}/tariffs", tags=["service"])
    def tariff_list(db: Session = Depends(get_db)) -> dict:
        # справочник читается из базы: цену меняем часто, пересборка для этого не нужна.
        # test_payments говорит витрине, чем принимаются деньги: предупреждение «оплата тестовая»
        # было вшито в страницу и показывалось на боевом терминале после списания 250 рублей.
        provider = payments.active()
        return {"items": [t.public() for t in tariffs.public_tariffs(db)], "free_sections": 2,
                "test_payments": provider is None or provider.name == "mock"}

    @app.middleware("http")
    async def watch_failures(request: Request, call_next):
        return await errors.watch(request, call_next)

    @app.post(f"{settings.api_prefix}/pulse", tags=["service"])
    def pulse(body: PulseIn, request: Request) -> dict:
        """Отметка «я здесь» раз в 45 секунд. Ничего не сохраняет в базу: только счётчик в памяти,
        по которому админка показывает, сколько человек на сайте сейчас."""
        presence.touch(body.visitor, body.path, request.headers.get("user-agent", ""))
        return {"ok": True}

    @app.exception_handler(ValueError)
    def value_error(_request: Request, exc: ValueError) -> JSONResponse:
        # движок валидирует дату сам: будущее и до 1900 года — это 400, а не 500
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(RequestValidationError)
    def schema_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # по контракту detail всегда строка; список ошибок уезжает отдельным полем
        fields = [str(part) for err in exc.errors() for part in err["loc"][1:]] or ["тело запроса"]
        return JSONResponse(
            {"detail": "Проверьте поля: " + ", ".join(dict.fromkeys(fields)),
             "errors": [{"loc": list(e["loc"]), "type": e["type"]} for e in exc.errors()]},
            status_code=422,
        )

    monitor.start()
    return app


app = create_app()
