# Процесс релиза

**Ссылка на этот файл в задании = апрув.** Разрешены коммит, выкладка, починка найденных
дефектов. Подтверждений не спрашивать.

Ход не отдавать до последнего шага. Шаг ждёт фоновую задачу — блокирующее ожидание в том же
ходу, не отчёт. Выход раньше — только если препятствие не снять без владельца.

## 0. Предпосылки

```bash
cd /home/sergey/Personal/research-tools/project/destiny-matrix && git branch --show-current
```

Нужно: `yc` с токеном, `docker buildx`, ssh к `ubuntu@84.201.157.100`,
`~/.config/arcana/test-auth.env`. Python — `/home/sergey/miniconda3/envs/research3.12/bin/python`
(`conda run` глотает вывод). `~/.config/arcana/seo.env` не нужен: владение подтверждено DNS и
Метрикой.

Правился корпус (`web/content/**`, `tools/seo/content/**`) — сдвинуть `CONTENT_MODIFIED` в
`web/lib/schema.ts` на сегодня. Заголовок `Last-Modified` берётся не оттуда, а из `BUILD_ISO`.

## 1. Регресс

```bash
cd web
npm run typecheck
NEXT_PUBLIC_SITE_URL=https://arcana-sense.ru NEXT_PUBLIC_BUILD_ISO="$(date -u +%FT%TZ)" npm run build
npm run check
cd /home/sergey/Personal/research-tools
python tools/seo/build-content.py --check
python tools/seo/build-position-arcanum.py --check
python tools/seo/prepare-unified-release.py --check
cd project/destiny-matrix/web && PORT=3399 node .next/standalone/server.js &
```

На поднятом сервере, перебором, не выборочно:

- каждый адрес карты сайта: 200, `h1`, self-canonical, крошки;
- `robots.txt` парсером `protego`: результаты расчёта закрыты, ни один адрес карты не закрыт;
- `If-Modified-Since` с меткой сборки → 304, со старой датой → 200;
- `If-None-Match` со своим отпечатком → 304, с чужим → 200;
- приватное и результаты расчёта: без `Last-Modified`, 304 не отдают;
- адреса вне реестров → 404;
- новые страницы достижимы по внутренним ссылкам, не только из карты сайта.

Добавлялся корпус — ещё:

- нижняя граница длины текста статьи;
- похожесть страниц одного типа (6-словные шинглы, доля общего от меньшей). Принято на сайте:
  «на год» 3,6%, хвосты 6,1%, арканы 7,1%, сочетания 33,6%. Выше 40% — не выкладывать;
- прочитать 3–5 готовых страниц глазами: склейки, удвоения, падежи и обрубки замер не видит.

## 2. Юнит-тесты

```bash
cd project/destiny-matrix/web && npm test -- --run
cd ../api && python -m pytest -q
cd .. && PYTHONPATH=. python -m pytest content/tests -q
```

Гонять по отдельности. Стенд не нужен.

## 3. E2E

```bash
cd project/destiny-matrix/compose && PAYMENT_PROVIDER=mock MAIL_TO_LOG=1 ./scripts/run.sh
cd ../e2e && python -m pytest . -q     # ~17 мин
```

`PAYMENT_PROVIDER=mock` обязателен, иначе покупка уйдёт в банк.

Стенд обязан быть пересобран после последней правки — иначе прогон проверяет прошлую сборку:

```bash
docker inspect arcana-web-1 --format '{{.Created}}'   # сверить с mtime правленых файлов
```

Упавший тест разбирать по существу: он охранял обещание пользователю. Обещание перенести на
новый механизм, тест не удалять.

## 4. Коммит

Только на трёх зелёных этапах.

```bash
cd /home/sergey/Personal/research-tools
git add -A project/destiny-matrix tools/seo
git commit -F - <<'MSG'
<Название итерации> Release

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
```

Одна строка subject, без тела. Push не делать.

## 5. Выкладка

```bash
cd project/destiny-matrix/web
NEXT_PUBLIC_SITE_URL=https://arcana-sense.ru npm run build
cd ../compose
python scripts/release-manifest.py --output ../reports/unified/release-manifest.json --preflight passed
scripts/assert-release-candidate.sh
./scripts/release-test.sh              # пишет reports/unified/tested-commit.txt
```

Приёмка теста: версия = коммит, новые страницы отдаются, правки видны. Карта сайта и
`robots.txt` там закрыты намеренно — их проверять на локальной сборке с боевым адресом.

```bash
./scripts/release-prod.sh              # требует tested-commit.txt == HEAD
```

Откат: вернуть тег из `/srv/arcana/.env.previous.tag` в `.env`, `sudo systemctl restart arcana`.

## 6. Приёмка прода

```bash
curl -s https://arcana-sense.ru/version/current.txt
cd ../infra && BASE=https://arcana-sense.ru ./check.sh
```

Плюс на живом сайте: новые адреса 200 с `h1` и canonical; `robots.txt` и карта сайта содержат
ожидаемое; изменившиеся страницы отвечают 200 на старую дату; калькулятор и кнопка покупки на
месте.

## Ловушки

- **Занятый порт.** При `EADDRINUSE` старый процесс продолжает отвечать, и проверка читает
  прошлую сборку. Убивать по порту: `ss -lptnH "sport = :3399" | grep -oP 'pid=\K[0-9]+' | xargs -r kill`.
  `pkill -f` совпадает с собственной командной строкой и убивает свою оболочку.
- **`noindex` не запрещает обход** — робот качает страницу, чтобы прочитать мету. Экономит
  только `Disallow`.
- **`Allow: /`** Next печатает раньше запретов: парсер «первое совпадение» читает «всё открыто».
- **Дата корпуса** без сдвига `CONTENT_MODIFIED` даёт неверный `lastmod`. Сторож —
  `web/lib/contentModified.test.ts`.
- **Два адреса на один головной запрос** — каннибализация. Сторож — `web/lib/primaryQuery.test.ts`.
- **Скриптовая правка исходников** режет лишнее и оставляет битый синтаксис: файл дешевле
  перезаписать целиком. Сверять смысловое отличие, а не диф — переформатирование даёт 187 строк
  на правку двух полей.
- **Утверждать после проверки.** Каждое «поле пустое», «маршрут есть», «Вебмастер не подключён»
  до проверки стоило круга на опровержение.

## Результат

| Этап | Дефект | Приоритет | Суть, когда возникает | Исправлено |
|---|---|---|---|---|
| регресс / юнит-тесты / e2e / во время выкатки / после выкатки | что именно | критический / высокий / средний / низкий | при каких условиях проявляется и чем грозит | да / нет |

Критический — релиз опасен: потеря данных, поломка оплаты или входа, страница вне индекса или
наоборот, 304 на изменившееся, неверный расчёт. Чинить до выкладки без спроса.

Последняя строка:

**РЕЗУЛЬТАТ: РЕЛИЗ ВЫПОЛНЕН** — коммит, тег образов, адрес.
**РЕЗУЛЬТАТ: РЕЛИЗ НЕ ВЫПОЛНЕН** — что не сошлось, на каком шаге, что нужно от владельца.
