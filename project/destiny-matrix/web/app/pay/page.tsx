import { publicPath } from "@/lib/publicRouting";
import { requestSite } from "@/lib/siteProfile.server";
import { PayChoice } from "@/components/pay/Subscribed";
import TariffsProvider from "@/components/pay/TariffsProvider";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import { type BuyFor } from "@/lib/readingLinks";
import { allOffers, getBilling } from "@/lib/tariffs.server";
import type { Metadata } from "next";
import Link from "@/components/ui/LocalizedLink";
import { notFound, redirect } from "next/navigation";

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

// Выбор перед формой. Без продукта — все предложения сайта; `for=personal|pair` — разовая покупка
// этого продукта или подписка, номер записи (`m`/`r`) уходит в форму. Старые ссылки с номером, но
// без продукта, ведут сразу в форму этой записи.
export default async function PayChoicePage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();

  // на витрине без оплаты кассы нет: страница не существует, а не показывает пустой прайс
  if (ALL_FREE) notFound();
  const params = await searchParams;
  const one = (key: string) => String((Array.isArray(params[key]) ? params[key]![0] : params[key]) ?? "");
  const asked = one("for");
  const flow: BuyFor | null = asked === "personal" || asked === "pair" ? asked : null;
  if (!flow && one("m")) redirect(publicPath(`/pay/single?m=${encodeURIComponent(one("m"))}`, L));
  if (!flow && one("r")) redirect(publicPath(`/pay/pair?r=${encodeURIComponent(one("r"))}`, L));
  const id = (key: string) => (/^\d+$/.test(one(key)) ? one(key) : undefined);
  const carry = flow === "pair" ? { r: id("r") } : flow === "personal" ? { m: id("m") } : {};
  const [{ providers }, all] = await Promise.all([getBilling(), allOffers()]);
  // разовые покупки слева, подписка последней
  const offers = all
    .filter((t) => !flow || (t.products ?? ["personal"]).some((p) => p === flow || p === "*"))
    .sort((a, b) => Number(a.per_reading === false) - Number(b.per_reading === false));
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span> <span>{D.encLinks.payTitle[L]}</span>
        </p>
        <h1>{D.pay.chooseTitle[L]}</h1>
        {offers.length ? (
          <TariffsProvider product={flow ?? "all"} locale={L} server={offers} providers={providers}>
            <PayChoice locale={L} pair={flow === "pair"} carry={carry} />
          </TariffsProvider>
        ) : (
          <div className="panel paybox">
            <h3>{D.encLinks.priceUnknownTitle[L]}</h3>
            <p className="dim">{D.encLinks.priceUnknownText[L]}</p>
          </div>
        )}
      </div>
    </main>
  );
}

export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
