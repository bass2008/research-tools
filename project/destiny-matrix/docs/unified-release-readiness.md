# Единый release candidate: локальная готовность

Дата: **30 августа 2026**. Выкладка не выполнялась. После удаления самовольно добавленного
событийного контура повторно пройдены исходные unit/content/build-gates и целевой browser-тест
счётчика присутствия. Полный `compose/scripts/run-tests.sh` перед будущим релизом нужно запустить
заново: прежний manifest относится к другому составу release candidate и доказательством не
считается.

## Что входит в один будущий релиз

- контракт и одинаковый Python/TypeScript-движок;
- перегенерированные core JSON и 5544 product-результата;
- точный `matrix_id`, entitlement, callback/refund и PDF;
- 26 ordered-кармических хвостов, включая три разных порядка 18/9/9;
- удаление 55 ошибочных legacy-материалов; любой неизвестный хвост получает штатный 404;
- классификация 603 запросов и publication/URL registry;
- sitemap только из 200/index/self-canonical URL с фиксированным `lastModified`;
- полный автоматизированный contract/safety/link/near-duplicate аудит корпуса;
- контекстная ссылка из `past_lives` на точный хвост, из остальных разделов — на позицию;
- единый preflight, manifest, clean-tree/tested-commit guards и rollback.

## Автоматические доказательства

- `spec/method.json`, golden и exhaustive Python/TS parity;
- `tools/seo/prepare-unified-release.py --check` — 34 воспроизводимых артефакта;
- `tools/seo/build-content.py --check` — schema 26 хвостов и всего редакционного источника;
- `pytest engine content api`, Vitest, TypeScript, production build;
- build crawler всех статических страниц и каждого sitemap URL;
- browser E2E расчёта, оплаты, права, отчёта, PDF, URL и навигации;
- manifest с commit, diff-state, hashes контракта/контента/audit и sitemap count.

## Фактическая проверка после удаления лишнего контура

- engine + content contracts: **54 passed**;
- API и payment contracts: **165 passed**, одна deprecation-warning внешней библиотеки;
- frontend unit/golden/parity: **300 passed** в 22 файлах;
- редакционный корпус: **4777 проверок, 0 ошибок**; self-test валидатора зелёный;
- целевой browser E2E «один браузер/пять вкладок»: **2 passed**;
- TypeScript и production build зелёные; build сгенерировал **5911** маршрутов;
- генератор повторно подтвердил **32** воспроизводимых SEO-артефакта.

HTTP-проверка работающего compose подтверждает: удалённые BFF/API-маршруты отвечают 404, OpenAPI
их не содержит, таблица `analytics_events` и колонка `payments.analytics_body` отсутствуют. Полный
browser corpus, crawler и новый manifest в этой точечной проверке не запускались.

## Честно остаётся до релиза

- независимый предметный и редакторский sign-off нельзя заменить автоматическим тестом;
- Git commit/push запрещены владельцем в текущей задаче;
- test/prod deploy, тестовый банк, prod smoke и наблюдение не выполнялись;
- цели в интерфейсе Метрики и отправка sitemap поисковикам делаются после единого deploy.

Скрипты релиза откажутся работать из dirty tree, без зелёного manifest либо если prod пытается
выложить commit, который не был отмечен успешным test deploy.

Полный порядок и чеклист: [`tools/seo/new-seo-plan/total-plan.md`](../../../tools/seo/new-seo-plan/total-plan.md).
