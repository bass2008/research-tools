import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      {/* not-found.tsx не участвует в metadata, поэтому заголовок вкладки задаётся разметкой —
          иначе на 404 стоит заголовок главной, и это видно в истории браузера. */}
      <title>Страница не найдена — Arcana Sense</title>
      <meta name="robots" content="noindex" />
      <div className="wrap prose">
        <h1>Такой страницы нет</h1>
        <p>
          Возможно, ссылка устарела. Отсюда можно вернуться к расчёту или в справочник — тупиков на сайте
          быть не должно.
        </p>
        <div className="taglist">
          <Link href="/">Главная и расчёт</Link>
          <Link href="/encyclopedia">Энциклопедия</Link>
          <Link href="/report">Мой разбор</Link>
        </div>
      </div>
    </main>
  );
}
