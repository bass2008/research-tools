# Конверсия в покупку: рабочая библиотека

Пять книг под одну задачу: человек рассчитал матрицу, увидел закрытые разделы и не понял, за что
платить. Отобраны 12.10.2026 из [списка 50 книг](../twirpx/50-books.md); остальные 15 книг о
конверсии повторяют эти или слабо касаются paywall.

Книги куплены и лежат в `sources/`. В git их нет: репозиторий публичный, папка в `.gitignore`.
Исходные копии лежат на Google Диске, в папке `Books/Conversion`. Как восстановить:
`rclone copy "gdrive:Books/Conversion" library/conversion/sources`, затем переименовать файлы по
таблице.

| # | Книга | Вопрос | Файл |
|---|---|---|---|
| 1 | Alan Klement — When Coffee and Kale Compete, 2-е изд. (2018) | что обещать за деньги: какой результат покупает человек | `klement-when-coffee-and-kale-compete-2018.pdf`, 209 с. |
| 2 | Richard Shotton — The Choice Factory (2018) | как подать цену и выбор: якорь, приманка, социальное доказательство | `shotton-the-choice-factory-2018.epub`, 25 глав |
| 3 | Torrey Podmajersky — Strategic Writing for UX, 2-е изд. (O'Reilly, 2025) | как написать экран оплаты: заголовок, кнопка, описание закрытого раздела | `podmajersky-strategic-writing-for-ux-2ed-2025.pdf`, 281 с. |
| 4 | Ragnhild Silkoset — Pricing: A Guide to Pricing Decisions (De Gruyter, 2023) | цена: готовность платить, разовая покупка против подписки | `silkoset-pricing-2023.pdf`, 168 с. |
| 5 | Stephen Wendel — Designing for Behavior Change, 1-е изд. (O'Reilly, 2013) | на каком шаге от расчёта до оплаты уходят люди | `wendel-designing-for-behavior-change-1ed-2013.pdf`, 393 с. |

Первые три закрывают экран оплаты, четвёртая нужна при изменении цены, пятая — для разбора пути
до оплаты.

У Вендела первое издание, а не переработанное второе (2020). Модель CREATE, ради которой книга
взята, есть и в первом.

Все файлы текстовые, не сканы, текст извлекается.
