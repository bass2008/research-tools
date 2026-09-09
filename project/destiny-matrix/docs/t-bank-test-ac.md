# Тестовый эквайринг Т-Банка

## Карты

| Карта | Срок | CVC | Для чего |
|---|---|---|---|
| `4300 0000 0000 0777` | 12/30 | 111 | оплата |
| `4300 0000 0000 0785` | 12/30 | 111 | отказ |
| `4000 0000 0000 0101` | 12/30 | 111 | чеки |
| `5000 0000 0000 0108` | 12/30 | 111 | возвраты |

В прогонах оплата идёт картой `4000 0000 0000 0101` (`e2e/flows.py`, `GOOD_CARD`), отказ —
`4300 0000 0000 0785` (`BAD_CARD`), возврат — `5000 0000 0000 0108` (`REFUND_CARD`).

## Локальный стенд с живым тестовым терминалом

```bash
PAYMENT_PROVIDER=tbank bash compose/scripts/run.sh
curl -s http://127.0.0.1:3000/api/tariffs   # test_payments: false — деньги идёт принимать банк
```

Ключи терминала подхватываются сами: `compose/docker-compose.override.yml` подключает
`~/.config/arcana/tbank.env` (`TBANK_TERMINAL_KEY`, `TBANK_PASSWORD`) как `env_file` для api.
Экспортировать их руками не нужно. Без ключей api остаётся в мок-режиме молча.

Ключ обязан быть тестовым — с суффиксом `DEMO`. Скрипт `compose/scripts/run-python-with-test-tbank.sh`
(он для python-утилит, не для стенда) проверяет это и с боевым ключом не запускается: каждая покупка
в прогоне списывала бы настоящие деньги.

Уведомление банка на `localhost` не доходит — доступ открывается по возврату на `/pay/done`.

Прогон, который ходит на живую форму банка:

```bash
cd e2e && SSL_CERT_FILE=~/.config/arcana/ca-bundle.pem \
  /home/sergey/miniconda3/envs/research3.12/bin/python -m pytest -m bank -q
```

Остальные браузерные наборы на таком стенде не гонять: они начнут создавать платежи в банке.
Обратно на мок — `bash compose/scripts/run.sh` без переменной.

## test.arcana-sense.ru

Тестовый контур на той же машине, что прод, но со своей базой (том `test-api-var`), тестовым
терминалом (`PAYMENT_PROVIDER=tbank`), письмами в лог и без счётчика Метрики.
Релиз — `compose/scripts/release-test.sh`.

Логин и пароль — `~/.config/arcana/test-auth.env` (`TEST_BASIC_USER`, `TEST_BASIC_PASSWORD`), вне
репозитория. Оттуда их читают `infra/bootstrap-machine.sh` (раскладывает хеш в
`/etc/nginx/.htpasswd-test` на машине) и `e2e/conftest.py`.

Пароль стоит от ботов и сканеров, а не от людей: `infra/nginx/arcana-test.conf`, там же
`X-Robots-Tag: noindex, nofollow`. Без пароля открыты только `/api/payments/notify` (вебхук банка)
и `/api/health`.

Ходить на `test` — когда есть реальная необходимость. Единственное, чего нельзя получить локально, —
уведомление банка приходит по настоящему адресу.
