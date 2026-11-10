import { afterEach, describe, expect, it, vi } from "vitest";
import { forLocale as sectionsForLocale } from "@/lib/sections";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { isMobileSections } from "@/lib/mobileContentContract";
import type { Lang } from "@/lib/i18n/hosts";
const state = vi.hoisted(() => ({ unlimited: false, unlocked: false, owner: false }));
vi.mock("@/app/_lib/access", () => ({
  readAccess: async () => ({ unlimited: state.unlimited }),
  readSavedMatrices: async () => state.owner ? [{ id: 7, birth: "1987-06-14", sex: "f" }] : [],
  pickMatrix: (rows: Array<{ id: number }>, id: string) => rows.find((row) => row.id === Number(id)),
  readMatrixUnlocked: async () => state.unlocked,
}));
vi.mock("@/lib/i18n/request", () => ({ requestLocale: async (req: Request) => req.headers.get("Accept-Language") ?? "ru" }));
import { GET } from "./route";
afterEach(() => { state.unlimited = state.unlocked = state.owner = false; });
const request = (query: string, locale: Lang) => new Request(`https://arcana-sense.com/api/sections?${query}`, { headers: { "Accept-Language": locale } });

for (const locale of ["ru", "en"] as const) describe(`personal report ${locale}`, () => {
  it("returns free text, paid placeholders and article links without paid paragraphs", async () => {
    const response = await GET(request("preview=free&slug=14-6-7", locale));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(isMobileSections(body)).toBe(true);
    const free = body.sections.filter((s: { access: string }) => s.access === "free");
    expect(free).toHaveLength(2);
    expect(free[0].positions[0].text.length).toBeGreaterThan(20);
    expect(free[0].personalHref).toMatch(/^\/encyclopedia\//);
    const paid = body.sections.filter((s: { access: string }) => s.access === "paid");
    expect(paid.every((s: { locked: boolean }) => s.locked)).toBe(true);
    expect(paid.every((s: { positions: Array<{ text?: string }> }) => s.positions.every((p) => !p.text))).toBe(true);
    const full = sectionsForLocale(locale).build(matrixForLocale(locale).calculate("1987-06-14", "f"), true);
    const lockedText = JSON.stringify(paid);
    for (const row of full.filter((s) => s.access === "paid")) {
      for (const position of row.positions) if (position.text && position.text.length > 80) expect(lockedText).not.toContain(position.text);
      for (const chakra of row.longform?.chakraRows ?? []) for (const p of chakra.paragraphs) expect(lockedText).not.toContain(p);
    }
  });
  it("does not accept an unlocked foreign record or a locked own record", async () => {
    state.unlocked = true;
    expect((await GET(request("m=7", locale))).status).toBe(404);
    state.owner = true; state.unlocked = false;
    expect((await GET(request("m=7", locale))).status).toBe(404);
  });
  it("returns the full shared report only after ownership and entitlement checks", async () => {
    state.owner = state.unlocked = true;
    const response = await GET(request("m=7", locale));
    const body = await response.json();
    expect(isMobileSections(body)).toBe(true);
    expect(body.sections.find((s: { key: string }) => s.key === "money").longform.roles.length).toBeGreaterThan(1);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
it("rejects malformed optional reading content before the native renderer", () => {
  const sections = sectionsForLocale("en").build(matrixForLocale("en").calculate("1987-06-14", "f"), true);
  expect(isMobileSections({ schemaVersion: 1, sections })).toBe(true);
  expect(isMobileSections({ schemaVersion: 1, sections: [{ ...sections[0], longform: { roles: null } }] })).toBe(false);
});
