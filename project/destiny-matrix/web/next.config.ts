import type { NextConfig } from "next";

// Фронт — node-сервер Next.js на той же машине, что api (docs/api-contract.md,
// «Раскладка деплоя»). Статического экспорта нет: BFF обязан обработать запрос, чтобы
// поставить httpOnly-куку, а страница отчёта печатается на запрос — иначе платные разделы
// попадают в предрендеренный HTML и видны, не заплатив.
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // deploy.sh забирает .next/standalone и перезапускает службу
  output: "standalone",
  async rewrites() {
    // Всё, что не покрыто BFF (app/api/**), уходит в api: файловые маршруты
    // проверяются раньше rewrites, поэтому куку по-прежнему ставит BFF.
    const api = process.env.API_ORIGIN;
    return api ? [{ source: "/api/:path*", destination: `${api}/api/:path*` }] : [];
  },
};

export default config;
