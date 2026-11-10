# Сервер мобильного приложения

Локальная реализация для проверки APK. Реальная Google Play Console пока не настроена:
сервисные ключи, товары, license testers и публичный RTDN не проверены с Google.

## Локальный запуск

Штатный `compose/scripts/run-python.sh` применяет `app.schema ensure`; миграция
`014_mobile_accounts` добавляет поля удаления и таблицы Google без пересоздания пользователей.
Стандартный локальный администратор сохраняется. Для имитации оплаты:

```bash
GOOGLE_PLAY_MOCK=1 MOCK_PAYMENTS=1 ./compose/scripts/run-python.sh
```

Мок не включается в `APP_ENV=prod/production`, даже если обе переменные выставлены.
Отдельно включается экран мок-покупки в тестовом APK. Серверные тесты используют временные БД.

## HTTP-контракт

Все перечисленные пути есть и в FastAPI, и в BFF Next.js. BFF принимает мобильную
сессию в `X-Arcana-Session`; web продолжает использовать httpOnly cookie.

- `GET /api/mobile/billing/status`: `provider`, `products`, `subscriptions`. Токенов покупки нет.
- `POST /api/mobile/billing/orders`: `{product_id, reading_id? , inputs?}`.
  `product_id`: `single`, `pair`, `month`. Для single — `{birth,sex}`, для pair —
  `{a:{birth,name?},b:{birth,name?}}`; month без ввода. Ответ содержит `order_id`,
  `product_id`, `reading_id`, `obfuscated_account_id`, `obfuscated_profile_id`, `provider`.
- `POST /api/mobile/billing/verify`: `{product_id,purchase_token,order_id?}`.
- `POST /api/mobile/billing/restore`: `{purchases:[{product_id,purchase_token}]}`.
  Сверяются и известные серверу покупки; consumed single/pair остаются в правах аккаунта.
  Ответ `{items,failed}`: сетевой отказ не отнимает прежние права.
- `POST /api/mobile/billing/mock`: `{order_id,state}`. Состояния `pending`, `purchased`,
  `canceled`, `refunded`; подписные `renewed`, `grace`, `hold`, `expired`.
- Результат verify/mock: `order_id`, `product_id`, `reading_id`, `state`, `access`,
  `expires_at`, `auto_renewing`, `finalized`. Только mock дополнительно возвращает тестовый токен.
- `POST /api/mobile/account/delete`: `{current_password}`. Ответ `{token,user,deletion}`.
  `deletion`: `requested_at`, `delete_at`, `renewal_cancellation: complete|pending`.
- `GET /api/mobile/account/deletion`, `POST /api/mobile/account/restore {}` принимают
  ограниченный токен восстановления. Restore возвращает обычный `{token,user}`.
- Вход во время 30-дневного периода возвращает ограниченный токен и `deletion`.
  Он не подходит для обычных API и покупок. Восстановление не включает автопродление обратно.
- Веб-путь `/ru/account/delete` или `/en/account/delete` позволяет удалить/восстановить
  аккаунт без приложения. Ссылка есть в профиле; стандартный login/reset направляет сюда
  при отложенном удалении. Администратор удаляется отдельно, как и смена его адреса.

## Реальный Google Play

Сервер использует `google-auth` и Developer API. Настройки вне репозитория:

```text
GOOGLE_PLAY_ENABLED=1
GOOGLE_PLAY_CREDENTIALS=/absolute/path/to/service-account.json
GOOGLE_PLAY_PACKAGE=com.arcanasense.app
GOOGLE_PLAY_RTDN_AUDIENCE=https://<public-host>/api/mobile/billing/rtdn
GOOGLE_PLAY_RTDN_EMAIL=<push-service-account-email>
```

В BillingFlow необходимо передавать **оба** непрозрачных идентификатора заказа.
Сервер сопоставляет их с данными, возвращёнными Google. Дата/имена не передаются Google.
Товары `single` и `pair` — consumable; `month` — автоматически продлеваемая подписка
с базовым планом `quarterly` на три месяца. Клиент отображает локализованную цену из Billing.

`purchaseToken` имеет уникальный хеш в БД и связан с одним заказом/аккаунтом. Права
фиксируются до consume/acknowledge; сбой подтверждения повторяется при restore и sweep.
Google expiryTime — единственный источник срока реальной подписки. Grace сохраняет
доступ, hold/paused/expired закрывают; отмена продления оставляет оплаченный срок.
Voided Purchases дополнительно снимает возвращённые разовые покупки. Для подписок
решение принимает текущее subscriptionsv2: старый возвращённый renewal не должен закрыть
поздний оплаченный период с тем же токеном.

Pub/Sub push на `/api/mobile/billing/rtdn` требует Google OIDC JWT с точными audience,
email и email_verified. `messageId` дедуплицируется; уведомление заставляет заново запросить
Google, его номер состояния не используется как источник прав. Публичный endpoint должен
пропускать Google Authorization без Basic Auth. Настройка reverse proxy/публикация в этот
локальный этап не входит.

Сверка `python -m app.sweep` теперь также повторяет незавершённое подтверждение Google,
отключение продления и просроченную очистку аккаунтов. Уже существующее расписание сверки
должно оставаться включённым. Нового фонового сервиса нет.

До платного запуска требуется проверить реальные цены/финансовую историю: текущий ledger
фиксирует мок-цены EUR 5/8, а для Google сохраняет `amount_confirmed:false`, без выдуманного
пересчёта рублей. Суммы и отдельные операции продления нужно сверить с Google Orders API и
отчётами продавца при настройке реального профиля. Этот контур не заявлен готовым к продажам.

## Удаление и оставшиеся данные

Сразу увеличивается auth_version, отключаются обычные сессии и публичные share-ссылки,
сохраняется запрос отмены будущих списаний. Сбой Google оставляет cancellation_pending;
даже восстановление аккаунта не снимает этот запрос. Успех показывается после ответа Google.

Через 30 дней удаляются readings/individual_readings, entitlements, report_jobs,
account_operations, metrika_clients, пользовательские доставки уведомлений, все известные
и исторические PDF данного пользователя. Неудачная очистка хранилища повторяется.
У сохранённых административных уведомлений удаляются пользовательские поля; в security_audit
обнуляются email/IP, в журнале платёжной сверки удаляются email/error данного аккаунта.
Снимок покупки сокращается до платёжных полей без дат, имён, вопросов и email.

`users` сохраняется как `deleted-<id>@invalid` с недействительным паролем. Сохраняются
покупки/платежи, связи с обезличенной строкой, Google purchaseToken и технические состояния,
необходимые для поздних отмен/возвратов. Это псевдонимизация, а не обещание полной анонимности.
Срок обязательного хранения остаточных финансовых и Google-идентификаторов, основания,
международные документы и восстановление из backup подтверждаются до публикации.
