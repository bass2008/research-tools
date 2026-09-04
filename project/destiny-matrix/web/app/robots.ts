import type { MetadataRoute } from "next";

import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { SITE } from "@/lib/site";

// Отдаёт node-сервер по /robots.txt. Закрыты личные адреса: разбор и кабинет печатаются на
// запрос и содержат дату рождения, а /pay — страница оплаты, ей в выдаче делать нечего.
export const dynamic = "force-static";

// Закрыты те, кто забирает текст и ничего не возвращает: GPTBot и ClaudeBot собирают данные для
// обучения моделей (вместе больше гигабайта отданного трафика), CCBot складывает страницы в
// открытый архив, из которого учатся все остальные, AhrefsBot перебирает страницы матриц для
// платной базы ссылок. Поисковые боты тех же сервисов — OAI-SearchBot, ChatGPT-User,
// PerplexityBot — открыты намеренно: они приводят людей и дают ссылку на источник.
const UNWANTED = ["GPTBot", "ClaudeBot", "CCBot", "AhrefsBot"];

// Приватные адреса: содержат чужую дату рождения либо оплату.
const PRIVATE = ["/account", "/admin", "/report", "/matrices", "/pay", "/login", "/register", "/api/"];

// Результаты расчёта. Их 5 544 (`/matrix/`) плюс 446 персональных разборов разделов, и все они
// помечены `noindex`: это почти-дубли одной формы, в выдаче им делать нечего. Но `noindex`
// обход не запрещает — робот обязан скачать страницу целиком, чтобы прочитать мету, и идёт по
// её ссылкам дальше. На 356 индексируемых адресов приходилось 6 000 таких скачиваний, то есть
// 17 из 18 запросов молодого сайта уходили в никуда. Норму обхода экономит только `Disallow`.
// Хаб `/matrix` открыт: префикс со слешем на него не распространяется.
const COMPUTED = [
  "/matrix/",
  ...[...PERSONAL_SECTION_KEYS, "character"].map((section) => `/encyclopedia/${section}/`),
];

// Боевой адрес: на любом другом контуре тот же текст — дубль, который поиск сравнивает
// с основным сайтом. Поэтому тест закрыт целиком, а не выборочно.
const PRODUCTION = "https://arcana-sense.ru";

export default function robots(): MetadataRoute.Robots {
  if (SITE.url !== PRODUCTION) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      // Без `Allow: /`: по стандарту всё не запрещённое разрешено, а Next печатает `Allow`
      // раньше `Disallow`. Google и Яндекс выбирают самый длинный префикс и поняли бы файл
      // верно, но парсеры «первое совпадение» (в их числе стандартный python-овский) читали
      // строку как «всё открыто» и считали результаты расчёта разрешёнными.
      {
        userAgent: "*",
        disallow: [...PRIVATE, ...COMPUTED],
      },
      ...UNWANTED.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
