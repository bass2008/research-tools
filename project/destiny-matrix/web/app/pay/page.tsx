import { requestSite } from "@/lib/siteProfile.server";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { getTariffs, getBilling } from "@/lib/tariffs.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PayScreen from "./PayScreen";

export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);
  const { lead } = localizedTariffs(L);

  const metadata: Metadata = pageMeta({
    title: D.pay.pageTitle[L],
    description: D.pay.pageDescription[L],
    path: "/pay",
    noindex: true,
  });
  return { pageMeta, lead, metadata };
});

export default async function PayChoicePage() {
  const L = await requestLocale();
  const { lead } = forLocale(L, await requestSite());

  // на витрине без оплаты кассы нет: страница не существует, а не показывает пустой прайс
  if (ALL_FREE) notFound();
  const { items: tariffs, providers, test } = await getBilling();
  return <PayScreen locale={L} tariffs={tariffs} initial={lead(tariffs)?.id ?? ""} test={test} providers={providers} />;
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
