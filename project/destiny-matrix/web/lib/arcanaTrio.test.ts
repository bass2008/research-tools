import { describe, expect, it } from "vitest";
import { pairTrio, personalTrio, readingTrio, yearTrio } from "./arcanaTrio";
import { calculate } from "./matrix";
import { computePair } from "./pair/engine";

describe("three cards of a reading", () => {
  it("puts the centre in the middle of a date's mask and talent", () => {
    const m = calculate("1993-03-31", "f");
    expect(personalTrio("1993-03-31")).toEqual([m.day, m.center, m.month]);
  });

  it("puts the couple's centre between the two partners' centres", () => {
    const { a, b, p } = computePair("1993-03-31", "1994-12-28");
    expect(pairTrio("1993-03-31", "1994-12-28")).toEqual([a.E, p.E, b.E]);
  });

  it("chooses the cards by what the reading is about", () => {
    expect(readingTrio({ a: { birth: "1993-03-31" }, b: { birth: "1994-12-28" } })).toEqual(pairTrio("1993-03-31", "1994-12-28"));
    expect(readingTrio({ birth: "1993-03-31" }, 2027)).toEqual(yearTrio("1993-03-31", 2027));
    expect(readingTrio({ birth: "1993-03-31" })).toEqual(personalTrio("1993-03-31"));
    expect(readingTrio({ a: { birth: "1993-03-31" } })).toBeNull();
    expect(readingTrio({ birth: "not a date" })).toBeNull();
  });
});
