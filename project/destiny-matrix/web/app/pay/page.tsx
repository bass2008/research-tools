import { requestSite } from "@/lib/siteProfile.server";
import IndividualCompare from "@/components/pay/IndividualCompare";
import IndividualOffer from "@/components/pay/IndividualOffer";
import { PayChoice } from "@/components/pay/Subscribed";
import TariffsProvider from "@/components/pay/TariffsProvider";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import { allOffers, getBilling } from "@/lib/tariffs.server";
import { cartFromQuery } from "@/lib/individualPricing";
import "../individual/landing.css";
import type { Metadata } from "next";
import Link from "@/components/ui/LocalizedLink";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pay.pageTitle[L],
    description: D.pay.pageDescription[L],
    path: "/pay",
    noindex: true,
  });
  return { pageMeta, metadata };
});

// One page wherever "Buy" was pressed: all three automatic offers, then the gold section of
// individual readings. A saved record (`m`/`r`) is carried into the form of its own offer.
// A set in the address (`year=1&y=2027#order`, from the year widget) opens the order form of the gold section.
export default async function PayChoicePage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();

  // на витрине без оплаты кассы нет: страница не существует, а не показывает пустой прайс
  if (ALL_FREE) notFound();
  const params = await searchParams;
  const one = (key: string) => String((Array.isArray(params[key]) ? params[key]![0] : params[key]) ?? "");
  const id = (key: string) => (/^\d+$/.test(one(key)) ? one(key) : undefined);
  const carry = { m: id("m"), r: id("r") };
  const ordered = cartFromQuery(one);
  const [{ providers }, all] = await Promise.all([getBilling(), allOffers()]);
  // разовые покупки слева, подписка последней
  const offers = [...all].sort((a, b) => Number(a.per_reading === false) - Number(b.per_reading === false));
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span> <span>{D.encLinks.payTitle[L]}</span>
        </p>
        <h1>{D.pay.chooseTitle[L]}</h1>
        {offers.length ? (
          <TariffsProvider product="all" locale={L} server={offers} providers={providers}>
            <PayChoice locale={L} carry={carry} />
          </TariffsProvider>
        ) : (
          <div className="panel paybox">
            <h3>{D.encLinks.priceUnknownTitle[L]}</h3>
            <p className="dim">{D.encLinks.priceUnknownText[L]}</p>
          </div>
        )}
        <IndividualOffer providers={providers ?? []} initialCart={ordered.cart} initialYear={ordered.year} preset={ordered.preset} />
        <IndividualCompare />
      </div>
    </main>
  );
}

export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
