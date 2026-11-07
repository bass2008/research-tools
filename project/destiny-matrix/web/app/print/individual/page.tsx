import IndividualArticleView from "@/components/account/IndividualArticleView";
import { PrintLinks } from "@/components/ui/PrintLinks";
import type { Lang } from "@/lib/i18n/lang";
import { requestLocale } from "@/lib/i18n/request";
import { individualCardLinks } from "@/lib/individualCardLinks";
import { individualExample } from "@/lib/individualExamples";
import { resolvePrintLinkSite } from "@/lib/siteProfile.config";
import { requestSite } from "@/lib/siteProfile.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPrintIndividual } from "../../_lib/access";

type Params = Record<string, string | string[] | undefined>;
type Search = Promise<Params>;

// Страница существует ради PDF: её открывает браузерный сервис по одноразовому пропуску.
export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined) => String((Array.isArray(value) ? value[0] : value) ?? "");

// The sample readings are public: they print without a pass.
async function printed(params: Params, L: Lang) {
  if (params.example) return individualExample(one(params.example), L);
  const id = Number(one(params.r)), token = one(params.t);
  return Number.isInteger(id) && id > 0 && token ? readPrintIndividual(id, token, L) : null;
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const L = await requestLocale();
  const row = await printed(await searchParams, L);
  return { title: row?.article?.title ?? "Arcana Sense", robots: { index: false, follow: false } };
}

export default async function PrintIndividualPage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const row = await printed(await searchParams, L);
  if (!row?.article) notFound();
  const site = resolvePrintLinkSite(await requestSite(), L);
  return <main className="page printmode theme-gold"><div className="wrap"><PrintLinks site={site} locale={L}>
    <IndividualArticleView row={row} printing links={individualCardLinks(L)} />
  </PrintLinks></div></main>;
}
