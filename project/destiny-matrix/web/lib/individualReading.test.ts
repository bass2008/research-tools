import { expect, it } from "vitest";
import { individualKind, isChildMatrix } from "./individualReading";

it("the child skeleton follows the order's tag, not the age", () => {
  const row = (inputs: Record<string, unknown>, year: number | null = null) => ({ kind: "personal" as const, year, inputs });
  expect(isChildMatrix(row({ birth: "2010-04-12", sex: "f", child: true }))).toBe(true);
  expect(isChildMatrix(row({ birth: "2016-04-12", sex: "f" }))).toBe(false);
  expect(isChildMatrix(row({ birth: "2016-04-12", sex: "f", child: true }, 2027))).toBe(false);
});

it("the public child example is a tagged child's matrix without adult inserts", async () => {
  const { individualExample } = await import("./individualExamples");
  const row = individualExample("child", "ru")!;
  expect(isChildMatrix(row)).toBe(true);
  expect(row.inserts ?? {}).toEqual({});
  expect(individualExample("child", "en")?.locale).toBe("ru");
});

it("names a child's matrix by its tag", () => {
  expect(individualKind({ kind: "personal", year: null, inputs: { birth: "2016-04-12", child: true } }, "ru")).toBe("Детская матрица");
  expect(individualKind({ kind: "personal", year: null, inputs: { birth: "2016-04-12" } }, "ru")).toBe("Личный разбор");
});
