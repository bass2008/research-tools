import { isLang, type Lang } from "./hosts";
import { DEFAULT_SITE, type SiteProfile } from "../siteProfile";

/** Immutable instances per locale. No process-wide current language. */
export function localized<T>(create: (locale: Lang, site: SiteProfile) => T): (locale: Lang, site?: SiteProfile) => T {
  const instances = new Map<string, T>();
  return (locale, site = DEFAULT_SITE) => {
    if (!isLang(locale)) throw new Error(`Unsupported locale: ${locale}`);
    const key = JSON.stringify([locale, site]);
    if (!instances.has(key)) instances.set(key, create(locale, site));
    return instances.get(key)!;
  };
}
