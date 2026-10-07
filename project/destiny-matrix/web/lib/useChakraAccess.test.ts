import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Lang } from "./i18n/lang";
import type { LongformReading } from "./readingTypes";
import type { MatrixListItem } from "./api";
import { calculate } from "./matrix";
import { useChakraAccess } from "./useChakraAccess";

// A single state/effect harness lets us resolve requests out of order without a DOM dependency.
const hooks = vi.hoisted(() => ({
  locale: "ru" as Lang, state: null as unknown,
  effect: null as (() => (() => void) | undefined) | null,
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [hooks.state, (value: unknown) => { hooks.state = value; }],
  useEffect: (effect: typeof hooks.effect) => { hooks.effect = effect; },
}));
vi.mock("@/components/ui/LocaleProvider", () => ({ useLocale: () => hooks.locale }));
vi.mock("@/components/account/useSession", () => ({ useSession: () => ({ status: "user", unlimited: false }) }));
vi.mock("./access", () => ({ ALL_FREE: false }));

const matrix = calculate("1993-03-31", "f");
const dates = [{ id: 42, birth: matrix.birth, sex: matrix.sex, access: "forever" }] as MatrixListItem[];
const ru = { title: "Русское толкование" } as LongformReading;
const en = { title: "English reading" } as LongformReading;
const render = () => useChakraAccess(matrix, dates, null);
const response = (reading: LongformReading) => new Response(JSON.stringify({ sections: [{ key: "chakras", longform: reading }] }));
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  hooks.state = null;
  hooks.locale = "ru";
  hooks.effect = null;
});
afterEach(() => vi.unstubAllGlobals());

it.each(["http", "network", "empty"])("hides the old language when the new request fails: %s", async (failure) => {
  const fetch = vi.fn().mockResolvedValueOnce(response(ru));
  if (failure === "network") fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  else fetch.mockResolvedValueOnce(failure === "http" ? new Response("{}", { status: 503 }) : new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  render();
  const cleanup = hooks.effect!();
  await settle();
  expect(render().reading).toEqual(ru);
  cleanup?.();
  hooks.locale = "en";
  // Even before the new effect, no Russian reading may escape under English labels.
  expect(render()).toMatchObject({ reading: undefined, readingStatus: "loading" });
  hooks.effect!();
  await settle();
  expect(render()).toMatchObject({ reading: undefined, readingStatus: "error", unlocked: true });
  expect(fetch.mock.calls[1][1].headers["Accept-Language"]).toBe("en");
});

it("ignores a late response from the previous language", async () => {
  let resolveOld!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn()
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveOld = resolve; }))
    .mockResolvedValueOnce(response(en)));
  render();
  const cleanup = hooks.effect!();
  cleanup?.();
  hooks.locale = "en";
  render();
  hooks.effect!();
  await settle();
  expect(render().reading).toEqual(en);
  resolveOld(response(ru));
  await settle();
  expect(render()).toMatchObject({ reading: en, readingStatus: undefined });
});
