# API: FastAPI + движок расчёта. Контекст сборки — корень продукта (project/destiny-matrix),
# потому что api импортирует пакет `engine`, а энциклопедию читает из `web/content`.
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/srv

WORKDIR /srv

COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Порядок слоёв — от редко меняющегося к часто: контент энциклопедии 12,6 МБ переезжал бы при
# каждой правке кода, если бы стоял после него. Код идёт последним и весит 200 кБ.
COPY web/content ./web/content
COPY engine ./engine
COPY api/app ./api/app

WORKDIR /srv/api

# SQLite лежит в томе: контейнер пересоздаётся, платежи остаются
ENV DATABASE_URL=sqlite+pysqlite:////srv/api/var/api.db

EXPOSE 8010

# Схема создаётся из моделей (миграций на этапе разработки нет намеренно) и наполняется
# справочником тарифов и админом — иначе на пустом томе не с чем работать.
CMD ["sh", "-c", "python -m app.schema ensure && exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8010"]
