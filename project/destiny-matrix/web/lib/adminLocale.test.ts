import { describe, expect, it } from "vitest";
import { ADMIN_EN } from "./i18n/dict/admin";
import { forLocale } from "./adminLocale";

describe("admin runtime locale", () => {
  it("keeps Russian plural forms and uses English plurals", () => {
    for (const [n, ru, en] of [[1, "1 человек", "1 person"], [2, "2 человека", "2 people"],
      [11, "11 человек", "11 people"], [21, "21 человек", "21 people"]] as const) {
      expect(forLocale("ru").counted(n, "человек", "человека", "человек")).toBe(ru);
      expect(forLocale("en").counted(n, "человек", "человека", "человек")).toBe(en);
    }
  });
  it("preserves all interpolation slots and never translates inserted user data", () => {
    for (const [ru, en] of Object.entries(ADMIN_EN)) {
      expect(en, ru).not.toMatch(/[а-яё]/i);
      expect([...en.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), ru)
        .toEqual([...ru.matchAll(/\{\d+\}/g)].map(m => m[0]).sort());
    }
    expect(forLocale("en").t("Матрица {0} добавлена и открыта", "Моя матрица"))
      .toBe("Matrix Моя матрица added and unlocked");
    expect(forLocale("ru").t("Матрица {0} добавлена и открыта", "Моя матрица"))
      .toBe("Матрица Моя матрица добавлена и открыта");
  });
});
