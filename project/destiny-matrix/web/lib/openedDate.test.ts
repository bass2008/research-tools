import { describe, expect, it } from "vitest";

import { openedFor } from "./openedDate";
import type { MatrixListItem } from "./api";
import type { StoredBirth } from "./storage";

function row(over: Partial<MatrixListItem>): MatrixListItem {
  return {
    id: 1,
    birth: "1985-02-09",
    sex: "m",
    created_at: "2026-09-01T10:00:00Z",
    title: null,
    access: "forever",
    access_until: null,
    ...over,
  };
}

const asked = (birth: string, sex: "m" | "f"): StoredBirth => ({ birth, sex });

describe("какую запись открывает расчёт", () => {
  it("своей купленной даты — её же", () => {
    const paid = row({ id: 10 });
    expect(openedFor(asked("1985-02-09", "m"), [paid]).row).toBe(paid);
  });

  it("нет купленной на эту дату — нечего открывать", () => {
    expect(openedFor(asked("1990-01-01", "f"), [row({})]).row).toBeNull();
  });

  it("закрытая запись открытием не считается", () => {
    const locked = row({ id: 11, access: "locked" });
    expect(openedFor(asked("1985-02-09", "m"), [locked]).row).toBeNull();
  });

  it("подписка на все даты тоже открывает запись", () => {
    const bySubscription = row({ id: 12, access: "subscription", access_until: "2026-10-01" });
    expect(openedFor(asked("1985-02-09", "m"), [bySubscription]).row).toBe(bySubscription);
  });

  it("выбирается запись именно запрошенной даты, а не первая из списка", () => {
    const other = row({ id: 20, birth: "1979-11-02" });
    const mine = row({ id: 21, birth: "1985-02-09" });
    expect(openedFor(asked("1985-02-09", "m"), [other, mine]).row?.id).toBe(21);
  });
});

// Дефект цикла 16: куплена мужская карта, человек выбирает «Женский» — открывается купленная
// мужская, а переключатель остаётся на «Женский». Экран одновременно утверждал и то, и другое.
describe("каким полом подписан экран после открытия", () => {
  it("пол купленной записи отличается от выбранного — сохранённую дату надо привести к ней", () => {
    const paid = row({ id: 30, sex: "m" });
    expect(openedFor(asked("1985-02-09", "f"), [paid]).align).toEqual({
      birth: "1985-02-09",
      sex: "m",
    });
  });

  it("пол совпал — приводить нечего", () => {
    expect(openedFor(asked("1985-02-09", "m"), [row({ sex: "m" })]).align).toBeNull();
  });

  it("купленная женская и выбранный мужской — приводим к женской", () => {
    expect(openedFor(asked("1985-02-09", "m"), [row({ sex: "f" })]).align).toEqual({
      birth: "1985-02-09",
      sex: "f",
    });
  });

  it("ничего не куплено — приводить нечего, человек считает любой пол", () => {
    const result = openedFor(asked("2000-05-05", "f"), [row({ birth: "1985-02-09" })]);
    expect(result.row).toBeNull();
    expect(result.align).toBeNull();
  });

  it("закрытая запись другого пола пол не меняет", () => {
    const locked = row({ id: 31, sex: "m", access: "locked" });
    expect(openedFor(asked("1985-02-09", "f"), [locked]).align).toBeNull();
  });

  it("дата приводится вместе с полом — из открытой записи, а не из запроса", () => {
    const paid = row({ id: 32, birth: "1985-02-09", sex: "m" });
    const align = openedFor(asked("1985-02-09", "f"), [paid]).align;
    expect(align?.birth).toBe(paid.birth);
  });
});
