import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IndividualArticleView from "@/components/account/IndividualArticleView";
import EncFrame from "@/components/enc/EncFrame";
import ReportSheet from "@/components/matrix/ReportSheet";
import PairReport from "@/components/pair/PairReport";
import { pairView } from "@/components/pair/pairView";
import Link from "@/components/ui/LocalizedLink";
import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { individualCardLinks } from "@/lib/individualCardLinks";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { pairUnits } from "@/lib/pair/corpus";
import { forLocale as localizedSections } from "@/lib/sections";
import { forLocale as localizedSite } from "@/lib/site";
import { requestSite } from "@/lib/siteProfile.server";
import { publicPath } from "@/lib/publicRouting";
import { sharedHeadline } from "@/lib/sharedHeadline";
import { readShared } from "../../_lib/access";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const L = await requestLocale();
  const { pageMeta } = localizedSite(L, await requestSite());
  const token = (await params).token;
  const row = await readShared(token, L);
  const head = row ? sharedHeadline(row, L) : null;
  const meta = pageMeta({
    title: head ? (head.dates ? `${head.title} — ${head.dates}` : head.title) : D.report.sharedTitle[L],
    description: D.report.sharedNote[L], path: `/s/${token}`, noindex: true,
  });
  // the preview shows this reading's own chart, not the site picture
  const image = publicPath(`/s/${token}/og`, L);
  return { ...meta, openGraph: { ...meta.openGraph, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { ...meta.twitter, images: [image] } };
}

function Note({ pair, L }: { pair: boolean; L: "ru" | "en" }) {
  return <p className="shared-note" data-testid="shared-note">
    {D.report.sharedNote[L]} <Link href={pair ? "/compatibility" : "/"}>{pair ? D.report.sharedOwnPair[L] : D.report.sharedOwn[L]}</Link>
  </p>;
}

export default async function SharedReadingPage({ params }: { params: Params }) {
  const locale = await requestLocale();
  const row = await readShared((await params).token, locale);
  if (!row) notFound();
  if (row.shared === "individual") {
    if (!row.article) notFound();
    return <main id="content" className="page individual-page theme-gold"><div className="wrap">
      <Note pair={row.product === "pair"} L={locale} />
      <EncFrame locale={locale} tocOnly mobileToc><IndividualArticleView row={row} links={individualCardLinks(locale)} /></EncFrame>
    </div></main>;
  }
  if (row.product === "pair") {
    const view = pairView(row.inputs, locale);
    if (!view) notFound();
    return <main id="content" className="page"><div className="wrap">
      <Note pair L={locale} />
      <PairReport locale={locale} {...view} units={pairUnits(locale, view.result, view.dates, row.unlocked)} mode={row.unlocked ? "full" : "free"} />
    </div></main>;
  }
  const { calculate } = localizedMatrix(locale);
  const { build, withPositionArticles } = localizedSections(locale);
  const birth = String(row.inputs.birth ?? "");
  let matrix;
  try {
    matrix = calculate(birth, row.inputs.sex === "f" ? "f" : "m");
  } catch {
    notFound();
  }
  return <main id="content" className="page"><div className="wrap">
    <Note pair={false} L={locale} />
    <ReportSheet locale={locale} matrix={matrix} sections={withPositionArticles(matrix, build(matrix, row.unlocked))}
      unlocked={row.unlocked} planName={row.plan} saved={[]} currentId={row.id} shared />
  </div></main>;
}
