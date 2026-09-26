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
# Счётчик включается только там, где передан номер: локальные прогоны и тесты статистику не пачкают.
ARG NEXT_PUBLIC_METRIKA_ID=""
ENV NEXT_PUBLIC_METRIKA_ID=${NEXT_PUBLIC_METRIKA_ID}

# Язык по умолчанию и доступные переводы витрины. Текущий язык выбирается на запрос.
ARG NEXT_PUBLIC_SITE_LANG=ru
ENV NEXT_PUBLIC_SITE_LANG=${NEXT_PUBLIC_SITE_LANG}
ARG NEXT_PUBLIC_SUPPORTED_LOCALES=ru,en
ENV NEXT_PUBLIC_SUPPORTED_LOCALES=${NEXT_PUBLIC_SUPPORTED_LOCALES}
# Общий режим доступа для обоих доменов; язык не меняет платность.
ARG NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT=0
ENV NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT=${NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT}

ARG NEXT_PUBLIC_YANDEX_VERIFICATION=""
ENV NEXT_PUBLIC_YANDEX_VERIFICATION=${NEXT_PUBLIC_YANDEX_VERIFICATION}
ARG NEXT_PUBLIC_GOOGLE_VERIFICATION=""
ENV NEXT_PUBLIC_GOOGLE_VERIFICATION=${NEXT_PUBLIC_GOOGLE_VERIFICATION}

ARG NEXT_ASSET_PREFIX=""
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
# версия сборки: её отдаёт /version/current.txt и показывает админка
ARG BUILD_COMMIT="—"
ARG BUILD_BRANCH="—"
ARG BUILD_TIME="—"
ARG BUILD_ISO=""
ENV NEXT_PUBLIC_BUILD_COMMIT=${BUILD_COMMIT} \
    NEXT_PUBLIC_BUILD_BRANCH=${BUILD_BRANCH} \
    NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME} \
    NEXT_PUBLIC_BUILD_ISO=${BUILD_ISO}
# Кеш Next переживает пересборку слоя: правка одного компонента не заставляет печатать
# 5 544 страницы заново. Кеш живёт в докере, в образ не попадает.
# sharing=locked: параллельные локальные сборки используют общий кеш и
# делят один кеш Next. Без замка вторая входит в тот же каталог и роняет первую паникой
# внутри rust-части сборщика.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ARG NEXT_ASSET_PREFIX=""
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX} \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone тянет за собой только нужные модули; статику и public он не копирует сам
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
