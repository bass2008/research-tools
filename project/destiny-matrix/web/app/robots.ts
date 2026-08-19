import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

// Отдаёт node-сервер по /robots.txt. Закрыты личные адреса: разбор и кабинет печатаются на
// запрос и содержат дату рождения, а /pay — страница оплаты, ей в выдаче делать нечего.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/account", "/admin", "/report", "/matrices", "/pay", "/login", "/register", "/api/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
