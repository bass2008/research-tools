import { describe, expect, it } from "vitest";

import { options, paymentTargetLabel, pickTarget, stillValid, targetLabel } from "./paytarget";

const local = { birth: "1990-03-07", sex: "m" as const };

const row = (id: number, birth: string, sex: "m" | "f", access: "locked" | "forever" = "locked") =>
  ({ id, birth, sex, title: null, access });

describe("цель платежа", () => {
  it("предлагает дату из браузера, когда её нет в кабинете", () => {
    expect(pickTarget([], local, null)).toEqual({ kind: "local" });
  });

  it("различает пол: та же дата другого пола не считается уже сохранённой", () => {
    const saved = [row(1, "1990-03-07", "f")];
    expect(pickTarget(saved, local, null)).toEqual({ kind: "local" });
    expect(options(saved, local).map((o) => o.value)).toEqual(["local", "1"]);
  });

  it("не предлагает дату из браузера дважды, если она уже в кабинете", () => {
    const saved = [row(1, "1990-03-07", "m")];
    expect(pickTarget(saved, local, null)).toEqual({ kind: "matrix", id: 1 });
  });

  it("уважает ссылку ?m= только на свою закрытую запись", () => {
    const saved = [row(1, "1985-05-05", "f"), row(2, "1986-06-06", "m")];
    expect(pickTarget(saved, null, 2)).toEqual({ kind: "matrix", id: 2 });
    // чужой или несуществующий номер не подменяется своей записью: платёж уходил за дату,
    // которой человек не просил
    expect(pickTarget(saved, null, 99)).toBeNull();
  });

  it("не выбирает уже открытую запись", () => {
    const saved = [row(1, "1985-05-05", "f", "forever")];
    expect(pickTarget(saved, null, 1)).toBeNull();
    expect(options(saved, null)).toEqual([]);
  });

  it("без дат возвращает пусто, а не выдуманный номер", () => {
    expect(pickTarget([], null, 42)).toBeNull();
    expect(targetLabel(null, [], null)).toBeNull();
  });

  it("подпись совпадает с пунктом списка", () => {
    const saved = [row(7, "1993-03-14", "f")];
    const list = options(saved, null);
    const target = pickTarget(saved, null, 7);
    expect(list[0].label).toContain(targetLabel(target, saved, null)!);
    expect(stillValid(target, list)).toBe(true);
    expect(stillValid({ kind: "matrix", id: 8 }, list)).toBe(false);
  });

  it("пол печатает только когда на одну дату две записи", () => {
    const alone = [row(1, "1985-05-05", "f")];
    expect(options(alone, null)[0].label).toBe("5 мая 1985 · кабинет");
    const twins = [row(1, "1985-05-05", "f"), row(2, "1985-05-05", "m")];
    expect(options(twins, null).map((o) => o.label))
      .toEqual(["5 мая 1985 (ж) · кабинет", "5 мая 1985 (м) · кабинет"]);
    expect(targetLabel({ kind: "matrix", id: 2 }, twins, null)).toBe("5 мая 1985 (м)");
  });

  it("различает две карты на одну дату, даже если сервер прислал им одинаковые названия", () => {
    const twins = [
      { ...row(1, "1985-05-05", "f"), title: "Матрица 5 мая 1985" },
      { ...row(2, "1985-05-05", "m"), title: "Матрица 5 мая 1985" },
    ];
    expect(options(twins, null).map((o) => o.label)).toEqual([
      "Матрица 5 мая 1985 (ж) · кабинет",
      "Матрица 5 мая 1985 (м) · кабинет",
    ]);
    expect(targetLabel({ kind: "matrix", id: 2 }, twins, null)).toBe("Матрица 5 мая 1985 (м)");
  });

  it("в админке печатает дату платежа, а не номер записи", () => {
    expect(paymentTargetLabel({ matrix: { birth: "1993-03-14", sex: "f", title: null }, matrix_id: 7 }))
      .toBe("14 марта 1993, женская");
    expect(paymentTargetLabel({ matrix: null, matrix_id: null })).toBe("—");
  });
});
