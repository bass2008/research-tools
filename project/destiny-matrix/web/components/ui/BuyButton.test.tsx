import { expect, it } from "vitest";
import { buyFor } from "./BuyButton";

it("«Купить» в шапке предлагает то, что человек смотрит", () => {
  expect(buyFor("/encyclopedia/arcanum/1", true)).toBe("/pay");
  expect(buyFor("/", false)).toBe("/pay");
  expect(buyFor("/", true)).toBe("/pay?for=personal");
  expect(buyFor("/report", false)).toBe("/pay?for=personal");
  expect(buyFor("/matrices/12", false)).toBe("/pay?for=personal&m=12");
  expect(buyFor("/compatibility", true)).toBe("/pay?for=pair");
  expect(buyFor("/readings/7", false)).toBe("/pay?for=pair&r=7");
  expect(buyFor("/matrix/7-5-1971", true)).toBe("/pay");
});
