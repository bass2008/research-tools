import IndividualArticleView from "@/components/account/IndividualArticleView";
import { PrintLinks } from "@/components/ui/PrintLinks";
import { requestLocale } from "@/lib/i18n/request";
import { individualCardLinks } from "@/lib/individualCardLinks";
import { resolvePrintLinkSite } from "@/lib/siteProfile.config";
import { requestSite } from "@/lib/siteProfile.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPrintIndividual } from "../../_lib/access";

type Search = Promise<Record<string, string | string[] | undefined>>;

// Страница существует ради PDF: её открывает браузерный сервис по одноразовому пропуску.
export const dynamic = "force-dynamic";

function pass(params: Record<string, string | string[] | undefined>): { id: number; token: string } | null {
  const id = Number(Array.isArray(params.r) ? params.r[0] : params.r);
  const token = String((Array.isArray(params.t) ? params.t[0] : params.t) ?? "");
  return Number.isInteger(id) && id > 0 && token ? { id, token } : null;
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const L = await requestLocale();
  const given = pass(await searchParams);
  const row = given ? await readPrintIndividual(given.id, given.token, L) : null;
  return { title: row?.article?.title ?? "Arcana Sense", robots: { index: false, follow: false } };
}

export default async function PrintIndividualPage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const given = pass(await searchParams);
  if (!given) notFound();
  const row = await readPrintIndividual(given.id, given.token, L);
  if (!row?.article) notFound();
  const site = resolvePrintLinkSite(await requestSite(), L);
  return <main className="page printmode theme-gold"><div className="wrap"><PrintLinks site={site} locale={L}>
    <IndividualArticleView row={row} printing links={individualCardLinks(L)} />
  </PrintLinks></div></main>;
}
