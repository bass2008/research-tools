import { afterEach, expect, it, vi } from "vitest";
import { alive, metrikaId, notBounce, track } from "./analytics";
import { configuredSites, siteForHost } from "./siteProfile";

afterEach(() => vi.unstubAllGlobals());

it("keeps existing counters attached to domains, including goals after a language change", () => {
  const sites = configuredSites(JSON.stringify([
    { origin: "https://arcana-sense.ru", defaultLocale: "ru", locales: ["ru"], metrikaId: 111856670 },
    { origin: "https://arcana-sense.com", defaultLocale: "en", locales: ["en", "ru"], metrikaId: 112840069 },
    { origin: "https://test.arcana-sense.com", defaultLocale: "en", locales: ["en", "ru"] },
  ]));
  for (const [host, expected] of [["arcana-sense.ru", 111856670], ["arcana-sense.com", 112840069],
    ["test.arcana-sense.com", 0]] as const) {
    const profile = siteForHost(host, sites)!;
    expect(metrikaId(profile)).toBe(expected);
    for (const lang of ["ru", "en"]) {
      const ym = vi.fn();
      vi.stubGlobal("window", { ym });
      vi.stubGlobal("document", { documentElement: { lang, getAttribute: () => String(expected) } });
      expect(metrikaId()).toBe(expected);
      track("buy_click", { tariff: "single" });
      alive(30);
      notBounce();
      if (expected) {
        expect(ym.mock.calls).toEqual([
          [expected, "reachGoal", "buy_click", { tariff: "single" }],
          [expected, "params", { alive: 30 }], [expected, "notBounce"],
        ]);
      } else expect(ym).not.toHaveBeenCalled();
    }
  }
});

it.each([-1, 1.5, "111856670"])("rejects an invalid configured counter: %s", (metrikaId) => {
  expect(() => configuredSites(JSON.stringify([{
    origin: "https://arcana-sense.com", defaultLocale: "en", locales: ["en", "ru"], metrikaId,
  }]))).toThrow("Invalid Metrika counter");
});
