import { requestSite } from "@/lib/siteProfile.server";
import PairCalculator, { type MinePair } from "@/components/pair/PairCalculator";
import { pairView } from "@/components/pair/pairView";
import Crumbs from "@/components/ui/Crumbs";
import JsonLd from "@/components/ui/JsonLd";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { publicLocale, requestLocale } from "@/lib/i18n/request";
import { pairUnits } from "@/lib/pair/corpus";
import { computePair } from "@/lib/pair/engine";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "@/components/ui/LocalizedLink";
import { readAccess, readReadings } from "../_lib/access";
import { getBilling } from "@/lib/tariffs.server";
import TariffsProvider from "@/components/pay/TariffsProvider";

// Калькулятор: форма и бесплатная часть считаются в браузере. Пару из кабинета страница читает
// на запрос, поэтому она не предрендерится.
export const dynamic = "force-dynamic";

// Пример до первого расчёта печатается сервером, как карта-пример на главной: иначе в HTML
// для поиска была одна форма.
const EXAMPLE = { a: "2000-01-01", b: "2000-06-01" };

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);
  const metadata: Metadata = pageMeta({
    title: DP.pageTitle[L],
    description: DP.pageDescription[L],
    path: "/compatibility",
  });
  return { metadata };
});

export default async function CompatibilityPage() {
  const L = await requestLocale();
  const { faqLd } = localizedSchema(L, await requestSite());
  const faq = DP.seo.faq.map((item) => ({ q: item.q[L], a: item.a[L] }));
  const { hub, categoryHub } = localizedContent(L);
  const articles = [
    { href: "/compatibility-center", item: hub("compatibility-center") },
    { href: "/encyclopedia/compatibility/tails", item: categoryHub("compatibility-tails") },
    { href: "/business-compatibility", item: hub("business-compatibility") },
  ].flatMap(({ href, item }) => item ? [{ href, label: item.crumb ?? item.title }] : []);
  const example = { ...EXAMPLE, units: pairUnits(L, computePair(EXAMPLE.a, EXAMPLE.b, L), EXAMPLE, false) };
  // без способа оплаты в регионе кнопок покупки нет — как у личного разбора
  const { items: pairOffers, providers } = await getBilling("pair");
  // Как «Мой разбор» открывает свою матрицу, совместимость открывает свою пару: открытую, а если
  // открытых нет — последнюю сохранённую, с покупкой именно этой записи.
  const access = await readAccess();
  const saved = access.authenticated ? await readReadings("pair") : [];
  const newest = [...saved].sort((x, y) => y.created_at.localeCompare(x.created_at));
  const chosen = newest.find((row) => row.access !== "locked") ?? newest[0];
  const view = chosen ? pairView(chosen.inputs, L) : null;
  const inputs = chosen?.inputs as { a?: { name?: unknown }; b?: { name?: unknown } } | undefined;
  const name = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  const mine: MinePair | null = chosen && view ? {
    id: chosen.id,
    pair: { a: { birth: view.dates.a, name: name(inputs?.a?.name) }, b: { birth: view.dates.b, name: name(inputs?.b?.name) } },
    unlocked: chosen.access !== "locked",
    units: pairUnits(L, view.result, view.dates, chosen.access !== "locked"),
  } : null;
  return (
    <main id="content">
      <JsonLd data={faqLd(faq)} />
      <TariffsProvider product="pair" locale={L} server={pairOffers} providers={providers}>
        <PairCalculator example={example} mine={mine} lead={DP.lead[L]} sells={providers === null || providers.length > 0}
          top={<Crumbs locale={L} trail={[{ name: D.nav.home[L], path: "/" }, { name: DP.navTitle[L] }]} />} />
      </TariffsProvider>
      <div className="wrap">
        <section className="prose section-gap" data-testid="compatibility-about">
          <h2>{DP.seo.faqTitle[L]}</h2>
          {faq.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
          {localizedContent(L).categoryHub("compatibility") ? (
            <p>
              {DP.seo.arcanaLine[L]} <Link href="/encyclopedia/compatibility">{DP.encCompat.all[L].toLowerCase()}</Link>.
            </p>
          ) : null}
          {articles.length ? (
            <p data-testid="compatibility-articles">
              {DP.seo.articlesLine[L]}{" "}
              {articles.map((x, i) => (
                <span key={x.href}>{i ? ", " : ""}<Link href={x.href}>{x.label}</Link></span>
              ))}.
            </p>
          ) : null}
          <p>
            {DP.seo.combination[L]} <Link href="/encyclopedia/combination">{DP.seo.combinationLink[L]}</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

export async function generateMetadata() {
  const L = await publicLocale();
  return forLocale(L, await requestSite()).metadata;
}
