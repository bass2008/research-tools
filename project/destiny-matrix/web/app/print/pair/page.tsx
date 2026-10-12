import { resolvePrintLinkSite } from "@/lib/siteProfile.config";
import { requestSite } from "@/lib/siteProfile.server";
import PairReport from "@/components/pair/PairReport";
import { pairView } from "@/components/pair/pairView";
import { DP } from "@/lib/i18n/dict/pair";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { pairUnits } from "@/lib/pair/corpus";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPrintReading } from "../../_lib/access";

type Search = Promise<Record<string, string | string[] | undefined>>;

// Страница существует ради PDF: её открывает браузерный сервис по одноразовому пропуску.
export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);
  return { pageMeta };
});

function pass(params: Record<string, string | string[] | undefined>): { id: number; token: string } | null {
  const id = Number(Array.isArray(params.r) ? params.r[0] : params.r);
  const token = String((Array.isArray(params.t) ? params.t[0] : params.t) ?? "");
  return Number.isInteger(id) && id > 0 && token ? { id, token } : null;
}

// Заголовок уезжает в свойства PDF: файл человек хранит годами, и в нём должно быть видно, чей это разбор.
export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const L = await requestLocale();
  const { pageMeta } = forLocale(L, await requestSite());
  const given = pass(await searchParams);
  const row = given ? await readPrintReading(given.id, given.token, L) : null;
  return pageMeta({
    title: row?.title ? DP.pdfTitle[L](row.title) : DP.savedTitle[L],
    description: DP.savedDescription[L],
    path: "/print/pair",
    noindex: true,
  });
}

export default async function PrintPairPage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const site = await requestSite();
  const given = pass(await searchParams);
  if (!given) notFound();
  const row = await readPrintReading(given.id, given.token, L);
  if (!row || row.product !== "pair") notFound();
  const view = pairView(row.inputs, L);
  if (!view) notFound();

  return (
    <main className="page printmode">
      <div className="wrap">
        <PairReport
          locale={L}
          publicHref={localizedSite(L, resolvePrintLinkSite(site, L)).publicHref}
          {...view}
          units={pairUnits(L, view.result, view.dates, row.unlocked)}
          mode={row.unlocked ? "full" : "free"}
          printing
        />
      </div>
    </main>
  );
}
