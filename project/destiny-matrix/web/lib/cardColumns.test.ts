import { expect, it } from "vitest";
import { balancedColumns } from "./cardColumns";

it("ряды карт ровные: хвост не бывает короче, чем нужно", () => {
  expect(balancedColumns(8, 5)).toBe(4);
  expect(balancedColumns(6, 5)).toBe(3);
  expect(balancedColumns(6, 4)).toBe(3);
  expect(balancedColumns(7, 5)).toBe(4);
  expect(balancedColumns(10, 5)).toBe(5);
  expect(balancedColumns(3, 2)).toBe(2);
  expect(balancedColumns(2, 5)).toBe(2);
  expect(balancedColumns(0, 3)).toBe(1);
});
