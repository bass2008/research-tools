import { requestSite } from "@/lib/siteProfile.server";
import LegalDocView from "@/components/legal/LegalDoc";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { SUPPORT } from "@/lib/legal/support";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.supportTitle[L],
    description: D.pages.supportDescription[L],
    path: "/support",
  });
  return { pageMeta, metadata };
});

export default async function SupportPage() {
  const L = await requestLocale();

  return <LegalDocView locale={L} doc={SUPPORT[L]} crumb={D.nav.support[L]} />;
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
