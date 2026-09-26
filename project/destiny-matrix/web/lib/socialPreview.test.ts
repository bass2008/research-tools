import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { forLocale } from "./site";
import { forLocale as schemaForLocale } from "./schema";
import { forLocale as seoForLocale } from "./seo";
import { configuredSites, siteForHost } from "./siteProfile";

describe("social previews use the public language of the domain", () => {
  it.each([
    ["arcana-sense.com", "en", "/og-en.png"],
    ["arcana-sense.com", "ru", "/og-en.png"],
    ["arcana-sense.ru", "ru", "/og.png"],
  ] as const)("%s with %s interface", (host, locale, asset) => {
    const site = siteForHost(host, configuredSites())!;
    const { SITE, pageMeta } = forLocale(locale, site);
    const meta = pageMeta({ title: "Article", description: "Description", path: "/encyclopedia/arcanum/4" });
    expect(SITE.ogImage).toBe(asset);
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: asset })]);
    expect(meta.twitter?.images).toEqual([asset]);
    expect(seoForLocale(locale, site).NOT_FOUND_META.openGraph?.images)
      .toEqual([expect.objectContaining({ url: asset })]);
    const article = schemaForLocale(locale, site).articleLd({
      headline: "Article", description: "Description", path: "/encyclopedia/arcanum/4",
    });
    expect(article.publisher.logo.url).toBe(site.origin + asset);
    const png = readFileSync(new URL(`../public${asset}`, import.meta.url));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([SITE.ogWidth, SITE.ogHeight]);
  });

  it("English artwork has English text", () => {
    const svg = readFileSync(new URL("../public/og-en.svg", import.meta.url), "utf8");
    expect(svg).toContain("Destiny matrix");
    expect(svg).not.toMatch(/[А-Яа-яЁё]/);
  });
});
