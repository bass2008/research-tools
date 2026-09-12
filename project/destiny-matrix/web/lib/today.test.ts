import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CONTENT_PUBLISHED } from "./corpusDates";
import { browserDay, exampleDay } from "./today";

// Дата-пример вшита в разметку каждой страницы с формой. Пока она шла от метки сборки, каждая
// сборка в новый день меняла тело ответа, а с ним встроенный `ETag`, — поиск качал заново то,
// что не менялось. Поэтому она обязана быть неподвижной.
describe("дата-пример", () => {
  it("берётся из даты публикации корпуса, в UTC", () => {
    const [year, month, day] = CONTENT_PUBLISHED.split("-").map(Number);
    expect(exampleDay()).toEqual({ day, month, year });
  });

  // Запасной ветки «не разобралось — взять сегодня» нет намеренно: она молча возвращала бы
  // расхождение гидратации. Вместо неё — требование к самой константе.
  it("дата публикации корпуса — настоящая календарная дата", () => {
    expect(CONTENT_PUBLISHED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(`${CONTENT_PUBLISHED}T00:00:00Z`))).toBe(false);
  });

  it("не зависит от часов того, кто открыл страницу", () => {
    vi.useFakeTimers();
    try {
      const before = exampleDay();
      vi.setSystemTime(new Date("2027-12-31T23:59:00Z"));
      expect(exampleDay()).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });

  // Дата разбирается по UTC, и это не мелочь: у посетителя восточнее Гринвича `getDate()` дал бы
  // другое число, чем стоит в готовом HTML. Проверяется сменой пояса процесса — иначе подмена
  // `getUTCDate` на `getDate` теста не роняет.
  it("не зависит от часового пояса", async () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    vi.resetModules();
    try {
      const { exampleDay: shifted } = await import("./today");
      const [year, month, day] = CONTENT_PUBLISHED.split("-").map(Number);
      expect(shifted()).toEqual({ day, month, year });
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe("дата браузера", () => {
  it("идёт за часами браузера, а не за корпусом", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2027-07-04T10:00:00Z"));
      expect(browserDay()).not.toEqual(exampleDay());
      expect(browserDay().year).toBe(2027);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("клиентские компоненты не берут дату у браузера напрямую", () => {
  const ROOT = path.join(__dirname, "..");
  // Здесь `new Date()` в рендер не попадает: админка — динамическая страница, пульс делает из
  // времени случайный идентификатор, счётчик отдаёт готовый скрипт Метрики строкой.
  const ALLOWED = new Set([
    path.join("components", "admin", "AdminView.tsx"),
    path.join("components", "ui", "PulseBeacon.tsx"),
    path.join("components", "ui", "Metrika.tsx"),
  ]);

  function clientFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", "content"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...clientFiles(full));
      else if (/\.tsx$/.test(entry.name) && readFileSync(full, "utf8").startsWith('"use client"')) {
        out.push(full);
      }
    }
    return out;
  }

  it("ни один не вызывает new Date() в рендере", () => {
    const guilty = clientFiles(ROOT)
      .map((file) => path.relative(ROOT, file))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => /new Date\(\s*\)/.test(readFileSync(path.join(ROOT, file), "utf8")));
    expect(guilty).toEqual([]);
  });

  it("форма расчёта и карта-пример берут «сегодня» из lib/today", () => {
    for (const file of ["components/matrix/MatrixForm.tsx", "components/matrix/MatrixReport.tsx"]) {
      const code = readFileSync(path.join(ROOT, file), "utf8");
      expect(code, file).toContain('from "@/lib/today"');
      expect(code, file).toContain("exampleDay");
    }
  });
});
