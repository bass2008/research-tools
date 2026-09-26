import EncCrumbs from "@/components/enc/EncCrumbs";
import EncFrame from "@/components/enc/EncFrame";
import EncTitle from "@/components/enc/EncTitle";
import CalcHero from "@/components/matrix/CalcHero";
import MatrixForm from "@/components/matrix/MatrixForm";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation, type EncyclopediaSectionKey } from "@/lib/encyclopediaNavigation";
import { forLocale as localizedHeroSlides } from "@/lib/heroSlides";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import type { ReactNode } from "react";

export const forLocale = localized((L: Locale) => {
  const { ARCANA } = localizedArcana(L);
  const { CHAKRA_PAGES, KARMIC_TAIL_HUB, POSITIONS, YEAR_HUB, allCombinationSlugs, hubCrumb, hubHref } = localizedEncyclopedia(L);
  const { categoryHub, hub, hubKeys, karmicTails, yearKeys } = localizedContent(L);
  const { ENCYCLOPEDIA_SLIDES } = localizedHeroSlides(L);
  const { ENCYCLOPEDIA_SECTIONS } = localizedEncyclopediaNavigation(L);

  // Каркас справочника: первый экран, путь и меню разделов одни на все страницы энциклопедии
  // и на статьи-хабы, которые живут по своим адресам вне /encyclopedia.
  function encSections() {
    const counts: Record<EncyclopediaSectionKey, number> = {
      arc: ARCANA.length,
      sec: POSITIONS.filter((p) => p.kind === "section").length,
      pts: POSITIONS.filter((p) => p.kind !== "section").length,
      chk: CHAKRA_PAGES.length,
      tls: karmicTails().length,
      yer: yearKeys().length,
      cmb: allCombinationSlugs().length,
      art: articlePaths().length,
    };
    return ENCYCLOPEDIA_SECTIONS.map((section) => ({ ...section, count: counts[section.key] }));
  }

  // Статья-шапка категории («Кармический хвост», «Матрица судьбы на год») — такой же разбор
  // понятия, как концепт-хаб: списки троек и годов живут в своих разделах меню.
  function articleList(): { href: string; title: string; crumb: string; short: string }[] {
    const hubs = hubKeys().map((key) => {
      const item = hub(key);
      if (!item) throw new Error(`нет канонического материала хаба ${key}`);
      return {
        href: hubHref(key),
        title: item.title,
        crumb: hubCrumb(key),
        short: item.short,
      };
    });
    const cats = [
      { key: "karmic-tail", href: KARMIC_TAIL_HUB },
      { key: "year", href: YEAR_HUB },
    ].map(({ key, href }) => {
      const item = categoryHub(key);
      if (!item?.crumb) throw new Error(`нет канонического материала или crumb хаба ${key}`);
      return { href, title: item.title, crumb: item.crumb, short: item.short };
    });
    // «Об авторе» замыкает список, поэтому шапки категорий встают перед ней
    const last = hubs.pop();
    return [...hubs, ...cats, ...(last ? [last] : [])];
  }

  function articlePaths(): string[] {
    return articleList().map((a) => a.href);
  }
  return { ARCANA, CHAKRA_PAGES, KARMIC_TAIL_HUB, POSITIONS, YEAR_HUB, allCombinationSlugs, hubCrumb, hubHref, categoryHub, hub, hubKeys, karmicTails, yearKeys, ENCYCLOPEDIA_SLIDES, ENCYCLOPEDIA_SECTIONS, encSections, articleList, articlePaths };
});

export const { encSections, articleList, articlePaths } = forLocale(defaultLocale);

export default function EncShell({ locale: requestedLocale, ...localeProps }: ({ children: ReactNode }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { children } = localeProps;
  const { ARCANA, CHAKRA_PAGES, POSITIONS, ENCYCLOPEDIA_SLIDES, encSections, articleList } = forLocale(L);

  const positionKinds = Object.fromEntries(
    POSITIONS.map((p) => [p.key, p.kind === "section" ? ("sec" as const) : ("pts" as const)]),
  );
  // в крошке — короткое имя: полный заголовок повторял h1 страницы целиком
  const articles = Object.fromEntries(
    articleList().map((a) => [a.href, a.crumb ?? a.title]),
  );

  return (
    <main id="content" className="page">
      <CalcHero locale={L} slides={ENCYCLOPEDIA_SLIDES} h1={false} place="encyclopedia">
        {/* В справочнике отчёта нет: после расчёта сразу открываем карту на главной. Раньше
            оставляли человека в статье с малозаметной второй ссылкой, и кнопка казалась сломанной. */}
        <MatrixForm locale={L} finish={{ kind: "go", href: "/#result" }} place="encyclopedia" />
      </CalcHero>

      <div className="wrap">
        <EncCrumbs locale={L}
          arcana={ARCANA.map((a) => a.title)}
          positions={Object.fromEntries(
            POSITIONS.map((p) => [
              p.key,
              { title: p.title, kind: p.kind === "section" ? ("sec" as const) : ("pts" as const) },
            ]),
          )}
          chakras={Object.fromEntries(CHAKRA_PAGES.map((c) => [c.key, c.title]))}
          articles={articles}
        />

        <EncTitle locale={L} />

        <EncFrame locale={L}
          sections={encSections()}
          positionKinds={positionKinds}
          articlePaths={Object.keys(articles)}
        >
          {children}
        </EncFrame>
      </div>
    </main>
  );
}
