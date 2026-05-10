да# niche-finder

Скрипт ищет прибыльные ниши для pet-проектов: где есть спрос, но нет хорошего продукта.

## Пайплайн

1. **Сбор ключей** — Google Autocomplete (бесплатно, без ключа). GET `https://suggestqueries.google.com/complete/search?client=firefox&q={query}&hl={lang}&gl={country}`. Расширяем рекурсивно: модификаторы, алфавит, углубление.

2. **Частотность** — XMLRiver Wordstat API. GET `https://xmlriver.com/wordstat/json?user={user_id}&key={api_key}&query={keyword}`. Отбрасываем ключи с частотностью < 50.

3. **Конкуренция** — XMLRiver SERP API. GET `https://xmlriver.com/search/json?user={user_id}&key={api_key}&query={keyword}&groupby=10`. Берём топ-100 ключей по частотности, парсим топ-10 выдачи.

4. **Анализ** — Claude API. Отдаём ключи + частотность + выдачу. Claude кластеризует, оценивает конкуренцию, находит белые пятна, предлагает идеи продуктов.

## Запуск

```bash
python main.py --seeds "конструктор ботов" "автоматизация бизнеса" --lang ru
```

## Конфиг

`.env` файл:
```
XMLRIVER_USER_ID=...
XMLRIVER_API_KEY=...
```

## Требования

- Python 3.10+, только stdlib
- Если XMLRiver не настроен — работаем без частотности, только автокомплит + Claude
- Результаты в `output/` — CSV с ключами, JSON с анализом, итоговый report.md
