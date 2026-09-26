from __future__ import annotations

from sqlalchemy.orm import Session

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import errors, monitor, payments, presence, sites, store, tariffs
from .config import settings
from .db import get_db
from .deps import ghost_session, optional_user
from .models import User
from .http_errors import LocalizedHTTPException, message_translations
from .routers import ROUTERS
from .schemas import PulseIn
from .i18n import current_locale, negotiate_locale, using_locale, validation_message, say


def create_app() -> FastAPI:
    settings.check()
    sites.profiles()
    # Локальное хранилище чистится ровно здесь, при поднятии приложения: ленивая чистка при первой
    # печати снесла бы файлы, ссылки на которые уже выданы.
    store.prepare()
    app = FastAPI(title=settings.app_name, version="0.1.0",
                  docs_url="/api/docs", openapi_url="/api/openapi.json")
    if settings.origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "Accept-Language"],
        )
    for router in ROUTERS:
        app.include_router(router, prefix=settings.api_prefix)

    @app.get(f"{settings.api_prefix}/tariffs", tags=["service"])
    def tariff_list(db: Session = Depends(get_db)) -> dict:
        # справочник читается из базы: цену меняем часто, пересборка для этого не нужна.
        # test_payments говорит витрине, чем принимаются деньги: предупреждение «оплата тестовая»
        # было вшито в страницу и показывалось на боевом терминале после списания 250 рублей.
        connections = payments.available()
        return {"items": [t.public() for t in tariffs.public_tariffs(db)], "free_sections": 2,
                "payment_providers": [{"id": c.id, "provider": c.provider} for c in connections],
                "test_payments": bool(connections) and all(c.provider == "mock" for c in connections)}

    @app.middleware("http")
    async def watch_failures(request: Request, call_next):
        return await errors.watch(request, call_next)

    @app.middleware("http")
    async def localize_request(request: Request, call_next):
        origin = request.headers.get(sites.HEADER)
        site = sites.find(origin) if origin else None
        locale = negotiate_locale(request.headers.get("accept-language"),
                                  default=site.default_locale if site else None)
        if origin and site is None:
            with using_locale(locale):
                messages = message_translations(lambda: say("site.invalid"))
                return JSONResponse({"detail": messages[locale], "messages": messages}, status_code=400)
        if site and (not request.headers.get("accept-language") or locale not in site.locales):
            locale = site.default_locale
        with using_locale(locale), sites.using_site(site):
            response = await call_next(request)
            response.headers["Content-Language"] = locale
            return response

    @app.post(f"{settings.api_prefix}/pulse", tags=["service"])
    def pulse(body: PulseIn, request: Request,
              user: User | None = Depends(optional_user),
              ghost: bool = Depends(ghost_session)) -> dict:
        """Отметка «я здесь» раз в 45 секунд. Онлайн остаётся в памяти; для вошедшего пользователя
        последнее появление копится там же и записывается в БД только почасовым пакетом.

        Админ, вошедший под чужим аккаунтом, появлением этого человека не считается: иначе
        «последнее появление» в админке показывало бы визит админа вместо визита покупателя.
        """
        presence.touch(body.visitor, body.path, request.headers.get("user-agent", ""), tab=body.tab)
        if user is not None and not ghost:
            presence.touch_user(user.id)
        return {"ok": True}

    @app.exception_handler(LocalizedHTTPException)
    def localized_error(_request: Request, exc: LocalizedHTTPException) -> JSONResponse:
        return JSONResponse({"detail": exc.detail, "messages": exc.messages},
                            status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(ValueError)
    def value_error(_request: Request, exc: ValueError) -> JSONResponse:
        # движок валидирует дату сам: будущее и до 1900 года — это 400, а не 500
        messages = message_translations(lambda: validation_message(exc))
        return JSONResponse({"detail": messages[current_locale()], "messages": messages}, status_code=400)

    # Имена полей приходят из схем и печатались покупателю как есть: «Проверьте поля: password»
    # не говорит ни что не так, ни что делать.
    # После «проверьте» нужен винительный падеж. Именительный давал покупателю фразы вроде
    # «Проверьте почта» ровно в момент отказа формы.
    FIELD_NAMES = {"email": "почту", "password": "пароль", "title": "название",
                   "birth": "дату рождения", "sex": "пол", "token": "ссылку",
                   "tariff": "тариф", "matrix_id": "дату", "source": "источник"}
    FIELD_LIMITS = {"password": "пароль — от 3 до 200 знаков",
                    "email": "почта — в виде you@mail.ru, не длиннее 200 знаков",
                    "title": "название — не длиннее 200 знаков"}

    @app.exception_handler(RequestValidationError)
    def schema_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # по контракту detail всегда строка; список ошибок уезжает отдельным полем
        fields = [str(part) for err in exc.errors() for part in err["loc"][1:]] or ["тело запроса"]
        unique = list(dict.fromkeys(fields))
        def render() -> str:
            english = current_locale() == "en"
            names = ({"email": "email", "password": "password", "title": "title", "birth": "birth date",
                      "sex": "sex", "token": "link", "tariff": "plan", "matrix_id": "date", "source": "source"}
                     if english else FIELD_NAMES)
            rules = ({"password": "password must contain 3–200 characters",
                      "email": "use an email such as you@example.com, up to 200 characters",
                      "title": "title must not exceed 200 characters"} if english else FIELD_LIMITS)
            named = [names.get(f, "request body" if english and f == "тело запроса" else f) for f in unique]
            limits = [rules[f] for f in unique if f in rules]
            detail = ("Check " if english else "Проверьте ") + ", ".join(named) + "."
            if limits:
                detail += " " + "; ".join(limits) + "."
            return detail

        messages = message_translations(render)
        return JSONResponse(
            {"detail": messages[current_locale()], "messages": messages,
             "errors": [{"loc": list(e["loc"]), "type": e["type"]} for e in exc.errors()]},
            status_code=422,
        )

    monitor.start()
    presence.start()
    return app


app = create_app()
