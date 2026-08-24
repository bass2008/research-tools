import { describe, expect, it } from "vitest";

import { resultTitle } from "./payresult";

describe("заголовок страницы возврата из оплаты", () => {
  it("не обещает успех, пока банк не ответил", () => {
    expect(resultTitle("checking")).toBe("Проверяем платёж");
  });

  it.each([
    ["paid", "Оплата прошла"],
    ["failed", "Платёж не прошёл"],
    ["pending", "Платёж ещё в обработке"],
    ["error", "Не удалось проверить платёж"],
  ] as const)("%s → «%s»", (stage, title) => {
    expect(resultTitle(stage)).toBe(title);
  });
});
