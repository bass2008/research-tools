import { INTERNATIONAL_RU } from "@/lib/legal/international";
import { requestSite } from "@/lib/siteProfile.server";
import LegalDocView from "@/components/legal/LegalDoc";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { REFUND } from "@/lib/legal/refund";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.refundTitle[L],
    description: D.pages.refundDescription[L],
    path: "/refund",
  });
  return { pageMeta, metadata };
});

export default async function RefundPage() {
  const L = await requestLocale();

  return <LegalDocView locale={L} doc={(await requestSite()).legalLocale === "en" && L === "ru" ? INTERNATIONAL_RU.refund : REFUND[L]} crumb={D.nav.refund[L]} />;
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
