# Оригинал «Матрица судьбы: совместимость» и доступ к разделам

[Оглавление библиотеки](../README.md)

[PDF](matritsa-sudby-sovmestimost-2024.pdf) скопирован без изменений из файла пользователя `lisovskaia_iuliana_matritsa_sudby_sovmestimost.pdf`. Юлиана Лисовская, Ridero, 2024, 150 страниц, русский язык. Копия нужна для сверки; рабочие конспекты лежат в `energies/` и `general/`.

[source-map.json](source-map.json) содержит размер, SHA-256 и диапазоны страниц всех разделов. Номера — индексы страниц PDF, а не печатные. Соседние энергии делят пограничные страницы.

## Быстро открыть текст

Скрипт проверяет контрольную сумму и печатает текст страниц раздела. Нужен `pdftotext` из пакета poppler-utils; ничего не записывает.

```bash
python /home/sergey/Personal/research-tools/library/lisovskaya/sources/read_section.py --list
python /home/sergey/Personal/research-tools/library/lisovskaya/sources/read_section.py calculation
python /home/sergey/Personal/research-tools/library/lisovskaya/sources/read_section.py 15
python /home/sergey/Personal/research-tools/library/lisovskaya/sources/read_section.py answers --layout
```

Ключи `02` … `22` соответствуют карточкам энергий; `calculation`, `points`, `place`, `team`, `deal`, `example`, `answers` — разделам глав 2, 3, 5 и ответам.

**Схемы матриц — картинки.** В текстовой выгрузке их нет: полные числа контрольных пар (стр. 15–21 и 143–146) смотреть в PDF или рендерить страницу, например `pdftoppm -f 146 -l 146 -r 110 -png matritsa-sudby-sovmestimost-2024.pdf page`.

## Происхождение конспекта

Оригинал не исправлялся; опечатки издания собраны в [ограничениях](../general/05-known-issues.md). Карточки и общие материалы — новый выборочный пересказ, а не перевод и не сокращённая авторская редакция. Для цитаты открыть оригинал и указать автора и название книги, как она просит.
