import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ISO = "2026-09-08T21:34:00Z";

async function load(buildIso: string | undefined) {
  vi.resetModules();
  if (buildIso === undefined) vi.stubEnv("NEXT_PUBLIC_BUILD_ISO", "");
  else vi.stubEnv("NEXT_PUBLIC_BUILD_ISO", buildIso);
  return import("./today");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("дата сборки", () => {
  it("берётся из метки сборки в UTC", async () => {
    const { buildDay } = await load(ISO);
    expect(buildDay()).toEqual({ day: 8, month: 9, year: 2026 });
  });

  // Ровно то, что сломалось на проде: HTML напечатан при сборке, а страницу открывают позже —
  // «сегодня» в первом рендере обязано остаться прежним, иначе React перерисовывает поддерево.
  it("не меняется, сколько бы времени ни прошло после сборки", async () => {
    const { buildDay } = await load(ISO);
    vi.setSystemTime(new Date("2026-09-08T21:40:00Z"));
    const right_after = buildDay();
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    expect(buildDay()).toEqual(right_after);
  });

  it("не зависит от часового пояса того, кто открыл страницу", async () => {
    const { buildDay } = await load("2026-09-08T23:30:00Z");
    // 8 сентября по UTC — 9 сентября в Москве; в первом рендере обязано быть UTC-число
    expect(buildDay().day).toBe(8);
  });

  it("собирали не скриптом релиза — отступаем к дате открытия в UTC", async () => {
    const { buildDay } = await load(undefined);
    vi.setSystemTime(new Date("2026-03-01T05:00:00Z"));
    expect(buildDay()).toEqual({ day: 1, month: 3, year: 2026 });
  });

  it("битую метку не превращаем в Invalid Date", async () => {
    const { buildDay } = await load("не дата");
    vi.setSystemTime(new Date("2026-03-01T05:00:00Z"));
    expect(buildDay()).toEqual({ day: 1, month: 3, year: 2026 });
  });

  it("месяц человеческий: январь — 1, а не 0", async () => {
    const { buildDay } = await load("2026-01-15T12:00:00Z");
    expect(buildDay().month).toBe(1);
  });

  it("конец года не сдвигает год", async () => {
    const { buildDay } = await load("2026-12-31T23:59:00Z");
    expect(buildDay()).toEqual({ day: 31, month: 12, year: 2026 });
  });
});

describe("дата браузера", () => {
  it("идёт за часами браузера, а не за сборкой", async () => {
    const { browserDay, buildDay } = await load(ISO);
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    expect(browserDay()).not.toEqual(buildDay());
    expect(browserDay().day).toBe(12);
  });

  it("месяц человеческий", async () => {
    const { browserDay } = await load(ISO);
    vi.setSystemTime(new Date("2026-02-03T10:00:00Z"));
    expect(browserDay().month).toBe(2);
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
      expect(code, file).toContain("buildDay");
    }
  });
});
