"use client";

import { SITE_LANG, type Lang } from "@/lib/i18n/lang";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/selection";
import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import { useRouter, usePathname } from "next/navigation";
import { isUserPath, splitPublicPath } from "@/lib/publicRouting";
import { createContext, useCallback, useContext, useEffect, useState, startTransition, type ReactNode } from "react";

const LocaleContext = createContext<Lang>(SITE_LANG);
const SiteContext = createContext<SiteProfile>(DEFAULT_SITE);
const RefreshLocaleContext = createContext<(locale: Lang) => void>(() => {});

export function useRefreshLocale() {
  return useContext(RefreshLocaleContext);
}

export function useSite(): SiteProfile {
  return useContext(SiteContext);
}

export function useLocale(): Lang {
  return useContext(LocaleContext);
}

export default function LocaleProvider({ locale: serverLocale, site, children, clientLocalized = false }: {
  locale: Lang;
  site: SiteProfile;
  children: ReactNode;
  /** Global 404 has no refreshable route tree; its content reads the locale context. */
  clientLocalized?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const publicPage = isUserPath(splitPublicPath(pathname ?? "/").path);
  const [clientLocale, setClientLocale] = useState(serverLocale);
  const locale = clientLocalized ? clientLocale : serverLocale;
  const refreshLocale = useCallback((selected: Lang) => {
    if (clientLocalized) setClientLocale(selected);
    else router.refresh();
  }, [clientLocalized, router]);
  // Back/forward may restore an old page under the layout from the other language.
  // Refresh that layout from the URL without remounting forms or changing history.
  useEffect(() => {
    if (clientLocalized || !publicPage) return;
    const route = splitPublicPath(window.location.pathname);
    const expected = route.locale ?? site.defaultLocale;
    if (expected !== serverLocale) startTransition(() => router.refresh());
  }, [pathname, serverLocale, site.defaultLocale, clientLocalized, publicPage, router]);
  const allowed = site.locales.join(",");
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (publicPage || clientLocalized) return;
    function applySavedLocale(raw: string | null | undefined) {
      const saved = normalizeLocale(raw);
      const selected = saved && allowed.split(",").includes(saved) ? saved : site.defaultLocale;
      if (clientLocalized || selected !== serverLocale) startTransition(() => refreshLocale(selected));
    }
    function restore() {
      const raw = document.cookie.split(";").map((part) => part.trim())
        .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))?.slice(LOCALE_COOKIE.length + 1);
      applySavedLocale(raw);
    }
    function storage(event: StorageEvent) {
      if (event.key !== LOCALE_COOKIE) return;
      // Another tab's storage event may arrive before its cookie write becomes visible.
      // Use the announced preference to decide whether the page needs updating.
      applySavedLocale(event.newValue);
    }
    // Private screens restore explicit preferences, never navigator.language.
    // Public pages keep their URL language, including across tabs and RSC refreshes.
    restore();
    window.addEventListener("storage", storage);
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, [serverLocale, clientLocalized, site.defaultLocale, allowed, refreshLocale, publicPage]);
  return <SiteContext.Provider value={site}>
    <RefreshLocaleContext.Provider value={refreshLocale}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </RefreshLocaleContext.Provider>
  </SiteContext.Provider>;
}
