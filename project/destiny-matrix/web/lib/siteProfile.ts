import { isLang, SITE_HOSTS, type Lang } from "./i18n/hosts";
import { parseLocales } from "./i18n/selection";
import { publicSettings } from "./settings/public";

/** Site identity is independent of the language selected in the application. */
export interface SiteProfile {
  origin: string;
  defaultLocale: Lang;
  locales: readonly Lang[];
  legalLocale: Lang;
  indexable: boolean;
  verification?: { google?: string; yandex?: string };
  metrikaId?: number;
}

// Compatibility for pure helpers and build-time route enumeration. HTTP requests use
// the explicit profile resolved from Host, never this build-time fallback.
const legacyLocale = publicSettings.get("siteLang") as Lang;
export const DEFAULT_SITE: SiteProfile = {
  origin: publicSettings.get("siteUrl"),
  defaultLocale: legacyLocale,
  locales: parseLocales(publicSettings.get("supportedLocales"), legacyLocale),
  legalLocale: legacyLocale,
  indexable: publicSettings.get("siteUrl") === SITE_HOSTS[legacyLocale],
};

export interface HostedSite extends SiteProfile {
  hosts: readonly string[];
}

export function normalizeHost(value: string | null): string | null {
  const host = value?.trim().toLowerCase();
  if (!host || !/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?$/.test(host)) return null;
  return host.replace(/\.(?=:|$)/, "").replace(/:(80|443)$/, "");
}

const productionSites = (["ru", "en"] as const).map((locale): HostedSite => ({
  origin: SITE_HOSTS[locale],
  hosts: [new URL(SITE_HOSTS[locale]).host],
  defaultLocale: locale,
  locales: locale === "ru" ? ["ru"] : ["en", "ru"],
  legalLocale: locale,
  indexable: true,
}));

/** Extra profiles are runtime configuration, e.g. local/test hosts. Unknown hosts fail closed. */
export function configuredSites(raw?: string): readonly HostedSite[] {
  const extra: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(extra)) throw new Error("SITE_PROFILES must be a JSON array");
  const profiles = new Map(productionSites.map((site) => [site.origin, site]));
  for (const value of extra) {
    if (!value || typeof value !== "object") throw new Error("Invalid site profile");
    const origin = new URL(value.origin);
    if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== value.origin ||
        !isLang(value.defaultLocale) || !isLang(value.legalLocale ?? value.defaultLocale) ||
        !Array.isArray(value.locales) || !value.locales.length || !value.locales.every(isLang) ||
        !value.locales.includes(value.defaultLocale)) throw new Error("Invalid site profile");
    const hosts: unknown = value.hosts ?? [origin.host];
    if (value.metrikaId !== undefined &&
        (!Number.isSafeInteger(value.metrikaId) || value.metrikaId < 0)) {
      throw new Error("Invalid Metrika counter");
    }
    if (!Array.isArray(hosts) || !hosts.length || hosts.some((host) => typeof host !== "string" || !normalizeHost(host))) {
      throw new Error("Invalid site hosts");
    }
    profiles.set(origin.origin, {
      origin: origin.origin, hosts: hosts.map(normalizeHost) as string[],
      defaultLocale: value.defaultLocale, locales: [...new Set<Lang>(value.locales)],
      legalLocale: value.legalLocale ?? value.defaultLocale,
      // Local/test origins cannot accidentally announce themselves for indexing.
      indexable: value.indexable !== false && origin.origin === SITE_HOSTS[value.defaultLocale as Lang],
      verification: value.verification,
      metrikaId: value.metrikaId,
    });
  }
  const seen = new Set<string>();
  for (const site of profiles.values()) for (const host of site.hosts) {
    if (seen.has(host)) throw new Error(`Duplicate site host: ${host}`);
    seen.add(host);
  }
  return [...profiles.values()];
}

export function siteForHost(host: string | null, sites: readonly HostedSite[]): HostedSite | null {
  const normalized = normalizeHost(host);
  return normalized ? sites.find((site) => site.hosts.includes(normalized)) ?? null : null;
}

/** Public PDF links follow the document language within the current deployment.
 * Production defaults are always registered, including on test/local servers; they must
 * not be selected as counterparts of the explicitly configured non-production profiles. */
export function printLinkSite(site: SiteProfile, locale: Lang, sites: readonly HostedSite[]): SiteProfile {
  if (site.defaultLocale === locale) return site;
  const production = (profile: SiteProfile) => Object.values(SITE_HOSTS).includes(profile.origin);
  const candidates = sites.filter((profile) => profile.defaultLocale === locale &&
    production(profile) === production(site));
  if (candidates.length !== 1) throw new Error(`Ambiguous or missing public PDF profile: ${locale}`);
  return candidates[0];
}
