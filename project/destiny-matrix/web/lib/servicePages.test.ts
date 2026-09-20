import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { L, LANGS } from "./i18n";
import {
  SERVICE_PAGES,
  hasServicePage,
  langsOfPath,
  servicePages,
  servicePagesOf,
  type ServiceKey,
} from "./servicePages";

const KEYS = Object.keys(SERVICE_PAGES) as ServiceKey[];
const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");

describe("реестр служебных страниц", () => {
  it("у каждого ключа свой адрес и хотя бы один язык", () => {
    const paths = KEYS.map((key) => SERVICE_PAGES[key].path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const key of KEYS) {
      expect(SERVICE_PAGES[key].langs.length, key).toBeGreaterThan(0);
      expect(SERVICE_PAGES[key].path, key).toMatch(/^\/[a-z-]+$/);
    }
  });

  it("каждому объявленному языку есть что показать", () => {
    for (const lang of LANGS) {
      expect(servicePages(lang).length, lang).toBeGreaterThan(0);
      expect(servicePagesOf("legal", lang).length, lang).toBeGreaterThan(0);
    }
  });

  // Набор задан один раз: маршрут, подвал, карта сайта и hreflang читают его. Раньше список
  // лежал в трёх местах и разъехался — подвал английского сайта вёл на «Условия возврата»
  // там, где платить негде.
  it("подвал и карта сайта строятся из реестра, а не своими списками", () => {
    const footer = read("components/ui/Footer.tsx");
    const sitemap = read("app/sitemap.ts");
    expect(footer).toContain("servicePagesOf");
    expect(sitemap).toContain("servicePages()");
    for (const key of KEYS) {
      const href = `"${SERVICE_PAGES[key].path}"`;
      expect(footer, `подвал ссылается на ${key} мимо реестра`).not.toContain(`href=${href}`);
      expect(sitemap, `карта сайта знает ${key} мимо реестра`).not.toContain(`abs(${href})`);
    }
  });

  it("hreflang обещает только те языки, где страница есть", () => {
    for (const key of KEYS) {
      expect(langsOfPath(SERVICE_PAGES[key].path)).toEqual(SERVICE_PAGES[key].langs);
    }
    // Обычный адрес служебным не считается: у него языковые версии общие.
    expect(langsOfPath("/encyclopedia")).toBeNull();
  });

  // Страница, которой нет на языке, обязана отвечать 404: иначе поиск найдёт её по ссылке из
  // другой языковой версии и покажет документ о сделке на сайте, где сделок не бывает.
  it("маршрут отсутствующей страницы закрыт notFound", () => {
    for (const key of KEYS) {
      if (SERVICE_PAGES[key].langs.length === LANGS.length) continue;
      const page = read(`app${SERVICE_PAGES[key].path}/page.tsx`);
      expect(page, `${key}: маршрут открыт на языке, где страницы нет`).toContain("notFound()");
      expect(page).toContain("hasServicePage");
    }
  });

  it("на этой сборке набор непротиворечив", () => {
    for (const key of KEYS) {
      expect(hasServicePage(key)).toBe(SERVICE_PAGES[key].langs.includes(L));
    }
  });
});

describe("реквизиты", () => {
  // Заглушка «⟨…⟩» честна, пока документ ждёт данных, но на живом сайте она читается как
  // незаполненный черновик. Английские страницы её больше не содержат: номера не печатаются,
  // потому что продаж нет.
  it("у страниц языка нет незаполненных мест", () => {
    const files = [
      "lib/legal/terms.ts",
      "lib/legal/privacy.ts",
      "lib/legal/refund.ts",
      "lib/legal/support.ts",
      "components/ui/Footer.tsx",
    ];
    for (const file of files) {
      expect(read(file), file).not.toContain("⟨");
    }
  });
});

