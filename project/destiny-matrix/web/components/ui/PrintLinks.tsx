"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Lang } from "@/lib/i18n/lang";
import { publicUrl } from "@/lib/publicRouting";
import type { SiteProfile } from "@/lib/siteProfile";

// The print service opens the page by an internal address, so a relative link in the PDF leads nowhere.
export const printHref = (site: SiteProfile, locale: Lang) => (href: string) =>
  href.startsWith("/") && !href.startsWith("//") ? publicUrl(href, site, locale) : href;

const PrintSite = createContext<{ site: SiteProfile; locale: Lang } | null>(null);

export function PrintLinks({ site, locale, children }: { site: SiteProfile; locale: Lang; children: ReactNode }) {
  return <PrintSite.Provider value={{ site, locale }}>{children}</PrintSite.Provider>;
}

export const usePrintSite = () => useContext(PrintSite)?.site;

export function usePrintHref() {
  const value = useContext(PrintSite);
  return value ? printHref(value.site, value.locale) : null;
}
