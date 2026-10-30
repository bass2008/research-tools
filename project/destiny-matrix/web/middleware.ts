import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, normalizeLocale } from "./lib/i18n/selection";
import { INTERACTIVE_HEADER, PATH_HEADER, LOCALE_HEADER, selectedLocale } from "./lib/i18n/requestPolicy";
import { resolveSite } from "./lib/siteProfile.config";
import { missingContentRoute } from "./lib/contentRoute";
import { isPublicPath, isUserPath, publicPath, splitPublicPath } from "./lib/publicRouting";

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
  const incoming = request.nextUrl.pathname;
  const parsed = splitPublicPath(incoming);
  const path = parsed.path;
  const userPage = isUserPath(path);
  const publicPage = isPublicPath(path);
  const chosen = normalizeLocale(request.nextUrl.searchParams.get("lang"));
  // A prefixed URL wins over cookies and legacy ?lang= links.
  const locale = parsed.locale ?? (publicPage ? site.defaultLocale
    : chosen && site.locales.includes(chosen) ? chosen : selectedLocale(request.headers, site));
  const invalidPrefix = Boolean(parsed.locale && (!userPage || !site.locales.includes(parsed.locale)));
  const missing = invalidPrefix || missingContentRoute(path, locale);
  if (!missing && userPage) {
    const target = new URL(publicPath(path, locale, site) + request.nextUrl.search, site.origin);
    target.searchParams.delete("lang");
    if (incoming !== target.pathname || request.nextUrl.search !== target.search) {
      // Private legacy addresses may choose their language from a preference: never cache
      // that choice permanently. Keep POST bodies (e.g. a server action) on normalization.
      const code = request.method !== "GET" && request.method !== "HEAD" ? 307
        : path === "/" || !publicPage ? 302 : 301;
      return NextResponse.redirect(target, code);
    }
  }
  // Пустое значение — это отсутствие условия, а не «ни один отпечаток не подошёл».
  const sent = request.headers.get("if-none-match")?.trim();
  const forward = new Headers(request.headers);
  forward.set(PATH_HEADER, path);
  forward.delete(LOCALE_HEADER);
  // A missing translated page still renders its 404 document in the URL language.
  if ((userPage || parsed.locale) && site.locales.includes(locale)) forward.set(LOCALE_HEADER, locale);
  const interactive = request.headers.get("rsc") === "1";
  forward.set(INTERACTIVE_HEADER, interactive ? "1" : "0");
  if (sent) forward.delete("if-modified-since");
  if (sent === "*") forward.delete("if-none-match");
  if (userPage && !missing) {
    const kept = (forward.get("cookie") ?? "").split(";").map((item) => item.trim())
      .filter((item) => item && !item.startsWith(`${LOCALE_COOKIE}=`));
    forward.set("cookie", [...kept, `${LOCALE_COOKIE}=${locale}`].join("; "));
  }
  // A thrown notFound() inside a dynamic page yields Next's empty SSR error shell.
  // Route absent content through the existing standalone 404 document instead.
  const response = missing
    ? NextResponse.rewrite(new URL("/_missing-content", request.url), {
      status: 404, request: { headers: forward },
    })
    : parsed.locale
      ? NextResponse.rewrite(new URL(path + request.nextUrl.search, request.url), { request: { headers: forward } })
      : NextResponse.next({ request: { headers: forward } });
  if (!site.indexable || interactive || (userPage && !publicPage)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Next renders these routes dynamically. Never share a personalized RSC response.
  response.headers.set("Cache-Control", "private, no-store");
  if (userPage && !publicPage && !missing) response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

// Статика версионирована именем файла, а /health не требует профиля домена и локализации.
// Списка контентных адресов здесь намеренно нет —
// снятие заголовка ничего не раздаёт и ничему не вредит, а список пришлось бы держать в согласии
// с картой сайта.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!health$|_next/static|_next/image).*)"],
};
