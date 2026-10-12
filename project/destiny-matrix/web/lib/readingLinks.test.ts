import { describe, expect, it } from "vitest";
import { buyHref, payHref, readingHref } from "./readingLinks";

describe("ссылки разбора", () => {
  it("личный разбор ведёт по прежним адресам", () => {
    expect(readingHref({ id: 5 })).toBe("/report?m=5");
    expect(readingHref({ id: 5, product: "personal" })).toBe("/report?m=5");
    expect(payHref({ id: 5, product: "personal" })).toBe("/pay/single?m=5");
    expect(readingHref(null)).toBe("/report");
    expect(payHref(null)).toBe("/pay/single");
  });

  it("пара — на общую страницу разбора и оплату своего предложения", () => {
    expect(readingHref({ id: 9, product: "pair" })).toBe("/readings/9");
    expect(payHref({ id: 9, product: "pair" })).toBe("/pay/pair?r=9");
    expect(payHref(null, "pair")).toBe("/pay/pair");
  });

  it("«Купить» со страницы продукта предлагает его и подписку, без продукта — всё", () => {
    expect(buyHref()).toBe("/pay");
    expect(buyHref("personal")).toBe("/pay?for=personal");
    expect(buyHref("personal", 7)).toBe("/pay?for=personal&m=7");
    expect(buyHref("pair", 9)).toBe("/pay?for=pair&r=9");
  });
});
