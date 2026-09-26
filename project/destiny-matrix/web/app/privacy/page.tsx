import { INTERNATIONAL_RU } from "@/lib/legal/international";
import { requestSite } from "@/lib/siteProfile.server";
import LegalDocView from "@/components/legal/LegalDoc";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { PRIVACY } from "@/lib/legal/privacy";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.privacyTitle[L],
    description: D.pages.privacyDescription[L],
    path: "/privacy",
  });
  return { pageMeta, metadata };
});

export default async function PrivacyPage() {
  const L = await requestLocale();

  return <LegalDocView locale={L} doc={(await requestSite()).legalLocale === "en" && L === "ru" ? INTERNATIONAL_RU.privacy : PRIVACY[L]} crumb={D.nav.privacy[L]} />;
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
