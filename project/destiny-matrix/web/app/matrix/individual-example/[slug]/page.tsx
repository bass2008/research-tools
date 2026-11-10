import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IndividualArticleView from "@/components/account/IndividualArticleView";
import ExampleGoal from "@/components/individual/ExampleGoal";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Link from "@/components/ui/LocalizedLink";
import EncFrame from "@/components/enc/EncFrame";
import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import { requestSite } from "@/lib/siteProfile.server";
import { individualCardLinks } from "@/lib/individualCardLinks";
import { EXAMPLE_LABEL, EXAMPLE_SLUGS, individualExample, leadSentence, type ExampleSlug } from "@/lib/individualExamples";

const EXAMPLE_LANGS = ["ru", "en"] as const;

export const dynamic = "force-dynamic";

// Examples are open to search: a whole reading on a sample date is the best answer to "what is inside".
// A language whose translation is not there yet shows the Russian text and stays out of the index.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const L = await requestLocale(), en = L === "en";
  const row = individualExample(slug, L);
  if (!row?.article) return { robots: { index: false, follow: true } };
  const everywhere = EXAMPLE_LANGS.every((lang) => individualExample(slug, lang)?.locale === lang);
  const label = EXAMPLE_LABEL[slug as ExampleSlug][en ? 1 : 0];
  const meta = localizedSite(L, await requestSite()).pageMeta({
    title: D.individualSale.exampleTitle[L](label), description: D.individualSale.exampleDescription[L](label, leadSentence(row.article.lead)),
    path: `/matrix/individual-example/${slug}`, noindex: row.locale !== L, follow: true,
  });
  // the language pair only when the other language's example is translated and open to search
  return everywhere ? meta : { ...meta, alternates: { canonical: meta.alternates?.canonical } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const L = await requestLocale(), en = L === "en";
  const row = individualExample(slug, L);
  if (!row) notFound();
  const T = D.individualSale;
  const tab = (s: ExampleSlug) => s === "year" ? T.kindYear[L](individualExample("year", L)?.year ?? 0) : s === "pair" ? T.kindPair[L]
    : s === "child" ? T.childTag[L] : T.kindPersonal[L];
  return <main id="content" className="page individual-page theme-gold">
    <ExampleGoal example={slug} />
    <CrumbsLd locale={L} trail={[{ name: D.nav.home[L], path: "/" }, { name: D.nav.individual[L], path: "/individual" },
      { name: EXAMPLE_LABEL[slug as ExampleSlug][en ? 1 : 0] }]} />
    <nav className="ix-top" aria-label={T.exampleTabs[L]}>
      <span className="ix-brand">{T.exampleBrand[L]}</span>
      <div className="ix-tabs">
        {EXAMPLE_SLUGS.map((s) => <Link key={s} href={`/matrix/individual-example/${s}`} aria-current={s === slug ? "page" : undefined}
          className={s === slug ? "on" : undefined}>{tab(s)}</Link>)}
      </div>
    </nav>
    <div className="wrap">
    <p className="ir-example-note" data-testid="individual-example-note">{en
      ? "This is an example of an individual reading for a sample date. Your reading is written for your date and your question."
      : "Это пример индивидуального разбора на условную дату. Ваш разбор пишется по вашей дате и вашему вопросу."}</p>
    <EncFrame locale={L} tocOnly mobileToc><IndividualArticleView row={{ ...row, example: slug }} links={individualCardLinks(L)} /></EncFrame>
  </div></main>;
}
