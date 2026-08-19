# Схема базы

SQLite. Миграций на этапе разработки нет намеренно: таблицы можно ронять и создавать заново.

```
python -m app.schema ensure   # создать недостающее и наполнить справочник тарифов
python -m app.schema reset    # снести всё и создать заново
```

`reset` уносит платежи вместе с таблицами. **В день первой живой продажи миграции надо вернуть.**

Две настройки соединения обязательны и включены в `models.py`: `PRAGMA foreign_keys=ON` — без него
`ON DELETE CASCADE` ниже не работает вовсе, и `journal_mode=WAL` — без него читатель блокирует
писателя. Плюс `busy_timeout=5000`, чтобы конкурентная запись ждала, а не падала.

## SQL

```sql
-- Витрина и правила доступа. Цену меняем часто, поэтому она в базе, а не в коде.
CREATE TABLE tariffs (
    id           VARCHAR(16)  NOT NULL PRIMARY KEY,   -- 'single' | 'month'
    name         VARCHAR(64)  NOT NULL,
    price        INTEGER      NOT NULL,               -- копейки
    scope        TEXT         NOT NULL,               -- JSON-массив: ["single","matrix","all"]
    period_days  INTEGER                              -- NULL — бессрочно
);

CREATE TABLE users (
    id             INTEGER      NOT NULL PRIMARY KEY,
    email          VARCHAR(320) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE matrices (
    id          INTEGER      NOT NULL PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    birth       DATE         NOT NULL,
    sex         VARCHAR(1)   NOT NULL,                -- 'm' | 'f'
    title       VARCHAR(200),
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_matrices_user_id ON matrices (user_id);

-- Деньги. Снимок тарифа обязателен: цену меняем часто, история переписываться не должна.
CREATE TABLE payments (
    id           INTEGER      NOT NULL PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tariff_body  TEXT         NOT NULL,               -- JSON тарифа на момент покупки
    amount       INTEGER      NOT NULL,               -- уплачено, копейки
    matrix_id    INTEGER      REFERENCES matrices(id) ON DELETE SET NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- платёж начат
    paid_at      DATETIME,                            -- NULL — не оплачен
    refunded_at  DATETIME,
    external_id  VARCHAR(64)  NOT NULL UNIQUE         -- 'mock-…', позже номер провайдера
);
CREATE INDEX ix_payments_user_id ON payments (user_id);
CREATE UNIQUE INDEX ix_payments_external_id ON payments (external_id);

-- Право доступа. Отдельно от платежа: доступ бывает без денег (промо, компенсация),
-- а платёж бывает без доступа (возврат, брошенная попытка).
CREATE TABLE entitlements (
    id          INTEGER   NOT NULL PRIMARY KEY,
    user_id     INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id  INTEGER   REFERENCES payments(id) ON DELETE SET NULL,
    scope       TEXT      NOT NULL,                   -- JSON-массив, снимок из тарифа
    matrix_id   INTEGER   REFERENCES matrices(id) ON DELETE CASCADE,
    starts_at   DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME,                             -- NULL — бессрочно
    revoked_at  DATETIME,                             -- отзыв: возврат, злоупотребление
    note        VARCHAR(120)                          -- «промо», «компенсация»
);
CREATE INDEX ix_entitlements_user_id ON entitlements (user_id);

CREATE TABLE leads (
    id          INTEGER      NOT NULL PRIMARY KEY,
    email       VARCHAR(320) NOT NULL UNIQUE,         -- отсюда идемпотентность
    source      VARCHAR(64),                          -- 'pay:single', 'landing'
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX ix_leads_email ON leads (email);
```

## Связи

```
users ─┬─< matrices        (CASCADE)
       ├─< payments        (CASCADE)
       └─< entitlements    (CASCADE)

matrices ─< payments.matrix_id      (SET NULL — платёж переживает удаление матрицы)
matrices ─< entitlements.matrix_id  (CASCADE — право без матрицы бессмысленно)
payments ─< entitlements.payment_id (SET NULL — право переживает чистку платежей)

leads — ни с чем: почту оставляют до регистрации, привязывать её не к чему.
```

## Тарифы

| id | name | price | scope | period_days |
|---|---|---|---|---|
`single` | Полный разбор одной даты | 10 000 (100 ₽) | `["single"]` | NULL — бессрочно
`month` | Три месяца без ограничений | 24 000 (240 ₽) | `["single","matrix","all"]` | 90

В витрину выводится только `single` — список задан в `app/tariffs.py`, `PUBLIC_IDS`. Подписка
остаётся в справочнике: права под неё написаны и проверены тестами, вернуть её — дописать `month`
в этот список.

Цены намеренно низкие: проверяем, платят ли вообще, а не сколько. Меняются `UPDATE`-ом, пересборка
для этого не нужна: лендинг, страница оплаты и оферта печатаются на запрос и читают прайс отсюда,
а статика энциклопедии подтягивает его в браузере через `GET /api/tariffs`. Новая цена попадает и в
снимок платежа — `payments.tariff_body` пишется на момент покупки, поэтому история не переписывается.

## Виды доступа

| scope | что даёт |
|---|---|
`single` | один разбор по одной дате — право привязано к матрице через `matrix_id` |
`matrix` | хранить любое число матриц в кабинете; без него слотов столько, сколько куплено разборов, плюс один бесплатный |
`all` | без ограничения числа дат — открывает любую матрицу и расчёт «на лету» |

## Как считается доступ

Ни `users`, ни платёж не решают, что открыто, — решают действующие права. Право действует, если
`revoked_at IS NULL`, `starts_at` уже прошёл и `expires_at` либо пуст, либо в будущем.

Полный разбор матрицы открыт, когда есть действующее право со `all`, либо право с `single`, чей
`matrix_id` совпадает с открываемой матрицей. Расчёт без сохранения открывается только `all`:
разовому праву не к чему привязаться.

**Как разовое право находит свою дату.** Дату выбирает человек на экране оплаты, и наверх уходит
её `matrix_id` — сама дата рождения в платёжный запрос не входит, так обещано в оферте. Если дата не
выбрана («выберу позже»), право приходит с `matrix_id IS NULL` и привязывается один раз: на оплате — к
последней сохранённой матрице, **которая ещё не оплачена**; если оплачены все — к первой матрице,
которую сохранят после оплаты (`access.bind_single`). Привязка происходит только на записи; чтение
разбора прав не меняет. Проверка «ещё не оплачена» обязательна: без неё второй разовый платёж садился
на уже открытую дату, и деньги не открывали ничего.

**Сколько дат можно хранить.** Разовый тариф покупают сколько угодно раз, поэтому лимит хранения
считается по правам: одна дата бесплатно (иначе вход в кабинет бессмыслен) плюс по одной за каждое
действующее разовое право. Право `matrix` снимает счёт совсем. Число отдаётся в `matrices_limit`
(`GET /auth/me`), `null` — без ограничения. Повторное сохранение той же даты слот не тратит:
`POST /matrices` возвращает уже существующую матрицу.

В кабинете это видно построчно: `GET /matrices` отдаёт по каждой дате `access` —
`forever` (куплена бессрочным правом), `subscription` с `access_until` (открыта, пока жива
подписка) или `locked` (закрыта, можно выкупить).

Следствие, которое стоит держать в голове: срочный тариф истекает через 90 дней, и разборы
закрываются, а матрицы в кабинете остаются. Купленный `single` не истекает никогда — поэтому за
единицу срочный доступ и стоит дешевле разового: он даёт посмотреть многих, а не оставить себе.
