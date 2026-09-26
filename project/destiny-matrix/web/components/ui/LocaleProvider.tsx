"use client";

import { SITE_LANG, type Lang } from "@/lib/i18n/lang";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/selection";
import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import { useRouter } from "next/navigation";
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
  const [clientLocale, setClientLocale] = useState(serverLocale);
  const locale = clientLocalized ? clientLocale : serverLocale;
  const refreshLocale = useCallback((selected: Lang) => {
    if (clientLocalized) setClientLocale(selected);
    else router.refresh();
  }, [clientLocalized, router]);
  const allowed = site.locales.join(",");
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
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
    // Public HTML starts in the domain language. Restore only an explicit user choice,
    // never navigator.language. Keep other open tabs' server trees in the same language.
    restore();
    window.addEventListener("storage", storage);
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, [serverLocale, clientLocalized, site.defaultLocale, allowed, refreshLocale]);
  return <SiteContext.Provider value={site}>
    <RefreshLocaleContext.Provider value={refreshLocale}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </RefreshLocaleContext.Provider>
  </SiteContext.Provider>;
}
