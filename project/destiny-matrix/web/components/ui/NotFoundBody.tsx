import { D, L } from "@/lib/i18n";

/** Текст и выходы страницы 404: он одинаков и для маршрутного not-found, и для глобального.
 *
 *  Выходы — обычные `<a>`, а не `<Link>`. Глобальная страница 404 собирает собственный документ,
 *  и клиентский роутер в нём не совпадает с деревом маршрутов: переход менял адрес и заголовок
 *  вкладки, а на экране оставалось «Такой страницы нет». Полная перезагрузка здесь ничего не
 *  стоит и уводит гарантированно. */
export default function NotFoundBody() {
  return (
    <div className="wrap prose">
      <h1>{D.nav.notFoundTitle[L]}</h1>
      <p>{D.nav.notFoundText[L]}</p>
      <div className="taglist">
        <a href="/">{D.nav.notFoundHome[L]}</a>
        <a href="/encyclopedia">{D.nav.encyclopedia[L]}</a>
        <a href="/report">{D.nav.myReading[L]}</a>
      </div>
    </div>
  );
}
