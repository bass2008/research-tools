import Link from "next/link";

export const metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <main className="page">
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
