import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { configuredSites } from "./siteProfile";
import { publicPath, publicUrl, navigationHref } from "./publicRouting";
import { sitemapForSite } from "./sitemapEntries";
import { robotsForSite } from "./robotsPolicy";
import { forLocale as siteView } from "./site";

function response(host: string, path: string, headers = {}) {
  return middleware(new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } }));
}

describe("Release 1 public URL migration", () => {
  it.each([
    ["arcana-sense.ru", "/", 200, null],
    ["arcana-sense.ru", "/ru/", 302, "https://arcana-sense.ru/"],
    ["arcana-sense.com", "/", 302, "https://arcana-sense.com/en/"],
    ["arcana-sense.ru", "/year/16?tab=x", 301, "https://arcana-sense.ru/ru/year/16?tab=x"],
    ["arcana-sense.com", "/encyclopedia/arcanum/4", 301, "https://arcana-sense.com/en/encyclopedia/arcanum/4"],
    ["arcana-sense.com", "/en/", 200, null],
    ["arcana-sense.com", "/en/year/16", 200, null],
    ["arcana-sense.ru", "/ru/year/99", 404, null],
    ["arcana-sense.ru", "/year/99", 404, null],
    ["arcana-sense.ru", "/en/year/16", 200, null],
    ["arcana-sense.com", "/ru/year/16", 200, null],
    ["arcana-sense.ru", "/ru/api/payments/notify/tbank", 404, null],
    ["arcana-sense.ru", "/api/payments/notify/tbank", 200, null],
    ["arcana-sense.com", "/pay/done?paid=123", 302, "https://arcana-sense.com/en/pay/done?paid=123"],
    ["arcana-sense.com", "/robots.txt", 200, null],
  ])("%s%s => %s", (host, path, status, location) => {
    const r = response(host, path);
    expect(r.status).toBe(status);
    expect(r.headers.get("location")).toBe(location);
  });

  it("rewrites to existing routes without changing public URLs or trusting forged context", () => {
    const r = response("arcana-sense.com", "/en/year/16", {
      cookie: "arcana_locale=ru", "x-arcana-path": "/account", rsc: "1",
    });
    expect(r.headers.get("x-middleware-rewrite")).toBe("https://arcana-sense.com/year/16");
    expect(r.headers.get("x-middleware-request-x-arcana-path")).toBe("/year/16");
  });

  it("maps only public navigation, preserves query/fragment and never doubles prefixes", () => {
    expect(publicPath("/year/16?tab=meaning#text", "ru")).toBe("/ru/year/16?tab=meaning#text");
    expect(publicPath("/ru/year/16", "ru")).toBe("/ru/year/16");
    expect(publicPath("/en/", "en")).toBe("/en/");
    for (const path of ["/api/session", "/img/card.webp", "#result", "https://example.org/", "//example.org/"]) {
      expect(publicPath(path, "en")).toBe(path);
    }
  });

  it.each(configuredSites())("publishes only final URLs and matching language alternates: $origin", (site) => {
    const map = sitemapForSite(site);
    expect(map.length).toBeGreaterThan(300);
    for (const { url } of map) {
      const path = new URL(url).pathname;
      expect(path === "/" && site.defaultLocale === "ru" || path.startsWith(`/${site.defaultLocale}/`), url).toBe(true);
      expect(response(new URL(url).host, path).status, url).toBe(200);
    }
    const meta = siteView(site.defaultLocale, site).pageMeta({ path: "/year/16", title: "Year", description: "Year" });
    expect(meta.alternates?.languages).toEqual({
      ru: "https://arcana-sense.ru/ru/year/16",
      en: "https://arcana-sense.com/en/year/16",
      "x-default": "https://arcana-sense.com/en/year/16",
    });
    const common = [robotsForSite(site).rules].flat().find((r) => r.userAgent === "*")!;
    expect(common.disallow).toContain(`/${site.defaultLocale}/encyclopedia/character/`);
    expect(common.disallow).toContain("/encyclopedia/character/");
    expect(common.disallow).toContain("/encyclopedia/combination");
    expect(common.disallow).not.toContain("/encyclopedia/arcanum/");
    const google = [robotsForSite(site).rules].flat().find((r) => r.userAgent === "Googlebot")!;
    expect(google.disallow).toContain("/encyclopedia/character/");
    expect(google.disallow).not.toContain("/encyclopedia/combination");
  });

  it("language navigation stays in test/local instead of sending visitors to production", () => {
    const sites = configuredSites(JSON.stringify([
      { origin: "https://test.arcana-sense.ru", defaultLocale: "ru", locales: ["ru", "en"] },
      { origin: "https://test.arcana-sense.com", defaultLocale: "en", locales: ["ru", "en"] },
    ]));
    const site = sites.find((s) => s.origin === "https://test.arcana-sense.ru")!;
    expect(publicUrl("/year/16", site, "en")).toBe("https://test.arcana-sense.com/en/year/16");
  });
});


