import type { SiteProfile } from "../siteProfile";
import { LOCALE_COOKIE, negotiateLocale, normalizeLocale } from "./selection";

export const LOCALE_HEADER = "x-arcana-locale";
export const PATH_HEADER = "x-arcana-path";
export const INTERACTIVE_HEADER = "x-arcana-interactive";

export function privateLocalePath(path: string): boolean {
  return /^\/(api|account|admin|report|matrices|readings|pay|login|register|forgot|reset|print|matrix)(\/|$)/.test(path);
}

export function selectedLocale(headers: Headers, site: SiteProfile, api = false) {
  // Explicit API language (including the future mobile client) takes precedence.
  if (api && headers.has("accept-language")) {
    return negotiateLocale(headers.get("accept-language"), site.locales, site.defaultLocale);
  }
  const raw = headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))?.slice(LOCALE_COOKIE.length + 1);
  const locale = normalizeLocale(raw);
  return locale && site.locales.includes(locale) ? locale : site.defaultLocale;
}

export function renderLocale(headers: Headers, site: SiteProfile) {
  const path = headers.get(PATH_HEADER) ?? "/";
  const fromPath = normalizeLocale(headers.get(LOCALE_HEADER));
  if (fromPath && site.locales.includes(fromPath)) return fromPath;
  // API/internal requests without a user-facing URL retain explicit language negotiation.
  if (privateLocalePath(path)) {
    return selectedLocale(headers, site, path.startsWith("/api/"));
  }
  return site.defaultLocale;
}
