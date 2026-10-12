import { expect, it } from "vitest";
import { forLocale, holdingList, type Holding } from "./holdings";

const { holdingLines } = forLocale("ru");

it("names every kind of right once and without prices", () => {
  const items: Holding[] = [
    { kind: "subscription", source: "granted", products: ["*"], until: "2027-01-07T12:00:00+00:00",
      name: "Подписка на 3 месяца" },
    { kind: "reading", source: "bought", product: "personal", count: 2 },
    { kind: "reading", source: "granted", product: "personal", count: 1 },
    { kind: "reading", source: "bought", product: "pair", count: 1 },
    { kind: "reading", source: "granted", product: "pair", count: 5 },
  ];
  const lines = holdingLines(items);
  expect(lines.map((l) => l.text)).toEqual([
    "Подписка на 3 месяца · до 07.01.2027 · выдана",
    "Куплено навсегда: 2 даты",
    "Выдано: 1 дата",
    "Куплено навсегда: 1 пара",
    "Выдано: 5 пар",
  ]);
  expect(lines.map((l) => l.lifetime)).toEqual([false, true, false, true, false]);
  expect(lines.some((l) => l.text.includes("₽"))).toBe(false);
});

it("speaks English and has a generic subscription name", () => {
  const lines = forLocale("en").holdingLines([
    { kind: "subscription", source: "bought", products: ["*"], until: null },
    { kind: "reading", source: "granted", product: "pair", count: 1 },
  ]);
  expect(lines.map((l) => l.text)).toEqual(["Subscription to every reading", "Granted: 1 couple"]);
});

it("drops malformed rows from the API", () => {
  expect(holdingList([{ kind: "x" }, null, { kind: "reading", source: "bought", product: "pair", count: 1 }]))
    .toHaveLength(1);
  expect(holdingList(undefined)).toEqual([]);
});
