import type { Metadata } from "next";
import IndividualLanding from "@/components/individual/landing/IndividualLanding";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { D } from "@/lib/i18n";
import { publicLocale, requestLocale } from "@/lib/i18n/request";
import { landingData } from "@/lib/individualLanding";
import { rub } from "@/lib/individualMoney";
import { CART_KINDS, EMPTY_CART, MAX_PER_KIND, defaultYearFor, type Cart } from "@/lib/individualPricing";
import { publicUrl } from "@/lib/publicRouting";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSite } from "@/lib/site";
import { requestSite } from "@/lib/siteProfile.server";
import { getBilling, individualPrices } from "@/lib/tariffs.server";
import "./landing.css";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const L = await publicLocale();
  const site = await requestSite();
  const T = D.individualSale;
  return localizedSite(L, site).pageMeta({
    title: T.landingTitle[L], description: T.landingDescription[L](rub((await individualPrices()).first, L)), path: "/individual",
  });
}

// The Individual tab: the approved landing (reports/individual-sales/prototypes/v6-otchet-i-karta), in gold.
// A set chosen on /pay comes in the address (`personal=2&pair=1&y=2027#order`) and opens in the order form.
export default async function IndividualPage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const T = D.individualSale;
  const site = await requestSite();
  const prices = await individualPrices();
  const { providers } = await getBilling();
  const params = await searchParams;
  const one = (key: string) => String((Array.isArray(params[key]) ? params[key]![0] : params[key]) ?? "");
  const asked: Cart = { ...EMPTY_CART };
  for (const k of CART_KINDS) asked[k] = Math.max(0, Math.min(MAX_PER_KIND, Math.trunc(Number(one(k))) || 0));
  const initialCart = CART_KINDS.some((k) => asked[k]) ? asked : null;
  const initialYear = /^\d{4}$/.test(one("y")) ? Number(one("y")) : undefined;
  const now = new Date();
  const { faqLd } = localizedSchema(L, site);
  // the service and its starting price; the FAQ markup stands next to the visible answers
  const serviceLd = {
    "@context": "https://schema.org", "@type": "Service", name: T.landingH1[L],
    description: T.landingDescription[L](rub(prices.first, L)), url: publicUrl("/individual", site, L),
    provider: { "@type": "Organization", name: "Arcana Sense", url: site.origin },
    offers: { "@type": "Offer", price: prices.first, priceCurrency: "RUB", url: publicUrl("/individual", site, L) },
  };
  return (
    <main id="content" className="ilp theme-gold">
      <JsonLd data={serviceLd} />
      <JsonLd data={faqLd(T.faq[L].map(([q, a]) => ({ q, a })))} />
      <CrumbsLd locale={L} trail={[{ name: D.nav.home[L], path: "/" }, { name: D.nav.individual[L] }]} />
      <IndividualLanding data={landingData(L)} providers={providers ?? []} initialCart={initialCart} initialYear={initialYear}
        serverYear={defaultYearFor({ month: now.getMonth() + 1, year: now.getFullYear() })} />
    </main>
  );
}
