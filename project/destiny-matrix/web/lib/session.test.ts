import { describe, expect, it } from "vitest";

import { needsReload, ownerChanged, personVisible, sessionAppeared } from "./session";

describe("расхождение сессии", () => {
  it.each([
    ["сессия появилась", null, "a@mail.ru", false],
    ["человек тот же", "a@mail.ru", "a@mail.ru", false],
    ["гостем и остался", null, null, false],
    ["сменился человек", "a@mail.ru", "b@mail.ru", true],
    ["человек вышел", "a@mail.ru", null, true],
  ])("%s → перезагрузка: %j", (_name, before, after, expected) => {
    expect(needsReload(before as string | null, after as string | null)).toBe(expected);
    expect(ownerChanged(before as string | null, after as string | null)).toBe(expected);
  });

  it("шапка держит известного человека, пока сессия перепроверяется", () => {
    expect(personVisible("user", "a@mail.ru")).toBe(true);
    expect(personVisible("loading", "a@mail.ru")).toBe(true);
    expect(personVisible("loading", null)).toBe(false);
    expect(personVisible("guest", null)).toBe(false);
    expect(personVisible("offline", "a@mail.ru")).toBe(true);
  });

  it.each([
    ["первичная проверка вошедшего", "loading", null, "a@mail.ru", false],
    ["вход после проверенного гостя", "guest", null, "a@mail.ru", true],
    ["повторная проверка того же человека", "user", "a@mail.ru", "a@mail.ru", false],
    ["восстановление связи", "offline", null, "a@mail.ru", false],
  ])("%s → сессия появилась между вкладками: %j", (_name, status, before, after, expected) => {
    expect(sessionAppeared(status, before, after)).toBe(expected);
  });
});
