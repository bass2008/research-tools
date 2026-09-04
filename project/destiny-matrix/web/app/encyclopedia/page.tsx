import type { Metadata } from "next";
import Link from "next/link";

import CrumbsLd from "@/components/ui/CrumbsLd";
import { articleList, encSections } from "@/components/enc/EncShell";

import { itemListLd } from "@/lib/schema";
import { pageMeta } from "@/lib/site";
import { clip } from "@/lib/text";
import JsonLd from "@/components/ui/JsonLd";
import { encyclopediaSectionHref, encyclopediaSectionHub } from "@/lib/encyclopediaNavigation";

export const metadata: Metadata = pageMeta({
  title: "Энциклопедия матрицы судьбы: арканы, позиции, чакры",
  description:
    "Справочник по матрице судьбы: значения 22 арканов, 20 разделов отчёта, 17 позиций карты, " +
    "7 чакр и 231 сочетание арканов. Все страницы с перекрёстными ссылками.",
  path: "/encyclopedia",
});

// Оглавление, а не список всего. Раньше здесь лежали тела всех восьми разделов сразу, и страница
// раздавала 363 ссылки: 231 пара арканов забирала две трети исходящего веса просто числом, а
// поиск читал справочник как один каталог однотипного. Теперь каждый раздел живёт на своей шапке
// со своим текстом и своим запросом, а эта страница ведёт к шапкам. «Статьи» остаются здесь
// списком: это адреса первого уровня, ветки справочника у них нет.
export default function EncyclopediaIndexPage() {
  const sections = encSections();
  const articles = articleList();
  const withHub = sections.filter((s) => encyclopediaSectionHub(s.key) !== null);

  return (
    <>
      <CrumbsLd trail={[{ name: "Главная", path: "/" }, { name: "Энциклопедия" }]} />
      <JsonLd
        data={itemListLd({
          name: "Разделы справочника",
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

      <div className="panel section-gap">
        <h2>Статьи</h2>
        <div className="cap">Разборы понятий целиком · {articles.length}</div>
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
        <h3>Каталог матриц</h3>
        <p className="dim prose">
          Все карты по свёрнутым числам даты: день, месяц и год после свёртки дают три аркана, и
          вариантов таких троек ровно 5 544.
        </p>
        <Link href="/matrix">Открыть каталог</Link>
      </div>
    </>
  );
}
