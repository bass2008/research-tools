import { describe, expect, it } from "vitest";

import { pickMatrix, type SavedMatrix } from "../_lib/access";

const row = (id: number, unlocked: boolean): SavedMatrix => ({
  id,
  birth: "1993-03-31",
  sex: "f",
  title: null,
  unlocked,
});

// Что открывать на «Мой разбор», решает признак доступа самой записи: его присылает сервер в
// списке матриц (`access` → `unlocked`). Пока страница выводила доступ из прав, витрина без
// кассы — где прав не заводят вовсе — отвечала «матрица не выбрана» тому, у кого в кабинете
// лежала открытая запись.
describe("выбор записи для «Мой разбор»", () => {
  it("без параметра берёт первую открытую", () => {
    const saved = [row(3, false), row(2, true), row(1, true)];
    expect(pickMatrix(saved, undefined)?.id).toBe(2);
    expect(pickMatrix(saved, undefined)?.unlocked).toBe(true);
  });

  it("открытая запись находится и когда прав нет вовсе", () => {
    // Ровно случай витрины без оплаты: сервер открыл запись сам, `scopes` пуст.
    const saved = [row(7, true)];
    expect(pickMatrix(saved, undefined)?.unlocked).toBe(true);
  });

  it("когда открытых нет, берётся самая свежая закрытая", () => {
    const saved = [row(5, false), row(4, false)];
    expect(pickMatrix(saved, undefined)?.id).toBe(5);
    expect(pickMatrix(saved, undefined)?.unlocked).toBe(false);
  });

  it("явный адрес показывает только названную запись", () => {
    const saved = [row(9, true), row(8, false)];
    expect(pickMatrix(saved, "8")?.id).toBe(8);
    expect(pickMatrix(saved, "404")).toBeNull();
    expect(pickMatrix(saved, "не-число")).toBeNull();
  });

  it("пустому кабинету нечего открывать", () => {
    expect(pickMatrix([], undefined)).toBeNull();
  });
});
