import { describe, expect, it } from "vitest";

import golden from "./__fixtures__/golden.json";
import {
  ARCANA_MAX,
  CHAKRAS,
  MatrixError,
  calculate,
  daysInMonth,
  digitSum,
  fold,
  foldYear,
  values,
  type Sex,
} from "./matrix";
import { FREE_KEYS, PAID_KEYS, build, referencedArcana } from "./sections";

// golden.json снят запуском Python-движка:
//   conda run -n research3.12 python scripts/make-golden.py
type GoldenCase = {
  birth: string;
  sex: string;
  matrix: Record<string, unknown>;
  sections_locked: unknown;
  sections_unlocked: unknown;
};

const CASES = golden as GoldenCase[];

describe("эталон из engine/matrix.py", () => {
  it("датасет покрывает 29 февраля, 1900 год и оба пола", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(20);
    expect(CASES.filter((c) => c.birth.endsWith("-02-29")).length).toBeGreaterThanOrEqual(5);
    expect(CASES.some((c) => c.birth.startsWith("1900-"))).toBe(true);
    expect(new Set(CASES.map((c) => c.sex))).toEqual(new Set(["m", "f"]));
  });

  for (const c of CASES) {
    it(`${c.birth} / ${c.sex} — матрица совпадает с Python`, () => {
      expect(calculate(c.birth, c.sex as Sex)).toEqual(c.matrix);
    });
  }

  // Паритет — про формулы и состав разделов. Толкование позиции («аркан N в этом блоке»)
  // живёт только во фронте: корпус написан для сайта, в Python-движке его нет, поэтому
  // поле text из сравнения убирается.
  const withoutText = (rows: ReturnType<typeof build>) =>
    rows.map((s) => ({ ...s, positions: s.positions.map(({ text, ...p }) => p) }));

  for (const c of CASES) {
    it(`${c.birth} / ${c.sex} — разделы совпадают с Python`, () => {
      const m = calculate(c.birth, c.sex as Sex);
      expect(withoutText(build(m, false))).toEqual(c.sections_locked);
      expect(withoutText(build(m, true))).toEqual(c.sections_unlocked);
    });
  }

  it("в разборе у каждой позиции есть толкование под этот блок", () => {
    const m = calculate("1987-06-14", "m");
    const rows = build(m, true);
    for (const s of rows) {
      for (const p of s.positions) {
        expect(p.text, `${s.key}/${p.label}`).toBeTruthy();
        expect(p.text!.length).toBeGreaterThan(40);
      }
    }
    // толкование зависит от пары «аркан + блок», а не только от аркана
    const money = rows.find((s) => s.key === "money")!.positions[0];
    const character = rows.find((s) => s.key === "character")!.positions[0];
    if (money.arcanum === character.arcanum) expect(money.text).not.toBe(character.text);
  });
});

describe("fold", () => {
  it("сводит к 1..22", () => {
    expect([1, 21, 22, 23, 44, 45].map(fold)).toEqual([1, 21, 22, 1, 22, 1]);
  });

  it("кратные 22 дают 22, а не ноль", () => {
    for (let k = 1; k < 20; k++) expect(fold(22 * k)).toBe(22);
  });

  it("не принимает ноль и отрицательные", () => {
    for (const bad of [0, -1, -22]) expect(() => fold(bad)).toThrow(MatrixError);
  });

  it("идемпотентен", () => {
    for (let n = 1; n < 200; n++) expect(fold(fold(n))).toBe(fold(n));
  });
});

describe("год", () => {
  it("сворачивается по цифрам", () => {
    expect(foldYear(1987)).toBe(7);
    expect(foldYear(2000)).toBe(2);
    // 1999 → 28 → 10 и останов: 10 — валидный аркан
    expect(foldYear(1999)).toBe(10);
  });

  it("всегда в диапазоне", () => {
    for (let y = 1900; y <= 2030; y++) {
      const v = foldYear(y);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(ARCANA_MAX);
    }
  });

  it("digitSum", () => {
    expect(digitSum(1987)).toBe(25);
    expect(digitSum(0)).toBe(0);
  });
});

describe("валидация", () => {
  it("будущая дата отклонена", () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const iso = t.toISOString().slice(0, 10);
    expect(() => calculate(iso)).toThrow(/будущем/);
  });

  it("до 1900 отклонено", () => {
    expect(() => calculate("1899-12-31")).toThrow(/1900/);
  });

  it("несуществующая дата отклонена", () => {
    expect(() => calculate("2001-02-29")).toThrow(/не существует/);
    expect(() => calculate("2001-13-01")).toThrow(/не существует/);
  });

  it("плохой формат отклонён", () => {
    expect(() => calculate("14.06.1987")).toThrow(/YYYY-MM-DD/);
  });

  it("плохой пол отклонён", () => {
    expect(() => calculate("1987-06-14", "x" as Sex)).toThrow(/sex/);
  });

  it("строка и части дают одно и то же", () => {
    expect(calculate("1987-06-14")).toEqual(calculate({ year: 1987, month: 6, day: 14 }));
  });

  it("29 февраля существует только в високосный год", () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(() => calculate("1900-02-29")).toThrow(/не существует/);
    expect(calculate("2000-02-29").day).toBe(7);
  });
});

