# Оригинал «Матрица Судьбы для начинающих» и доступ к разделам

[Оглавление библиотеки](../../README.md) · [Книга](../README.md)

[EPUB](matritsa-sudby-dlya-nachinayushchih.epub) скопирован без изменений из файла пользователя
`Лисовская Юлиана. Матрица Судьбы для начинающих.epub`. Юлиана Лисовская, «Издательские решения»
(Ridero), русский язык. Копия нужна для сверки; рабочие конспекты лежат в `../general/`.

[source-map.json](source-map.json) содержит размер, SHA-256, полное оглавление книги (211 пунктов)
и адреса выбранных разделов внутри архива. Номера страниц ридера меняются с настройками; для
проверки пользоваться главой, названием и путём `OEBPS/part-NNN.xhtml`.

## Быстро открыть текст

Скрипт использует только стандартную библиотеку Python, проверяет контрольную сумму и ничего не
записывает:

```bash
python3 /home/sergey/Personal/research-tools/library/lisovskaya-beginners/sources/read_section.py --list
python3 /home/sergey/Personal/research-tools/library/lisovskaya-beginners/sources/read_section.py karma
python3 /home/sergey/Personal/research-tools/library/lisovskaya-beginners/sources/read_section.py 09
```

Ключи `01` … `22` — главы энергий; `points`, `lines`, `calculation`, `karma`, `tails`, `finance`,
`relations`, `integration`, `types` и остальные перечисляет `--list`. Ключ печатает целые файлы
главы: нужный подраздел искать в выводе по заголовку из оглавления.

**Схемы матриц и номера точек — картинки.** В текстовой выгрузке их нет: смотреть в ридере или
достать изображение из архива (`OEBPS/images/…`). Схема точек с номерами 1–20 — в
`OEBPS/part-006.xhtml`, схема линий — в `OEBPS/part-007.xhtml`.

## Происхождение конспекта

Оригинал не исправлялся. Конспекты — новый выборочный пересказ, а не перевод и не сокращённая
авторская редакция. Для цитаты открыть оригинал и указать автора и название книги.
