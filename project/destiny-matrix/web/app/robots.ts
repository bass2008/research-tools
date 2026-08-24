import type { MetadataRoute } from "next";

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

// Боевой адрес: на любом другом контуре тот же текст — дубль, который поиск сравнивает
// с основным сайтом. Поэтому тест закрыт целиком, а не выборочно.
const PRODUCTION = "https://arcana-sense.ru";

export default function robots(): MetadataRoute.Robots {
  if (SITE.url !== PRODUCTION) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/admin", "/report", "/matrices", "/pay", "/login", "/register", "/api/"],
      },
      ...UNWANTED.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
