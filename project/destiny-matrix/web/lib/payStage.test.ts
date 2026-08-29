import { describe, expect, it } from "vitest";

import { needsOwnerPassword, reduce, START, type Stage } from "./payStage";

const paid: Stage = { kind: "paid", paymentId: "p-1", email: "a@b.ru", matrix: null };

describe("экран оплаты", () => {
  it("успешный платёж показывает чек", () => {
    const next = reduce(START, { type: "paid", paymentId: "p-1", email: "a@b.ru", matrix: null });
    expect(next).toEqual(paid);
  });

  it("занятая почта требует пароль владельца именно этой почты", () => {
    const next = reduce(START, { type: "password-needed", email: "a@b.ru" });
    expect(needsOwnerPassword(next, "a@b.ru")).toBe(true);
    expect(needsOwnerPassword(next, " A@B.RU ")).toBe(true);
    expect(needsOwnerPassword(next, "other@b.ru")).toBe(false);
  });

  it("смена почты снимает требование пароля", () => {
    // форма продолжала требовать пароль от «уже существующего аккаунта» и после того,
    // как почту сменили на свободную
    const asked = reduce(START, { type: "password-needed", email: "a@b.ru" });
    expect(reduce(asked, { type: "email-changed", email: "new@b.ru" })).toEqual(START);
    expect(reduce(asked, { type: "email-changed", email: "a@b.ru" })).toEqual(asked);
  });

  it("возвращённый или ненайденный платёж не показывает чек", () => {
    expect(reduce(START, { type: "receipt-missing" })).toEqual(START);
  });

  it("молчание сервера не показывает форму: платёж мог пройти", () => {
    expect(reduce(START, { type: "receipt-unreachable" })).toEqual({ kind: "unchecked" });
  });

  it("состоявшийся чек не сбивается ни отказом сети, ни ненайденным платежом", () => {
    // после оплаты страница перечитывает список: временный отказ не должен уводить с чека
    expect(reduce(paid, { type: "receipt-unreachable" })).toEqual(paid);
    expect(reduce(paid, { type: "receipt-missing" })).toEqual(paid);
  });
});