describe("структура", () => {
  const m = calculate("1987-06-14", "m");

  it("базовый квадрат", () => {
    expect([m.day, m.month, m.year]).toEqual([14, 6, 7]);
    expect(m.mission).toBe(fold(m.day + m.month + m.year));
    expect(m.center).toBe(fold(m.day + m.month + m.year + m.mission));
  });

  it("диагонали — суммы соседей", () => {
    expect(m.father_line).toBe(fold(m.day + m.month));
    expect(m.mother_line).toBe(fold(m.month + m.year));
    expect(m.descendants).toBe(fold(m.year + m.mission));
    expect(m.inheritance).toBe(fold(m.mission + m.day));
  });

  it("триады сходятся", () => {
    for (const t of [m.sky, m.ground, m.social_male, m.social_female]) {
      expect(t[2]).toBe(fold(t[0] + t[1]));
    }
    expect(m.harmony).toBe(fold(m.sky[2] + m.ground[2]));
    expect(m.planetary).toBe(fold(m.social_male[2] + m.social_female[2]));
  });

  it("семь чакр, строки различаются", () => {
    expect(m.chakras).toHaveLength(CHAKRAS.length);
    expect(m.chakras.map((r) => r.key)).toEqual(CHAKRAS.map((c) => c[0]));
    for (const r of m.chakras) expect(r.emotions).toBe(fold(r.physics + r.energy));
    expect(new Set(m.chakras.map((r) => `${r.physics}:${r.energy}`)).size).toBe(7);
  });

  it("линии по три значения", () => {
    for (const line of [m.money, m.love, m.talent, m.karmic_tail]) {
      expect(line).toHaveLength(3);
      expect(line[2]).toBe(fold(line[0] + line[1]));
    }
  });

  it("шкала закрывает 80 лет без разрывов", () => {
    expect(m.age_scale).toHaveLength(8);
    expect(m.age_scale[0].from).toBe(0);
    expect(m.age_scale[7].to).toBe(80);
    for (let i = 0; i < 7; i++) expect(m.age_scale[i].to).toBe(m.age_scale[i + 1].from);
  });
});

describe("инварианты на многих датах", () => {
  const DATES: string[] = [];
  for (const y of [1900, 1953, 1987, 2000, 2024]) {
    for (const mth of [1, 2, 6, 12]) {
      for (const d of [1, 9, 22, 28]) {
        DATES.push(`${y}-${String(mth).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }
  }

  it("каждое значение в 1..22", () => {
    for (const b of DATES) {
      const bad = values(calculate(b)).filter((v) => !(v >= 1 && v <= ARCANA_MAX));
      expect(bad, b).toEqual([]);
    }
  });

  it("пол не меняет арифметику", () => {
    for (const b of DATES.slice(0, 8)) {
      expect(values(calculate(b, "m"))).toEqual(values(calculate(b, "f")));
    }
  });

  it("разные даты дают разные матрицы", () => {
    const seen = new Set(DATES.map((b) => values(calculate(b)).join(",")));
    expect(seen.size).toBeGreaterThan(DATES.length * 0.8);
  });
});

describe("разделы", () => {
  const m = calculate("1987-06-14", "f");

  it("два бесплатных, восемнадцать платных", () => {
    // Бесплатна витрина: как устроен человек и где ему комфортно. Профессия, предназначение,
    // кармическая задача и денежный канал — продукт, за него платят.
    expect(FREE_KEYS).toEqual(["character", "comfort"]);
    expect(PAID_KEYS).toHaveLength(18);
    for (const key of ["profession", "realisation", "karma40", "resources"]) {
      expect(PAID_KEYS).toContain(key);
    }
  });

  it("под замком у платных нет позиций, но есть анонс", () => {
    for (const s of build(m, false)) {
      if (s.access === "paid") {
        expect(s.positions).toEqual([]);
        expect(s.teaser).toMatch(/позиций в полном разборе/);
      } else {
        expect(s.positions.length).toBeGreaterThan(0);
      }
    }
  });

  it("открытый отчёт даёт позиции всем двадцати разделам", () => {
    const all = build(m, true);
    expect(all).toHaveLength(20);
    for (const s of all) expect(s.positions.length).toBeGreaterThan(0);
  });

  it("каждая позиция ссылается в энциклопедию", () => {
    for (const s of build(m, true)) {
      for (const p of s.positions) expect(p.href).toBe(`/encyclopedia/arcanum/${p.arcanum}`);
    }
  });

  it("нет медицинских формулировок и гарантий", () => {
    const text = build(m, true)
      .map((s) => `${s.title} ${s.lead} ${s.positions.map((p) => p.label).join(" ")}`)
      .join(" ")
      .toLowerCase();
    for (const bad of [
      "лечен",
      "диагноз",
      "заболеван",
      "исцел",
      "целитель",
      "гарантиру",
      "набор веса",
      "алкогол",
      "уязвимые зоны",
    ]) {
      expect(text, bad).not.toContain(bad);
    }
  });

  it("отчёт ссылается на много разных арканов", () => {
    expect(referencedArcana(m).length).toBeGreaterThan(8);
  });
});
