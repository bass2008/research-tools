import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pairChakraKeys } from "@/lib/pair/chakraReading";

const state = vi.hoisted(() => ({ subscribed: true, unlocked: true, locale: "ru" }));
vi.mock("@/app/_lib/access", () => ({
  readAccess: async () => ({ subscribed: state.subscribed ? ["pair"] : [] }),
  readReading: async () => ({ product: "pair", unlocked: state.unlocked, inputs: {
    a: { birth: "1993-03-31" }, b: { birth: "1994-12-28" },
  } }),
}));
vi.mock("@/lib/i18n/request", () => ({ requestLocale: async () => state.locale }));
import { GET } from "./route";
import { GET as owned } from "../reading-units/route";

const keys = pairChakraKeys("ru", { a: "1993-03-31", b: "1994-12-28" });
afterEach(() => { state.subscribed = state.unlocked = true; state.locale = "ru"; vi.unstubAllGlobals(); vi.restoreAllMocks(); });
for (const L of ["ru", "en"]) describe(`чакры BFF из статического корпуса (${L})`, () => {
  it("подписчик получает восемь готовых текстов без сетевого хранилища/очереди", async () => {
    state.locale = L;
    const network = vi.fn(() => { throw new Error("unexpected content fetch"); });
    vi.stubGlobal("fetch", network);
    const directoryScan = vi.spyOn(fs, "readdirSync").mockImplementation(() => { throw new Error("must read only requested files"); });
    const response = await GET(new Request(`http://localhost/api/pair/units?keys=${keys.join(",")}`));
    expect(response.status).toBe(200);
    const { units } = await response.json() as { units: Record<string, { text: string[] }> };
    expect(Object.keys(units).sort()).toEqual([...keys].sort());
    expect(Object.values(units).every((u) => u.text.length === 3)).toBe(true);
    expect(network).not.toHaveBeenCalled();
    expect(directoryScan).not.toHaveBeenCalled();
  });
  it("владелец получает полный разбор прямо из корпуса", async () => {
    state.locale = L;
    const network = vi.fn(() => { throw new Error("unexpected content fetch"); });
    vi.stubGlobal("fetch", network);
    const response = await owned(new Request("http://localhost/api/pair/reading-units?id=1"));
    expect(response.status).toBe(200);
    const { units } = await response.json() as { units: Record<string, { text: string[] }> };
    for (const key of keys) expect(units[key].text).toHaveLength(3);
    expect(network).not.toHaveBeenCalled();
  });
});
it("бесплатный пользователь не получает платные тексты чакр", async () => {
  state.subscribed = state.unlocked = false;
  expect((await GET(new Request(`http://localhost/api/pair/units?keys=${keys.join(",")}`))).status).toBe(404);
  expect((await owned(new Request("http://localhost/api/pair/reading-units?id=1"))).status).toBe(404);
});
