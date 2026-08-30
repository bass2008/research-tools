import type { ReactNode } from "react";

import CalcHero from "@/components/matrix/CalcHero";
import EncCrumbs from "@/components/enc/EncCrumbs";
import EncFrame from "@/components/enc/EncFrame";
import EncTitle from "@/components/enc/EncTitle";
import MatrixForm from "@/components/matrix/MatrixForm";

import { ARCANA } from "@/lib/arcana";
import {
  CHAKRA_PAGES,
  KARMIC_TAIL_HUB,
  POSITIONS,
  YEAR_HUB,
  allCombinationSlugs,
  hubCrumb,
  hubHref,
} from "@/lib/encyclopedia";
import { categoryHub, hub, hubKeys, karmicTails, yearKeys } from "@/lib/content";
import { ENCYCLOPEDIA_SLIDES } from "@/lib/heroSlides";
import { ENCYCLOPEDIA_SECTIONS, type EncyclopediaSectionKey } from "@/lib/encyclopediaNavigation";

// Каркас справочника: первый экран, путь и меню разделов одни на все страницы энциклопедии
// и на статьи-хабы, которые живут по своим адресам вне /encyclopedia.
export function encSections() {
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
export function articleList(): { href: string; title: string; crumb: string; short: string }[] {
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
    { key: "na-god", href: YEAR_HUB },
  ].map(({ key, href }) => {
    const item = categoryHub(key);
    if (!item?.crumb) throw new Error(`нет канонического материала или crumb хаба ${key}`);
    return { href, title: item.title, crumb: item.crumb, short: item.short };
  });
  // «Об авторе» замыкает список, поэтому шапки категорий встают перед ней
  const last = hubs.pop();
  return [...hubs, ...cats, ...(last ? [last] : [])];
}

export function articlePaths(): string[] {
  return articleList().map((a) => a.href);
}

export default function EncShell({ children }: { children: ReactNode }) {
  const positionKinds = Object.fromEntries(
    POSITIONS.map((p) => [p.key, p.kind === "section" ? ("sec" as const) : ("pts" as const)]),
  );
  // в крошке — короткое имя: полный заголовок повторял h1 страницы целиком
  const articles = Object.fromEntries(
    articleList().map((a) => [a.href, a.crumb ?? a.title]),
  );

  return (
    <main id="content" className="page">
      <CalcHero slides={ENCYCLOPEDIA_SLIDES} h1={false} place="encyclopedia">
        {/* В справочнике отчёта нет: после расчёта сразу открываем карту на главной. Раньше
            оставляли человека в статье с малозаметной второй ссылкой, и кнопка казалась сломанной. */}
        <MatrixForm finish={{ kind: "go", href: "/#result" }} place="encyclopedia" />
      </CalcHero>

      <div className="wrap">
        <EncCrumbs
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

        <EncTitle />

        <EncFrame
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
