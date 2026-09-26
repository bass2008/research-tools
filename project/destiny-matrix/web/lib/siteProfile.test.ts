import { describe, expect, it } from "vitest";
import { configuredSites, printLinkSite, siteForHost } from "./siteProfile";
import { forLocale as siteView } from "./site";
import { forLocale as schemaView } from "./schema";
import { forLocale as seoView } from "./seo";
import { renderLocale, selectedLocale, PATH_HEADER, INTERACTIVE_HEADER } from "./i18n/requestPolicy";
import { robotsForSite } from "./robotsPolicy";
import { sitemapForSite } from "./sitemapEntries";

const sites = configuredSites();
const ru = siteForHost("arcana-sense.ru", sites)!;
const com = siteForHost("arcana-sense.com", sites)!;

describe("one frontend, domain profiles", () => {
  it("uses the public language for PDF links without changing their deployment", () => {
    expect(printLinkSite(com, "ru", sites).origin).toBe(ru.origin);
    expect(printLinkSite(ru, "en", sites).origin).toBe(com.origin);
    for (const origins of [
      ["https://test.arcana-sense.ru", "https://test.arcana-sense.com"],
      ["http://localhost:3000", "http://127.0.0.1:3000"],
    ]) {
      const configured = configuredSites(JSON.stringify(origins.map((origin, i) => ({
        origin, defaultLocale: i ? "en" : "ru", locales: i ? ["ru", "en"] : ["ru"],
      }))));
      const international = configured.find((profile) => profile.origin === origins[1])!;
      expect(siteView("ru", printLinkSite(international, "ru", configured))
        .publicHref("/encyclopedia/arcanum/8")).toBe(`${origins[0]}/encyclopedia/arcanum/8`);
      expect(printLinkSite(international, "en", configured)).toBe(international);
    }
  });

  it("does not send a test PDF to production when a public locale profile is missing", () => {
    const configured = configuredSites(JSON.stringify([{
      origin: "https://test.arcana-sense.com", defaultLocale: "en", locales: ["ru", "en"],
    }]));
    expect(() => printLinkSite(configured.at(-1)!, "ru", configured)).toThrow();
  });
  it("resolves only known domains and normalizes case/default ports", () => {
    expect(siteForHost("ARCANA-SENSE.COM:443", sites)).toBe(com);
    expect(siteForHost("arcana-sense.ru.", sites)).toBe(ru);
    for (const host of [null, "unknown.com", "arcana-sense.ru.evil.com", "arcana-sense.com, evil.com", "arcana-sense.com/path"]) {
      expect(siteForHost(host, sites)).toBeNull();
    }
  });

  it("accepts local aliases at runtime and keeps them out of search", () => {
    const local = siteForHost("web:3000", configuredSites(JSON.stringify([{
      origin: "http://127.0.0.1:3000", hosts: ["web:3000", "127.0.0.1:3000"],
      defaultLocale: "en", locales: ["en", "ru"], indexable: true,
    }])))!;
    expect(local.defaultLocale).toBe("en");
    expect(local.indexable).toBe(false);
    expect(sitemapForSite(local)).toEqual([]);
    expect(robotsForSite(local).rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("rejects unavailable translations and ambiguous host ownership", () => {
    const profile = { origin: "http://localhost:3000", defaultLocale: "en", locales: ["en", "de"] };
    expect(() => configuredSites(JSON.stringify([profile]))).toThrow();
    expect(() => configuredSites(JSON.stringify([{ ...profile, locales: ["en"], hosts: ["arcana-sense.ru"] }]))).toThrow();
  });

  it.each([ru, com])("keeps public HTML in the domain language: $origin", (site) => {
    for (const userAgent of ["Mozilla/5.0", "Googlebot", "YandexBot"]) {
      for (const locale of ["ru", "en"]) {
        const headers = new Headers({ "user-agent": userAgent, "accept-language": locale,
          cookie: `arcana_locale=${locale}`, [PATH_HEADER]: "/encyclopedia/arcanum/4" });
        expect(renderLocale(headers, site)).toBe(site.defaultLocale);
      }
    }
  });

  it("uses an explicit choice for interactive refreshes and private pages", () => {
    const headers = new Headers({ cookie: "arcana_locale=ru", "accept-language": "en" });
    headers.set(INTERACTIVE_HEADER, "1");
    expect(renderLocale(headers, com)).toBe("ru");
    headers.set(INTERACTIVE_HEADER, "0");
    headers.set(PATH_HEADER, "/account");
    expect(renderLocale(headers, com)).toBe("ru");
    headers.set("cookie", "arcana_locale=en");
    expect(renderLocale(headers, ru)).toBe("ru");
  });

  it("starts with the domain default regardless of browser language", () => {
    const headers = new Headers({ "accept-language": "ru-RU" });
    headers.set(INTERACTIVE_HEADER, "1");
    expect(renderLocale(headers, com)).toBe("en");
  });

  it("uses the same explicit API precedence with and without a source Request", () => {
    const headers = new Headers({ "accept-language": "en", cookie: "arcana_locale=ru", [PATH_HEADER]: "/api/matrices" });
    expect(selectedLocale(headers, com, true)).toBe("en");
    expect(renderLocale(headers, com)).toBe("en");
    expect(renderLocale(headers, ru)).toBe("ru");
  });

  it("does not change domain identity when the interface language changes", () => {
    const russianOnCom = siteView("ru", com);
    const englishOnCom = siteView("en", com);
    expect(russianOnCom.SITE.url).toBe("https://arcana-sense.com");
    for (const key of ["entity", "inn", "ogrnip", "email", "phone", "site", "bank", "rknNotice"] as const) {
      expect(russianOnCom.LEGAL[key], key).toBe(englishOnCom.LEGAL[key]);
    }
    for (const key of ["updated", "hosting", "mailer"] as const) {
      expect(russianOnCom.LEGAL[key], key).not.toBe(englishOnCom.LEGAL[key]);
    }
    expect(russianOnCom.LEGAL).not.toEqual(siteView("ru", ru).LEGAL);
    // Interleaving the same language on two hosts must not contaminate cached factories.
    for (const site of [ru, com, com, ru]) {
      const opts = { title: "Article", description: "Description", path: "/encyclopedia/arcanum/4" };
      expect(siteView("ru", site).pageMeta(opts).alternates?.canonical).toBe(site.origin + opts.path);
      const article = schemaView(site.defaultLocale, site).articleLd({ ...opts, headline: "Article" });
      expect(article.inLanguage).toBe(site.defaultLocale);
      expect(article.mainEntityOfPage["@id"]).toBe(site.origin + opts.path);
      expect(article.publisher.url).toBe(site.origin);
    }
  });

  it("keeps verification codes specific to the domain", () => {
    const site = { ...com, verification: { google: "international-code" } };
    expect(seoView("ru", site).verification()).toEqual({ google: "international-code" });
    expect(seoView("ru", ru).verification()).toBeUndefined();
  });

  it.each([ru, com])("generates sitemap and robots for the current host: $origin", (site) => {
    const sitemap = sitemapForSite(site);
    expect(sitemap.length).toBeGreaterThan(300);
    expect(sitemap.every((item) => new URL(item.url).origin === site.origin)).toBe(true);
    expect(robotsForSite(site).sitemap).toBe(site.origin + "/sitemap.xml");
  });
});
