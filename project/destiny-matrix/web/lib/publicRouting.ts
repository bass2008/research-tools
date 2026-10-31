import type { Lang } from "./i18n/hosts";
import { SITE_HOSTS } from "./i18n/hosts";
import type { SiteProfile } from "./siteProfile";

// Release 1: RU home stays at /; EN home moves to /en/. All user pages are localized; API and assets stay put.
const PUBLIC_ROOTS = new Set([
  "compatibility", "contacts", "support", "terms", "privacy", "refund", "energies",
  "programs", "full-reading", "year", "karmic-matrix", "compatibility-center",
  "how-to-read", "decoding", "business-compatibility", "meaning", "method", "author",
  "by-birth-date", "encyclopedia",
]);

export function splitPublicPath(path: string): { locale?: Lang; path: string } {
  const match = /^\/(ru|en)(?=\/|$)/.exec(path);
  return match ? { locale: match[1] as Lang, path: path.slice(match[0].length) || "/" } : { path };
}

export function isPublicPath(path: string): boolean {
  if (path === "/") return true;
  const parts = path.split("/").filter(Boolean);
  return PUBLIC_ROOTS.has(parts[0]) &&
    (parts.length === 1 || parts[0] === "encyclopedia" || (parts[0] === "year" && parts.length === 2));
}

/** Application pages keep their session/payment host while their language lives in the URL. */
export function isUserPath(path: string): boolean {
  return isPublicPath(path) || /^\/(account|admin|report|matrices|readings|pay|login|register|forgot|reset|print)(\/|$)/.test(path);
}

/** Idempotent mapping of user-facing paths; API, assets and external URLs are untouched. */
export function publicPath(href: string, locale: Lang, site?: SiteProfile): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const end = href.search(/[?#]/);
  const path = end < 0 ? href : href.slice(0, end);
  const tail = end < 0 ? "" : href.slice(end);
  const parsed = splitPublicPath(path);
  if (!isUserPath(parsed.path)) return href;
  if (parsed.path === "/") return (locale === "ru" && (!site || site.defaultLocale === "ru") ? "/" : `/${locale}/`) + tail;
  return `/${locale}${parsed.path.replace(/\/$/, "")}${tail}`;
}

export function languageOrigin(site: SiteProfile, locale: Lang): string {
  return locale === site.defaultLocale ? site.origin : site.languageOrigins?.[locale] ?? SITE_HOSTS[locale];
}

// Seller details and legal terms belong to the current host, even when translated.
const DOMAIN_PAGES = new Set(["/contacts", "/support", "/terms", "/privacy", "/refund"]);

export function publicUrl(href: string, site: SiteProfile, locale = site.defaultLocale): string {
  const path = splitPublicPath(href.split(/[?#]/)[0]).path;
  return new URL(publicPath(href, locale), isPublicPath(path) && !DOMAIN_PAGES.has(path) ? languageOrigin(site, locale) : site.origin).toString();
}

/** Language navigation always stays on the current host, including public articles. */
export function navigationHref(href: string, site: SiteProfile, locale: Lang): string {
  return publicPath(href, locale, site);
}
