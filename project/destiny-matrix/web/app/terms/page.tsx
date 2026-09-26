import { INTERNATIONAL_RU } from "@/lib/legal/international";
import { requestSite } from "@/lib/siteProfile.server";
import LegalDocView from "@/components/legal/LegalDoc";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { TERMS } from "@/lib/legal/terms";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { getTariffs } from "@/lib/tariffs.server";
import type { Metadata } from "next";

// Оферта — договор: цены в ней обязаны совпадать с теми, что спишет касса, поэтому страница
// печатается по запросу и читает прайс из базы.
export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);
  const { priceLabel } = localizedTariffs(L);

  return { pageMeta, priceLabel };
});

export async function generateMetadata(): Promise<Metadata> {
  const L = await publicLocale();
  const { pageMeta, priceLabel } = forLocale(L, await requestSite());

  const prices = (await getTariffs()).map((t) => priceLabel(t)).join(" / ");
  return pageMeta({
    title: D.pages.termsTitle[L],
    description: ALL_FREE
      ? D.pages.termsDescriptionFree[L]
      : D.pages.termsDescription[L](prices || D.pages.termsPricesUnknown[L]),
    path: "/terms",
  });
}

export default async function OfertaPage() {
  const L = await requestLocale();

  const tariffs = await getTariffs();
  return <LegalDocView locale={L} doc={(await requestSite()).legalLocale === "en" && L === "ru" ? INTERNATIONAL_RU.terms : TERMS[L]} crumb={D.nav.terms[L]} tariffs={tariffs} />;
}
