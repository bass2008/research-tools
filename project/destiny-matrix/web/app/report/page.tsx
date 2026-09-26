import { requestSite } from "@/lib/siteProfile.server";
import ReportView from "@/components/matrix/ReportView";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSections } from "@/lib/sections";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pickMatrix, readAccess, readSavedMatrices } from "../_lib/access";
import { SavedReport, Sheet } from "../_lib/report";

// Страница печатается на запрос: доступ к платным разделам знает только сервер — по
// httpOnly-куке. Предрендер здесь означал бы, что толкования всех платных разделов лежат в
// готовом HTML и видны любому, кто откроет исходник.
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const forLocale = localized((L: Locale, site) => {
  const { freePositionArticles, freePositionTexts } = localizedSections(L);
  const { pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.reportTitle[L],
    description:
      D.pages.reportDescription[L],
    path: "/report",
    noindex: true,
  });

  const OTHER = <Link href="/encyclopedia">{D.nav.encyclopedia[L]}</Link>;
  return { freePositionArticles, freePositionTexts, pageMeta, metadata, OTHER };
});

export default async function ReportPage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const { freePositionArticles, freePositionTexts, OTHER } = forLocale(L, await requestSite());

  const wanted = (await searchParams).m;
  const access = await readAccess();
  // Дата из браузера и запись в кабинете связываются по id: без списка кнопка под бесплатным
  // разбором выбирала первую закрытую запись, а не ту, которую человек сейчас читает.
  const saved = access.authenticated ? await readSavedMatrices() : [];
  const chosen = pickMatrix(saved, wanted);

  // явный `?m=` на чужую или несуществующую матрицу — это 404, а не «покажем свою»
  if (wanted && !chosen) notFound();

  // Открыт ли разбор, решает сервер и присылает это в самой записи (`access` → `unlocked`).
  // Раньше страница считала доступ сама, по наличию прав, и на витрине без кассы — где прав не
  // заводят — отвечала «матрица не выбрана» при открытой записи в кабинете.
  if (chosen?.unlocked) {
    return (
      <Sheet locale={L} other={OTHER}>
        <SavedReport locale={L} chosen={chosen} saved={saved} access={access} />
      </Sheet>
    );
  }

  return (
    <Sheet locale={L} other={OTHER}>
      {access.offline ? <div className="err">{D.pages.reportOffline[L]}</div> : null}
      <ReportView locale={L}
        granted={access.paid}
        texts={freePositionTexts()}
        articles={freePositionArticles()}
        saved={saved}
      />
    </Sheet>
  );
}
export async function generateMetadata() {
  return forLocale(await requestLocale(), await requestSite()).metadata;
}
