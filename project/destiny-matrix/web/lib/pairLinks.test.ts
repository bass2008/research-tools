import { describe, expect, it } from "vitest";
import { valuesOf } from "./individualLinks";
import { fold } from "./matrix";
import { computePair, personalPoints } from "./pair/engine";
import { PAIR_ORDER, pairLinksOf, pairModel } from "./pairLinks";

const names = { a: "Сергей", b: "Виктория" };

describe("links of the couple's matrix", () => {
  it("counts rarity on the same numbers the couple's chart shows", () => {
    for (const birth of ["1993-03-31", "1994-12-28", "1987-02-21", "2000-01-01", "1961-07-19"]) {
      const [y, m, d] = birth.split("-").map(Number);
      const v = valuesOf(y, m, d), own = personalPoints(birth, "ru");
      for (const k of PAIR_ORDER) expect(k === "Q" ? fold(v.C + v.L) : v[k], `${birth} ${k}`).toBe(own[k]);
    }
  });

  it("finds every card standing in two or more read points of the couple, without the green points", () => {
    const { links, p } = pairLinksOf("ru", "1993-03-31", "1994-12-28", names);
    expect(links.length).toBeGreaterThan(0);
    for (const c of links) {
      expect(c.keys.length).toBeGreaterThanOrEqual(2);
      expect(c.keys.every((k) => p[k as keyof typeof p] === c.n)).toBe(true);
      expect(c.keys.some((k) => k === "S" || k === "T")).toBe(false);
      expect(c.keys.every((k) => ["H", "I", "K", "P", "N", "O", "Q"].includes(k))).toBe(false);
      expect(c.p).toBeGreaterThan(0);
    }
    expect(links.filter((c) => c.free)).toHaveLength(1);
    expect(links[0].free).toBe(true);
    expect(computePair("1993-03-31", "1994-12-28", "ru").p).toEqual(p);
  });

  it("says where the card stands in each partner's own matrix, and never who is to blame", () => {
    const { links } = pairLinksOf("ru", "1993-03-31", "1994-12-28", names);
    for (const c of links) {
      expect(c.note).toContain("**Сергей** — ");
      expect(c.note).toContain("**Виктория** — ");
      expect(c.note).not.toMatch(/винов|создаёт трудност/);
    }
  });

  it("explains the free link by the sum of the repeats, the rules and the partners' matrices", () => {
    const m = pairModel("ru", "1993-03-31", "1994-12-28", names);
    const free = m.links[0];
    const text = m.explain(free, (n) => `аркан ${n}`);
    expect(text[0]).toMatch(/Лисовская советует сложить/);
    expect(text.at(-1)).toMatch(/личных матрицах/);
    expect(m.source(free)).toMatch(/«Матрица судьбы\. Совместимость» \(гл\. 2/);
    expect(m.countSub()).toMatch(/пары?\sиз/);
    expect(m.nodes).not.toContain("S");
    expect(m.nodes.at(-1)).toBe("E");
  });

  it("reads the image and the purpose of the meeting together when they are one card", () => {
    for (let day = 1; day <= 28; day++) {
      const b = `1990-05-${String(day).padStart(2, "0")}`;
      const { links } = pairLinksOf("ru", "1985-03-14", b, names);
      const meet = links.find((c) => c.keys.includes("A") && c.keys.includes("B"));
      if (meet) {
        expect(meet.rules[0].t).toMatch(/зачем вас свела судьба/);
        return;
      }
    }
    throw new Error("no couple with the image and the purpose of the meeting on one card in the sample");
  });
});
