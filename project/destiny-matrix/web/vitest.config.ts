import path from "node:path";

import { defineConfig } from "vitest/config";

const lang = process.env.NEXT_PUBLIC_SITE_LANG ?? "ru";

export default defineConfig({
  // Корпус языка приходит одним алиасом: статический импорт JSON переменной не принимает,
  // а собирать один и тот же модуль под два языка приходится и тестам.
  resolve: {
    alias: [
      { find: /^@\/corpus\//, replacement: `${path.resolve(__dirname, "content", lang)}/` },
      {
        find: "@/labels.json",
        replacement: path.resolve(__dirname, "lib", "__fixtures__", "labels", `${lang}.json`),
      },
      {
        find: "@/labels-public.json",
        replacement: path.resolve(__dirname, "lib", "__fixtures__", "labels-public", `${lang}.json`),
      },
      { find: "@", replacement: path.resolve(__dirname) },
    ],
  },
  test: {
    environment: "node",
    // `middleware.ts` Next требует в корне проекта, поэтому его тест лежит рядом с ним.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.tsx", "*.test.ts"],
  },
});