describe("all user pages have URL languages", () => {
  const pages = ["/account", "/admin", "/admin/users/7", "/report?m=12", "/matrices/12",
    "/readings/7", "/pay", "/pay/pair?r=7", "/pay/done?order=abc", "/pay/fail?order=abc",
    "/login", "/register", "/forgot", "/reset?token=secret", "/print/report?m=12&t=signature",
    "/print/pair?r=7&t=signature"];
  it.each(["arcana-sense.ru", "arcana-sense.com"])("keeps both private languages and parameters on %s", (host) => {
    for (const locale of ["ru", "en"] as const) for (const path of pages) {
      const target = `https://${host}/${locale}${path}`;
      const legacy = response(host, path + (path.includes("?") ? "&" : "?") + `lang=${locale}`);
      expect(legacy.status, path).toBe(302);
      expect(legacy.headers.get("location"), path).toBe(target);
      const rendered = response(host, `/${locale}${path}`, { cookie: `arcana_locale=${locale === "ru" ? "en" : "ru"}` });
      expect(rendered.status, target).toBe(200);
      expect(rendered.headers.get("x-middleware-request-x-arcana-locale")).toBe(locale);
      expect(rendered.headers.get("x-robots-tag")).toContain("noindex");
      expect(rendered.headers.get("x-middleware-rewrite")).toBe(`https://${host}${path}`);
    }
  });
  it("prefixed links override legacy query language and forged locale headers", () => {
    expect(response("arcana-sense.ru", "/en/reset?token=abc&lang=ru").headers.get("location"))
      .toBe("https://arcana-sense.ru/en/reset?token=abc");
    expect(response("arcana-sense.ru", "/ru/account", { "x-arcana-locale": "en" })
      .headers.get("x-middleware-request-x-arcana-locale")).toBe("ru");
    expect(response("arcana-sense.ru", "/api/auth/me", { "x-arcana-locale": "en" })
      .headers.has("x-middleware-request-x-arcana-locale")).toBe(false);
  });
  it("localizes private navigation/canonical without changing payment or session host", () => {
    const site = configuredSites().find((s) => s.defaultLocale === "ru")!;
    expect(navigationHref("/report?m=7#text", site, "en")).toBe("/en/report?m=7#text");
    expect(navigationHref("/encyclopedia", site, "en")).toBe("/en/encyclopedia");
    expect(siteView("en", site).pageMeta({path: "/account", title: "Account", description: "Account", noindex: true})
      .alternates?.canonical).toBe("https://arcana-sense.ru/en/account");
    for (const group of [robotsForSite(site).rules].flat().filter((r) => ["*", "Googlebot"].includes(String(r.userAgent)))) {
      for (const locale of ["ru", "en"]) for (const path of ["/account", "/reset", "/print"]) {
        expect(group.disallow).toContain(`/${locale}${path}`);
      }
    }
  });
});

it.each(configuredSites())("serves public translations on the same host: $origin", (site) => {
  for (const locale of ["ru", "en"] as const) {
    const path = `/${locale}/encyclopedia/position/comfort_west`;
    const r = response(new URL(site.origin).host, path, {cookie: `arcana_locale=${locale === "ru" ? "en" : "ru"}`});
    expect(r.status).toBe(200);
    expect(r.headers.get("x-middleware-request-x-arcana-locale")).toBe(locale);
    expect(navigationHref("/encyclopedia/position/comfort_west?tab=x#text", site, locale))
      .toBe(`${path}?tab=x#text`);
    const home = locale === "ru" && site.defaultLocale === "ru" ? "/" : `/${locale}/`;
    expect(navigationHref("/", site, locale)).toBe(home);
    expect(response(new URL(site.origin).host, home).status).toBe(200);
  }
});

it.each(["arcana-sense.ru", "arcana-sense.com"])("404 language also follows the URL on %s", (host) => {
  for (const locale of ["ru", "en"]) for (const path of ["/encyclopedia/arcanum/99", "/missing-page", "/api/not-a-page"]) {
    const r = response(host, `/${locale}${path}`, { cookie: `arcana_locale=${locale === "ru" ? "en" : "ru"}` });
    expect(r.status).toBe(404);
    expect(r.headers.get("x-middleware-request-x-arcana-locale")).toBe(locale);
  }
});

it.each(configuredSites())("legal translations canonicalize to their own seller: $origin", (site) => {
  for (const locale of ["ru", "en"] as const) for (const path of ["/terms", "/privacy", "/refund", "/contacts", "/support"]) {
    const meta = siteView(locale, site).pageMeta({path, title: "Terms", description: "Terms"});
    expect(meta.alternates?.canonical).toBe(`${site.origin}/${locale}${path}`);
    expect(meta.alternates?.languages).toMatchObject({ru: `${site.origin}/ru${path}`, en: `${site.origin}/en${path}`});
  }
});
