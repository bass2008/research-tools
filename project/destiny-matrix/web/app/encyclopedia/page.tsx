import type { Metadata } from "next";
import Link from "next/link";

import EncyclopediaSearch, { type SearchItem } from "@/components/EncyclopediaSearch";
import ArcanumCard from "@/components/ArcanumCard";

import { ARCANA, roman } from "@/lib/arcana";
import {
  CHAKRA_PAGES,
  ENCYCLOPEDIA_PAGE_COUNT,
  POSITIONS,
  allCombinationSlugs,
  arcanumHref,
  chakraHref,
  combination,
  parseCombinationSlug,
  positionHref,
} from "@/lib/encyclopedia";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Энциклопедия матрицы судьбы: 22 аркана, позиции карты, чакры и сочетания",
  description:
    "Справочник по матрице судьбы: значения 22 арканов, 37 позиций карты, 7 чакр и 231 сочетание " +
    "арканов. Все страницы с перекрёстными ссылками.",
  path: "/encyclopedia",
});

export default function EncyclopediaIndexPage() {
  const combos = allCombinationSlugs();
  const items: SearchItem[] = [
    ...ARCANA.map((a) => ({
      href: arcanumHref(a.n),
      title: `${a.n} аркан — ${a.title}`,
      hint: `${a.short} ${a.keywords.join(" ")}`,
      group: "аркан",
    })),
    ...POSITIONS.map((p) => ({
      href: positionHref(p.key),
      title: p.title,
      hint: `${p.lead} ${p.key}`,
      group: p.kind === "section" ? "раздел отчёта" : "позиция карты",
    })),
    ...CHAKRA_PAGES.map((c) => ({
      href: chakraHref(c.key),
      title: `Чакра ${c.index} — ${c.title}`,
      hint: c.hint,
      group: "чакра",
    })),
    ...combos.map((slug) => {
      const [a, b] = parseCombinationSlug(slug)!;
      const c = combination(a, b);
      return {
        href: `/encyclopedia/combination/${slug}`,
        title: `${a} и ${b} — ${c.title}`,
        hint: c.short,
        group: "сочетание",
      };
    }),
  ];

  return (
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <span>Энциклопедия</span>
        </p>
        <h1>Энциклопедия матрицы судьбы</h1>
        <p className="dim prose">
          Справочник, на который ссылается каждая позиция отчёта: {ARCANA.length} арканов,{" "}
          {POSITIONS.length} позиций карты, {CHAKRA_PAGES.length} чакр и {combos.length} сочетаний — всего{" "}
          {ENCYCLOPEDIA_PAGE_COUNT} страниц. Разборы всех 5544 карт — в{" "}
          <Link href="/matrix">каталоге матриц</Link>, расчёт по своей дате —{" "}
          <Link href="/#calc">на главной</Link>.
        </p>

        <div className="section-gap">
          <EncyclopediaSearch items={items} />
        </div>

        <h2 className="section-gap">22 аркана</h2>
        <div className="cardgrid deck">
          {ARCANA.map((a) => (
            <Link className="ecard withcard" key={a.n} href={arcanumHref(a.n)}>
              <ArcanumCard n={a.n} size="grid" decorative />
              <div>
                <div className="num">
                  {a.n} · {roman(a.n)}
                </div>
                <div className="nm">{a.title}</div>
                <div className="ds">{a.short}</div>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="section-gap">Разделы отчёта</h2>
        <div className="cardgrid">
          {POSITIONS.filter((p) => p.kind === "section").map((p) => (
            <Link className="ecard" key={p.key} href={positionHref(p.key)}>
              <div className="num">раздел</div>
              <div className="nm">{p.title}</div>
              <div className="ds">{p.lead}</div>
            </Link>
          ))}
        </div>

        <h2 className="section-gap">Позиции карты</h2>
        <div className="cardgrid">
          {POSITIONS.filter((p) => p.kind === "point").map((p) => (
            <Link className="ecard" key={p.key} href={positionHref(p.key)}>
              <div className="num">позиция</div>
              <div className="nm">{p.title}</div>
              <div className="ds">{p.lead}</div>
            </Link>
          ))}
        </div>

        <h2 className="section-gap">Семь чакр</h2>
        <div className="cardgrid">
          {CHAKRA_PAGES.map((c) => (
            <Link className="ecard" key={c.key} href={chakraHref(c.key)}>
              <div className="num">чакра {c.index}</div>
              <div className="nm">{c.title}</div>
              <div className="ds">{c.hint}</div>
            </Link>
          ))}
        </div>

        <h2 className="section-gap">Сочетания арканов</h2>
        <p className="dim">
          {combos.length} страниц: каждая пара арканов от 1–2 до 21–22. Ниже — вход по первому аркану.
        </p>
        <div className="cardgrid">
          {ARCANA.map((a) => (
            <div className="ecard" key={`c${a.n}`}>
              <div className="num">{a.n} аркан</div>
              <div className="nm">{a.title}</div>
              <div className="taglist" style={{ marginTop: 8 }}>
                {ARCANA.filter((b) => b.n !== a.n).map((b) => {
                  const [lo, hi] = a.n < b.n ? [a.n, b.n] : [b.n, a.n];
                  return (
                    <Link key={`${a.n}-${b.n}`} href={`/encyclopedia/combination/${lo}-${hi}`}>
                      {b.n}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
