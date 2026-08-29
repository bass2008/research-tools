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

// Каркас справочника: первый экран, путь и меню разделов одни на все страницы энциклопедии
// и на статьи-хабы, которые живут по своим адресам вне /encyclopedia.
export function encSections() {
  return [
    { key: "arc", title: "22 аркана", count: ARCANA.length, hint: "значение каждого числа" },
    {
      key: "sec",
      title: "Разделы отчёта",
      count: POSITIONS.filter((p) => p.kind === "section").length,
      hint: "что показывает полный разбор",
    },
    {
      key: "pts",
      title: "Позиции карты",
      count: POSITIONS.filter((p) => p.kind !== "section").length,
      hint: "точки октаграммы и линии рода",
    },
    { key: "chk", title: "Семь чакр", count: CHAKRA_PAGES.length, hint: "карта энергий по уровням" },
    {
      key: "tls",
      title: "Кармические хвосты",
      count: karmicTails().length,
      hint: "тройки нижнего угла карты",
    },
    {
      key: "yer",
      title: "Матрица судьбы на год",
      count: yearKeys().length,
      hint: "аркан в рамке персонального года",
    },
    {
      key: "cmb",
      title: "Сочетания арканов",
      count: allCombinationSlugs().length,
      hint: "пары арканов рядом",
    },
    {
      key: "art",
      title: "Статьи",
      count: articlePaths().length,
      hint: "разборы понятий целиком",
    },
  ];
}

// Статья-шапка категории («Кармический хвост», «Матрица судьбы на год») — такой же разбор
// понятия, как концепт-хаб: списки троек и годов живут в своих разделах меню.
export function articleList(): { href: string; title: string; crumb: string; short: string }[] {
  const hubs = hubKeys().map((key) => {
    const item = hub(key);
    return {
      href: hubHref(key),
      title: item?.title ?? key,
      crumb: hubCrumb(key),
      short: item?.short ?? "",
    };
  });
  const cats = [
    { key: "karmic-tail", href: KARMIC_TAIL_HUB },
    { key: "na-god", href: YEAR_HUB },
  ].map(({ key, href }) => {
    const item = categoryHub(key);
    const crumb = key === "karmic-tail" ? "Кармический хвост" : "Матрица судьбы на год";
    return { href, title: item?.title ?? key, crumb, short: item?.short ?? "" };
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
