import { requestSite } from "@/lib/siteProfile.server";
import ReportSheet from "@/components/matrix/ReportSheet";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedSections } from "@/lib/sections";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPrintPage } from "../../_lib/access";

type Search = Promise<Record<string, string | string[] | undefined>>;

// Страница существует ради PDF: её открывает браузерный сервис по одноразовому пропуску.
// Ни индексации, ни кеша — на ней платный разбор с датой рождения.
export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { birthLabel, calculate } = localizedMatrix(L);
  const { build, withPositionArticles } = localizedSections(L);
  const { pageMeta } = localizedSite(L, site);

  return { birthLabel, calculate, build, withPositionArticles, pageMeta };
});

// Заголовок документа уезжает в свойства PDF: «Разбор для печати» ничего не говорит о том,
// чей это разбор, а файл человек хранит годами.
export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const L = await requestLocale();
  const { birthLabel, pageMeta } = forLocale(L, await requestSite());

  const params = await searchParams;
  const id = Number(Array.isArray(params.m) ? params.m[0] : params.m);
  const token = String((Array.isArray(params.t) ? params.t[0] : params.t) ?? "");
  const page = Number.isInteger(id) && id > 0 && token ? await readPrintPage(id, token, L) : null;
  return pageMeta({
    title: page ? D.pages.printTitle[L](birthLabel(page.birth)) : D.pages.printFallbackTitle[L],
    description: D.pages.printDescription[L],
    path: "/print/report",
    noindex: true,
  });
}

export default async function PrintReportPage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const { calculate, build, withPositionArticles } = forLocale(L, await requestSite());

  const params = await searchParams;
  const id = Number(Array.isArray(params.m) ? params.m[0] : params.m);
  const token = String((Array.isArray(params.t) ? params.t[0] : params.t) ?? "");
  if (!Number.isInteger(id) || id <= 0 || !token) notFound();

  const page = await readPrintPage(id, token, L);
  if (!page) notFound();

  let matrix;
  try {
    matrix = calculate(page.birth, page.sex);
  } catch {
    notFound();
  }

  return (
    <main className="page printmode">
      <div className="wrap">
        <ReportSheet locale={L}
          matrix={matrix}
          sections={withPositionArticles(matrix, build(matrix, page.unlocked))}
          planName={page.plan}
          unlocked={page.unlocked}
          saved={[]}
          currentId={page.id}
          printing
        />
      </div>
    </main>
  );
}
