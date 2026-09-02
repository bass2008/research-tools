import type { NextConfig } from "next";

import { serverSettings } from "./lib/settings/server";

// Фронт — node-сервер Next.js на той же машине, что api (docs/api-contract.md,
// «Раскладка деплоя»). Статического экспорта нет: BFF обязан обработать запрос, чтобы
// поставить httpOnly-куку, а страница отчёта печатается на запрос — иначе платные разделы
// попадают в предрендеренный HTML и видны, не заплатив.
const config: NextConfig = {
  reactStrictMode: true,
  // 404 несовпавшего адреса: без этого Next рендерит его динамически с пустым телом и
  // заголовком главной — страница живёт только в RSC-пейлоаде.
  experimental: { globalNotFound: true },
  poweredByHeader: false,
  // Адрес, с которого браузер берёт `_next/static`. Пусто — раздаёт тот же сервер; на проде сюда
  // ставится бакет Object Storage или CDN поверх него (infra/terraform/site). Значение
  // вшивается в разметку на сборке, поэтому смена адреса требует пересборки фронта.
  assetPrefix: serverSettings.get("assetPrefix") || undefined,
  // deploy.sh забирает .next/standalone и перезапускает службу
  output: "standalone",
  // Робот, который не исполняет скрипты, обязан увидеть метаданные в <head>. У динамических
  // маршрутов Next 15 отдаёт их стримом, то есть в <body>: замер цикла 13 показал, что на 17
  // персональных маршрутах (31 382 адреса) Googlebot не получал ни `noindex`, ни canonical,
  // ни <title>. Список ботов расширен до общего признака, чтобы блокирующие метаданные получали
  // все обходчики, а не только те, что Next знает по умолчанию.
  htmlLimitedBots: /bot|crawler|spider|slurp|yandex|bing|duckduck|baidu|facebookexternalhit|telegram|whatsapp|preview/i,
  async headers() {
    // Заголовок дублирует мету на случай, если разметку читает обходчик без рендеринга:
    // `X-Robots-Tag` не зависит от того, где в документе оказался тег. Список повторяет
    // PERSONAL_SECTION_KEYS плюс character — сверяется тестом web/lib/encyclopediaRoutes.test.ts.
    const personal = [
      "character", "comfort", "profession", "realisation", "karma40", "resources",
      "family_gifts", "soul_tasks", "purpose", "money", "money40", "relations",
      "parents_children", "ancestry", "body_resource", "chakras", "rest", "loops", "years",
    ];
    return personal.map((section) => ({
      source: `/encyclopedia/${section}/:slug`,
      headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
    }));
  },
  async rewrites() {
    // Всё, что не покрыто BFF (app/api/**), уходит в api: файловые маршруты
    // проверяются раньше rewrites, поэтому куку по-прежнему ставит BFF.
    const api = serverSettings.get("apiOrigin");
    return api ? [{ source: "/api/:path*", destination: `${api}/api/:path*` }] : [];
  },
};

export default config;
