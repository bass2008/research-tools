import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { configuredSites, siteForHost } from "@/lib/siteProfile";

const requestSite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/siteProfile.server", () => ({ requestSite }));
import ReportSheet from "./ReportSheet";

describe("PDF site identity is independent of the reading language", () => {
  it.each([
    ["arcana-sense.com", "ru"], ["arcana-sense.com", "en"], ["arcana-sense.ru", "ru"],
  ] as const)("prints %s on the %s report", async (host, locale) => {
    requestSite.mockResolvedValue(siteForHost(host, configuredSites()));
    const tree = await ReportSheet({
      locale, matrix: matrixForLocale(locale).calculate("1990-01-01", "m"), sections: [],
      planName: "", unlocked: true, saved: [], currentId: 23, printing: true,
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(`Arcana Sense · ${host}`);
    expect(html).not.toContain(`Arcana Sense · ${host.endsWith(".com") ? "arcana-sense.ru" : "arcana-sense.com"}`);
    expect(html).toContain(locale === "ru" ? "Расчёт носит" : "The reading is for information");
  });
});
