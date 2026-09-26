import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, normalizeLocale } from "./lib/i18n/selection";
import { INTERACTIVE_HEADER, PATH_HEADER, privateLocalePath } from "./lib/i18n/requestPolicy";
import { resolveSite } from "./lib/siteProfile.config";
import { missingContentRoute } from "./lib/contentRoute";

// Кроме выбора языка из ссылки, приводим Next к RFC 9110 в двух местах. Условными запросами
// занимается сам Next: `ETag` он считает от отданного тела, соврать такой отпечаток не может.
// Но проверку условий он делает неверно:
//
// §13.1.3 — при наличии `If-None-Match` заголовок `If-Modified-Since` полагается игнорировать.
// Next вместо этого зовёт проверку свежести с одним отпечатком, а библиотека `fresh` при
// отсутствии `Last-Modified` в ответе считает страницу устаревшей. Замер на собранном сервере:
// только `If-None-Match` → `304`; те же два заголовка вместе → `200` со всеми 175 КБ. Оба сразу
// шлёт всякий, у кого в кэше лежит ответ с датой.
//
// §13.1.2 — `*` подходит любому существующему представлению, то есть на несуществующем адресе
// условие ложно. Next отвечает на него `304` и там, где живой ответ — `404`: робот, однажды
// видевший страницу, так никогда не узнает, что её удалили. Снимаем заголовок целиком, и `*`
// получает полное тело вместо пустого ответа — цена, которую платят единицы клиентов.
export function middleware(request: NextRequest) {
  const site = resolveSite(request.headers.get("host"));
  if (!site) return new NextResponse("Unknown site host", {
    status: 421, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" },
  });
  const path = request.nextUrl.pathname;
  // Public ?lang= links cannot create an alternate indexed/rendered language.
  if (request.nextUrl.searchParams.has("lang") && !privateLocalePath(path)) {
    const target = new URL(path + request.nextUrl.search, site.origin);
    target.searchParams.delete("lang");
    return NextResponse.redirect(target, 308);
  }
  // Пустое значение — это отсутствие условия, а не «ни один отпечаток не подошёл».
  const sent = request.headers.get("if-none-match")?.trim();
  const chosen = normalizeLocale(request.nextUrl.searchParams.get("lang"));
  const locale = chosen && site.locales.includes(chosen) ? chosen : null;
  const forward = new Headers(request.headers);
  forward.set(PATH_HEADER, path);
  const interactive = request.headers.get("rsc") === "1";
  forward.set(INTERACTIVE_HEADER, interactive ? "1" : "0");
  if (sent) forward.delete("if-modified-since");
  if (sent === "*") forward.delete("if-none-match");
  if (locale) {
    const kept = (forward.get("cookie") ?? "").split(";").map((item) => item.trim())
      .filter((item) => item && !item.startsWith(`${LOCALE_COOKIE}=`));
    forward.set("cookie", [...kept, `${LOCALE_COOKIE}=${locale}`].join("; "));
  }
  // A thrown notFound() inside a dynamic page yields Next's empty SSR error shell.
  // Route absent content through the existing standalone 404 document instead.
  const missing = missingContentRoute(path, site.defaultLocale);
  const response = missing
    ? NextResponse.rewrite(new URL("/_missing-content", request.url), {
      status: 404, request: { headers: forward },
    })
    : NextResponse.next({ request: { headers: forward } });
  if (!site.indexable || interactive) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Next renders these routes dynamically. Never share a personalized RSC response.
  response.headers.set("Cache-Control", "private, no-store");
  if (locale) response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

// Всё, кроме статики: она версионирована именем файла. Списка адресов здесь намеренно нет —
// снятие заголовка ничего не раздаёт и ничему не вредит, а список пришлось бы держать в согласии
// с картой сайта.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image).*)"],
};
