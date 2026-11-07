import { expect, it } from "vitest";
import { buyFor } from "./BuyButton";

it("«Купить» в шапке предлагает то, что человек смотрит", () => {
  expect(buyFor("/encyclopedia/arcanum/1", true)).toBe("/pay");
  expect(buyFor("/", false)).toBe("/pay");
  expect(buyFor("/", true)).toBe("/pay");
  expect(buyFor("/report", false)).toBe("/pay");
  expect(buyFor("/matrices/12", false)).toBe("/pay?m=12");
  expect(buyFor("/compatibility", true)).toBe("/pay");
  expect(buyFor("/readings/7", false)).toBe("/pay?r=7");
});
