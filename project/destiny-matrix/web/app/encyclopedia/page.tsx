import { requestSite } from "@/lib/siteProfile.server";
import { forLocale as localizedEncShell } from "@/components/enc/EncShell";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedText } from "@/lib/text";
import type { Metadata } from "next";
import Link from "next/link";

const forLocale = localized((L: Locale, site) => {
  const { articleList, encSections } = localizedEncShell(L);
  const { itemListLd } = localizedSchema(L, site);
  const { pageMeta } = localizedSite(L, site);
  const { clip } = localizedText(L);
  const { encyclopediaSectionHref, encyclopediaSectionHub } = localizedEncyclopediaNavigation(L);

  const metadata: Metadata = pageMeta({
    title: D.enc.title[L],
    description:
      D.enc.description[L],
    path: "/encyclopedia",
  });
  return { articleList, encSections, itemListLd, pageMeta, clip, encyclopediaSectionHref, encyclopediaSectionHub, metadata };
});

// Оглавление, а не список всего. Раньше здесь лежали тела всех восьми разделов сразу, и страница
// раздавала 363 ссылки: 231 пара арканов забирала две трети исходящего веса просто числом, а
// поиск читал справочник как один каталог однотипного. Теперь каждый раздел живёт на своей шапке
// со своим текстом и своим запросом, а эта страница ведёт к шапкам. «Статьи» остаются здесь
// списком: это адреса первого уровня, ветки справочника у них нет.
export default async function EncyclopediaIndexPage() {
  const L = await requestLocale();
  const { articleList, encSections, itemListLd, clip, encyclopediaSectionHref, encyclopediaSectionHub } = forLocale(L, await requestSite());

  const sections = encSections();
  const articles = articleList();
  const withHub = sections.filter((s) => encyclopediaSectionHub(s.key) !== null);

  return (
    <>
      <CrumbsLd locale={L} trail={[{ name: D.nav.home[L], path: "/" }, { name: D.nav.encyclopedia[L] }]} />
      <JsonLd
        data={itemListLd({
          name: D.enc.sectionsName[L],
          items: withHub.map((s) => ({ name: s.title, path: encyclopediaSectionHub(s.key)! })),
        })}
      />

      <div className="cardgrid section-gap">
        {withHub.map((s) => (
          <Link className="ecard" key={s.key} href={encyclopediaSectionHref(s.key)} prefetch={false}>
            <div className="num">{s.count}</div>
            <div className="nm">{s.title}</div>
            <div className="ds">{s.hint}</div>
          </Link>
        ))}
      </div>

      <div className="panel section-gap" id="stati">
        <h2>{D.enc.articles[L]}</h2>
        <div className="cap">{D.enc.articlesHint[L](articles.length)}</div>
        <div className="enc-articles">
          {articles.map((a) => (
            <Link className="enc-article" key={a.href} href={a.href}>
              <span className="an">{a.title}</span>
              <span className="ad">{clip(a.short, 150)}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="panel section-gap">
        <h3>{D.enc.matrixCatalog[L]}</h3>
        <p className="dim prose">
          {D.enc.matrixCatalogText[L]}
        </p>
        <Link href="/matrix">{D.enc.openCatalog[L]}</Link>
      </div>
    </>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
