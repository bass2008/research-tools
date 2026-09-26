import { configuredSites, printLinkSite, siteForHost, type SiteProfile } from "./siteProfile";
import type { Lang } from "./i18n/hosts";
import { serverSettings } from "./settings/server";

const LOCAL_SITES = JSON.stringify([
  { origin: "http://localhost:3000", hosts: ["localhost:3000", "ru.localhost:3000"], defaultLocale: "ru", locales: ["ru"] },
  { origin: "http://127.0.0.1:3000", hosts: ["127.0.0.1:3000", "com.localhost:3000", "web:3000"], defaultLocale: "en", locales: ["en", "ru"] },
]);

// Read on server startup, not during the frontend build. No mutable active profile.
const sites = configuredSites(serverSettings.get("siteProfiles") ||
  (serverSettings.get("nodeEnv") === "production" ? undefined : LOCAL_SITES));

export function resolveSite(host: string | null) {
  return siteForHost(host, sites);
}

export function resolvePrintLinkSite(site: SiteProfile, locale: Lang) {
  return printLinkSite(site, locale, sites);
}
