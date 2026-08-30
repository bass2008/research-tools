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
  async rewrites() {
    // Всё, что не покрыто BFF (app/api/**), уходит в api: файловые маршруты
    // проверяются раньше rewrites, поэтому куку по-прежнему ставит BFF.
    const api = serverSettings.get("apiOrigin");
    return api ? [{ source: "/api/:path*", destination: `${api}/api/:path*` }] : [];
  },
};

export default config;
