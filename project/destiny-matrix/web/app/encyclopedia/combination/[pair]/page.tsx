import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard from "@/components/matrix/ArcanumCard";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";

import { arcanum } from "@/lib/arcana";
import { buildCombinationArticle } from "@/lib/combinationReading";
import {
  allCombinationSlugs,
  arcanumHref,
  combinationHref,
  parseCombinationSlug,
  positionHref,
} from "@/lib/encyclopedia";
import { arcanumContent, combinationContent } from "@/lib/content";
import { pageMeta } from "@/lib/site";
import { sentence } from "@/lib/text";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

type Params = { pair: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return allCombinationSlugs().map((pair) => ({ pair }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const pair = parseCombinationSlug((await params).pair);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!pair) return NOT_FOUND_META;
  const [a, b] = pair;
  const extra = combinationContent(`${a}-${b}`);
  if (!extra) throw new Error(`нет канонического материала сочетания ${a}-${b}`);
  return pageMeta({
    title: extra.seo.title,
    description: extra.seo.description,
    path: combinationHref(a, b),
    article: true,
  });
}

export default async function CombinationPage({ params }: { params: Promise<Params> }) {
  const pair = parseCombinationSlug((await params).pair);
  if (!pair) notFound();
  const [a, b] = pair;
  const c = combinationContent(`${a}-${b}`);
  if (!c) throw new Error(`нет канонического материала сочетания ${a}-${b}`);
  const x = arcanum(a);
  const y = arcanum(b);
  const xContent = arcanumContent(a);
  const yContent = arcanumContent(b);
  if (!xContent || !yContent) throw new Error(`нет канонических материалов арканов ${a} и ${b}`);
  const article = buildCombinationArticle(a, b);

  const neighbours = [
    a > 1 ? combinationHref(a - 1, b) : null,
    b < 22 ? combinationHref(a, b + 1) : null,
    a + 1 < b ? combinationHref(a + 1, b) : null,
    b > a + 1 ? combinationHref(a, b - 1) : null,
  ].filter((h): h is string => Boolean(h));

  return (
    <>

      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          encyclopediaSectionCrumb("cmb"),
          { name: `${a} и ${b}` },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: c.seo.title,
            description: c.seo.description,
            path: combinationHref(a, b),
            keywords: [`${a} и ${b} в матрице судьбы`, `сочетание ${a} и ${b} аркана`],
          })}
        />

        {/* Первый экран как на странице аркана: слева пара карт — здесь их две, поэтому крупнее,
            чем миниатюры в блоке сочетаний; справа заголовок, лид и вход в расчёт. */}
      <div className="arc-top pair">
        <figure className="arc-side pair">
          <ArcanumCard n={a} size="grid" eager decorative />
          <ArcanumCard n={b} size="grid" eager decorative />
          <figcaption className="arc-cap">
            {a} · {x.title} и {b} · {y.title}
          </figcaption>
        </figure>

        <div className="arc-body">
          <h1>
            {a} и {b}: {c.title}
          </h1>
          <p className="hero-lead">{sentence(c.short)}</p>
          <div className="taglist">
            <Link href={arcanumHref(a)}>
              {a} · {x.title}
            </Link>
            <Link href={arcanumHref(b)}>
              {b} · {y.title}
            </Link>
          </div>
        </div>
      </div>

        <div className="prose section-gap">
          {c.meaning.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>

        <h2 className="vh">Что даёт пара и где спотыкается</h2>
        <div className="twocol section-gap">
          <div className="panel">
            <h3>Что даёт пара</h3>
            <div className="cap">Сильные стороны обоих арканов</div>
            <ul className="pmlist plus">
              {[...xContent.plus.slice(0, 3), ...yContent.plus.slice(0, 3)].map((p, i) => (
                <li key={`${p}-${i}`}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Где спотыкается</h3>
            <div className="cap">Тени, которые усиливают друг друга</div>
            <ul className="pmlist minus">
              {[...xContent.minus.slice(0, 3), ...yContent.minus.slice(0, 3)].map((p, i) => (
                <li key={`${p}-${i}`}>{p}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="section-gap">
          <h2>Как {a} и {b} работают в характере</h2>
          <p className="dim prose">
            Одна пара читается по-разному в зависимости от порядка точек. Ниже показаны оба
            варианта для трёх связей раздела «Характер и личные качества».
          </p>
          {article.contexts.map((context) => (
            <section className="section-gap" key={context.key}>
              <h3>{context.title}</h3>
              <p className="dim prose">{context.question}.</p>
              <div className="twocol">
                {context.variants.map((variant) => (
                  <div className="panel" key={`${context.key}-${variant.order}`}>
                    <h3>{variant.heading}</h3>
                    <div className="cap">Порядок точек {variant.order}</div>
                    {variant.paragraphs.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="panel section-gap">
          <h2>Как проверить сочетание на практике</h2>
          <div className="cap">Сначала позиции, затем реальная ситуация</div>
          {article.practice.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="encref">
            <Link href={positionHref("character")}>
              Как читается раздел «Характер и личные качества» →
            </Link>
          </p>
        </div>

        <div className="panel section-gap">
          <h2>Соседние сочетания</h2>
          <div className="cap">Пары, которые стоят рядом в таблице</div>
          <div className="taglist">
            {/* голый слаг «4-9» ничего не говорит: подписываем парой имён, как везде */}
            {neighbours.map((href) => {
              const pairSlug = href.split("/").pop() ?? "";
              const [p1, p2] = pairSlug.split("-").map(Number);
              return (
                <Link key={href} href={href}>
                  {p1} · {arcanum(p1).title} и {p2} · {arcanum(p2).title}
                </Link>
              );
            })}
            {/* подпись обещает список сочетаний — значит и открывать надо его вкладку,
                а не «Значение», где сочетаний на экране нет */}
            <Link href={`${arcanumHref(a)}?tab=combos`}>Все сочетания {a} аркана</Link>
            <Link href={`${arcanumHref(b)}?tab=combos`}>Все сочетания {b} аркана</Link>
          </div>
        </div>

        <div className="allbox">
          <h2>Есть ли эта пара в вашей карте</h2>
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
    </>
  );
}
