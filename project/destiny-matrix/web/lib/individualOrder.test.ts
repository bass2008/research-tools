import { describe, expect, it } from "vitest";
import { EMPTY_CART, type Cart } from "./individualPricing";
import { OWN, defaultChoices, defaultYears, problemOf, readingsOf, resolve, slotsOf } from "./individualOrder";

const plan = (cart: Partial<Cart>, base = 2027) => {
  const full = { ...EMPTY_CART, ...cart };
  const slots = slotsOf(full);
  const { owners, person } = resolve(slots, defaultChoices(full));
  const years = defaultYears(slots, person, base);
  return { owners, readings: readingsOf(slots, person, (r) => years[r], () => "") };
};

describe("для кого каждый разбор заказа", () => {
  it("готовые наборы не просят лишних дат", () => {
    expect(plan({ personal: 1 }).owners).toEqual(["p0"]);
    expect(plan({ personal: 1, year: 1 })).toEqual({ owners: ["p0"],
      readings: [{ kind: "personal", who: [0] }, { kind: "year", who: [0], year: 2027 }] });
    expect(plan({ personal: 2, pair: 1 })).toEqual({ owners: ["p0", "p1"],
      readings: [{ kind: "personal", who: [0] }, { kind: "personal", who: [1] }, { kind: "pair", who: [0, 1] }] });
    expect(plan({ pair: 1 }).owners).toEqual(["a0", "b0"]);
  });

  it("в большом наборе у каждого разбора свои люди, а годы одного человека идут подряд", () => {
    const { owners, readings } = plan({ personal: 3, year: 2, pair: 2 });
    expect(owners).toEqual(["p0", "p1", "p2"]);
    expect(readings.filter((r) => r.kind === "year")).toEqual([{ kind: "year", who: [0], year: 2027 }, { kind: "year", who: [1], year: 2027 }]);
    expect(readings.filter((r) => r.kind === "pair").map((r) => r.who)).toEqual([[0, 1], [0, 2]]);
    expect(plan({ personal: 1, year: 2 }).readings.slice(1).map((r) => r.year)).toEqual([2027, 2028]);
    expect(readings.every((r) => r.who.length)).toBe(true);
  });

  it("если выбранный человек перестал быть отдельным, разбор получает своего", () => {
    const cart = { ...EMPTY_CART, year: 1, pair: 1 };
    const slots = slotsOf(cart);
    expect(resolve(slots, { y0: OWN, a0: "y0", b0: OWN }).owners).toEqual(["y0", "b0"]);
    expect(resolve(slots, { y0: OWN, a0: "b0", b0: OWN }).owners).toEqual(["y0", "a0", "b0"]);
  });

  it("пара из одного человека и два одинаковых разбора не проходят", () => {
    expect(problemOf([{ kind: "pair", who: [1, 1] }])).toBe("samePerson");
    expect(problemOf([{ kind: "year", who: [0], year: 2027 }, { kind: "year", who: [0], year: 2027 }])).toBe("duplicate");
    expect(problemOf([{ kind: "pair", who: [0, 1] }, { kind: "pair", who: [1, 0] }])).toBe("duplicate");
    expect(problemOf(plan({ personal: 3, year: 2, pair: 2 }).readings)).toBeNull();
  });
});
