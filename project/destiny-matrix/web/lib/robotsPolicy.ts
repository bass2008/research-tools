import type { MetadataRoute } from "next";

import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { DEFAULT_SITE, type SiteProfile } from "./siteProfile";
import { publicPath } from "./publicRouting";

// Отдаёт node-сервер по /robots.txt. Закрыты личные адреса: разбор и кабинет печатаются на
// запрос и содержат дату рождения, а /pay — страница оплаты, ей в выдаче делать нечего.


// Закрыты те, кто забирает текст и ничего не возвращает: GPTBot и ClaudeBot собирают данные для
// обучения моделей (вместе больше гигабайта отданного трафика), CCBot складывает страницы в
// открытый архив, из которого учатся все остальные, AhrefsBot перебирает сайт для
// платной базы ссылок. Поисковые боты тех же сервисов — OAI-SearchBot, ChatGPT-User,
// PerplexityBot — открыты намеренно: они приводят людей и дают ссылку на источник.
const UNWANTED = ["GPTBot", "ClaudeBot", "CCBot", "AhrefsBot"];

// Приватные адреса: содержат чужую дату рождения либо оплату.
const PRIVATE = ["/account", "/admin", "/report", "/matrices", "/readings", "/pay", "/login", "/register", "/forgot", "/reset", "/print", "/api/"];

// Персональные разборы разделов помечены `noindex`: это почти-дубли одной формы, в выдаче им
// делать нечего. Но `noindex` обход не запрещает — робот обязан скачать страницу целиком, чтобы
// прочитать мету, и идёт по её ссылкам дальше. Норму обхода экономит только `Disallow`.
const COMPUTED = [...PERSONAL_SECTION_KEYS, "character"].map((section) => `/encyclopedia/${section}/`);

// Сочетания закрыты 05.10.2026: трафика нет, а пара двух арканов в одной карте не отвечает
// на то, что ищут под этим запросом. Страницы остаются для людей. Яндекс выводит закрытое
// `Disallow` из поиска сам, Google — нет: ему обход открыт, чтобы он прочитал `noindex`.
const CLOSED = ["/encyclopedia/combination"];

export function robotsForSite(site: SiteProfile = DEFAULT_SITE): MetadataRoute.Robots {
  if (!site.indexable) return { rules: [{ userAgent: "*", disallow: "/" }] };
  // Old indexable pages remain crawlable; previously blocked calculations stay blocked.
  const scoped = (paths: string[]) => site.locales.flatMap((locale) => paths.map((path) => {
    const mapped = publicPath(path, locale);
    return path.endsWith("/") && !mapped.endsWith("/") ? `${mapped}/` : mapped;
  }));
  const privatePaths = [...PRIVATE, ...["ru", "en"].flatMap((lang) =>
    PRIVATE.filter((path) => path !== "/api/").map((path) => `/${lang}${path}`))];
  return {
    rules: [
      // Без `Allow: /`: по стандарту всё не запрещённое разрешено, а Next печатает `Allow`
      // раньше `Disallow`. Google и Яндекс выбирают самый длинный префикс и поняли бы файл
      // верно, но парсеры «первое совпадение» (в их числе стандартный python-овский) читали
      // строку как «всё открыто» и считали результаты расчёта разрешёнными.
      {
        userAgent: "*",
        disallow: [...new Set([...privatePaths, ...COMPUTED, ...CLOSED, ...scoped(COMPUTED), ...scoped(CLOSED)])],
        // Директива Яндекса: адреса с этими параметрами робот не скачивает вовсе. `canonical`
        // на них стоит верно, но он читается только после загрузки страницы — а норма обхода
        // у молодого домена тратится на каждой. `?tab=` — вкладки страницы аркана,
        // `?sec=` — прежний фильтр разделов справочника, который поиск ещё помнит.
        other: { "Clean-param": "tab&sec&lang" },
      },
      // Своя группа отменяет для Googlebot группу `*` целиком, поэтому запреты повторены.
      { userAgent: "Googlebot", disallow: [...new Set([...privatePaths, ...COMPUTED, ...scoped(COMPUTED)])] },
      ...UNWANTED.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${site.origin}/sitemap.xml`,
    host: site.origin,
  };
}
