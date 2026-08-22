import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard from "@/components/ArcanumCard";
import Price from "@/components/Price";

import { arcanum, roman } from "@/lib/arcana";
import { allCombinationSlugs, arcanumHref, combination, combinationHref, parseCombinationSlug } from "@/lib/encyclopedia";
import { combinationContent } from "@/lib/content";
import { pageMeta } from "@/lib/site";
import { NOT_FOUND_META } from "@/lib/seo";

type Params = { pair: string };

export function generateStaticParams(): Params[] {
  return allCombinationSlugs().map((pair) => ({ pair }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const pair = parseCombinationSlug((await params).pair);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!pair) return NOT_FOUND_META;
  const [a, b] = pair;
  const c = combination(a, b);
  const extra = combinationContent(c.slug);
  return pageMeta({
    title: extra?.seo?.title ?? `Сочетание ${a} и ${b} аркана — ${extra?.title ?? c.title}`,
    description:
      extra?.seo?.description ??
      `${c.title} в матрице судьбы: как читается пара ${a} и ${b}, сильная сторона сочетания и наложение теней.`,
    path: combinationHref(a, b),
  });
}

export default async function CombinationPage({ params }: { params: Promise<Params> }) {
  const pair = parseCombinationSlug((await params).pair);
  if (!pair) notFound();
  const [a, b] = pair;
  const base = combination(a, b);
  const extra = combinationContent(base.slug);
  const c = {
    ...base,
    title: extra?.title ?? base.title,
    short: extra?.short ?? base.short,
    paragraphs: extra?.meaning ?? base.paragraphs,
  };
  const x = arcanum(a);
  const y = arcanum(b);

  const neighbours = [
    a > 1 ? combinationHref(a - 1, b) : null,
    b < 22 ? combinationHref(a, b + 1) : null,
    a + 1 < b ? combinationHref(a + 1, b) : null,
    b > a + 1 ? combinationHref(a, b - 1) : null,
  ].filter((h): h is string => Boolean(h));

  return (
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/encyclopedia">Энциклопедия</Link>{" "}
          <span>/</span> <Link href={arcanumHref(a)}>{x.title}</Link> <span>+</span>{" "}
          <Link href={arcanumHref(b)}>{y.title}</Link>
        </p>

        <h1>
          {a} и {b}: {c.title}
        </h1>
        <p className="dim prose">{c.short}</p>

        <div className="twocol section-gap">
          <Link className="ecard withcard" href={arcanumHref(a)}>
            <ArcanumCard n={a} size="grid" eager decorative />
            <div>
              <div className="num">
                {a} · {roman(a)}
              </div>
              <div className="nm">{x.title}</div>
              <div className="ds">{x.short}</div>
            </div>
          </Link>
          <Link className="ecard withcard" href={arcanumHref(b)}>
            <ArcanumCard n={b} size="grid" eager decorative />
            <div>
              <div className="num">
                {b} · {roman(b)}
              </div>
              <div className="nm">{y.title}</div>
              <div className="ds">{y.short}</div>
            </div>
          </Link>
        </div>

        <div className="prose section-gap">
          {c.paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>

        <div className="twocol section-gap">
          <div className="panel">
            <h3>Что даёт пара</h3>
            <div className="cap">Сильные стороны обоих арканов</div>
            <ul className="pmlist plus">
              {[...x.plus.slice(0, 3), ...y.plus.slice(0, 3)].map((p, i) => (
                <li key={`${p}-${i}`}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Где спотыкается</h3>
            <div className="cap">Тени, которые усиливают друг друга</div>
            <ul className="pmlist minus">
              {[...x.minus.slice(0, 3), ...y.minus.slice(0, 3)].map((p, i) => (
                <li key={`${p}-${i}`}>{p}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel section-gap">
          <h3>Соседние сочетания</h3>
          <div className="cap">Пары, которые стоят рядом в таблице</div>
          <div className="taglist">
            {neighbours.map((href) => (
              <Link key={href} href={href}>
                {href.split("/").pop()}
              </Link>
            ))}
            <Link href={arcanumHref(a)}>Все сочетания {a} аркана</Link>
            <Link href={arcanumHref(b)}>Все сочетания {b} аркана</Link>
          </div>
        </div>

        <div className="allbox">
          <h3>Есть ли эта пара в вашей карте</h3>
          <p>
            Сочетание работает по-разному в зависимости от позиций: в центре, в линии рода или в денежном
            канале. Постройте октаграмму по своей дате — расчёт бесплатный, дата остаётся в браузере.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу
          </Link>
          <p className="small" style={{ marginTop: 10 }}>
            Полный разбор — <Price />.
          </p>
        </div>
      </div>
    </main>
  );
}
