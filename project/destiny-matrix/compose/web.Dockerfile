# Фронт: сборка Next.js и запуск standalone-сервера. Контекст — каталог web.
#
# Сборка идёт в образе, а не на машине: 5 854 страницы дают пик около 630 МБ памяти, и делать
# это на боевой VM рядом с API — минуты простоя. Здесь это разовая цена при `docker build`.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Адрес сайта попадает в canonical и sitemap на этапе сборки — его надо знать заранее
ARG NEXT_PUBLIC_SITE_URL=https://arcana-sense.ru
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
# откуда браузер берёт `_next/static`: пусто — с того же сервера, иначе бакет или CDN
ARG NEXT_ASSET_PREFIX=""
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
# версия сборки: её отдаёт /version/current.txt и показывает админка
ARG BUILD_COMMIT="—"
ARG BUILD_BRANCH="—"
ARG BUILD_TIME="—"
ENV NEXT_PUBLIC_BUILD_COMMIT=${BUILD_COMMIT} \
    NEXT_PUBLIC_BUILD_BRANCH=${BUILD_BRANCH} \
    NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
# Кеш Next переживает пересборку слоя: правка одного компонента не заставляет печатать
# 5 544 страницы заново. Кеш живёт в докере, в образ не попадает.
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone тянет за собой только нужные модули; статику и public он не копирует сам
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
