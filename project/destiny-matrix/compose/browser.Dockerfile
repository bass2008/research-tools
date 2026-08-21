# Chromium и повышенные права живут только здесь: в контейнере с сайтом им делать нечего.
FROM node:22-alpine

# Программный OpenGL (mesa + LLVM, 220 МБ) тянется зависимостью chromium, но при --disable-gpu
# не грузится ни разу: файлы удаляем сразу после установки. Шрифты нужны только как запасные —
# свои страница подтягивает сама, поэтому хватает dejavu.
RUN apk add --no-cache chromium ttf-dejavu \
 && rm -rf /usr/lib/libLLVM* /usr/lib/libgallium* /usr/lib/dri /usr/lib/libvulkan*

WORKDIR /srv/browser
COPY browser/package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY browser/server.mjs ./

ENV NODE_ENV=production CHROME_PATH=/usr/bin/chromium-browser
EXPOSE 3001
CMD ["node", "server.mjs"]
