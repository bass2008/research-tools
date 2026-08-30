import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard, { arcanumImage } from "@/components/matrix/ArcanumCard";
import Tabs from "@/components/ui/Tabs";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Sections from "@/components/enc/Sections";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";

import { ARCANA } from "@/lib/arcana";
import {
  KARMIC_TAIL_HUB,
  arcanumHref,
  positionByKey,
  karmicTailHref,
  positionHref,
  yearHref,
} from "@/lib/encyclopedia";
import {
  arcanumContent,
  combinationContent,
  karmicTails,
  yearArcanum,
} from "@/lib/content";
import { pageMeta } from "@/lib/site";
import { sentence } from "@/lib/text";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import {
  encyclopediaSection,
  encyclopediaSectionCrumb,
  encyclopediaSectionHref,
} from "@/lib/encyclopediaNavigation";

type Params = { n: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return ARCANA.map((a) => ({ n: String(a.n) }));
}

function entry(n: number) {
  const value = arcanumContent(n);
  if (!value) throw new Error(`нет канонического материала для аркана ${n}`);
  return value;
}

function num(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 22 ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const n = num((await params).n);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!n) return NOT_FOUND_META;
  const e = entry(n);
  return pageMeta({
    title: e.seo.title,
    description: e.seo.description,
    path: arcanumHref(n),
    article: true,
  });
}

export default async function ArcanumPage({ params }: { params: Promise<Params> }) {
  const n = num((await params).n);
  if (!n) notFound();
  const e = entry(n);
  const prev = n === 1 ? 22 : n - 1;
  const next = n === 22 ? 1 : n + 1;

  const year = yearArcanum(n);
  // обратная ссылка на хвосты: аркан — самая посещаемая страница справочника, и без неё
  // разобранные тройки висели бы только на своём хабе
  const tails = karmicTails().filter((t) => t.arcana.includes(n));
  // Подпись пары берём из написанного текста сочетания. Генератор склеивал «дар первого» с
  // «глаголом второго» и давал бессмыслицу вида «способность запустить то, чего ещё нет рядом с
  // тем, что чувствует» — одинаковую у всех 21 пары. Настоящие тексты лежат в контенте.
  const pairs = e.combinations.map((c) => {
    const [lo, hi] = n < c.with ? [n, c.with] : [c.with, n];
    const written = combinationContent(`${lo}-${hi}`);
    if (!written) throw new Error(`нет канонического материала сочетания ${lo}-${hi}`);
    return { ...c, short: written.short, name: written.title };
  });

  const meaning = (
    <>
      <div className="prose">
        {e.meaning.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
      {/* Грани спроса — «в отношениях», «деньги», «в центре» — приходят из контента отдельными
          секциями: в одном meaning они сливались в простыню без заголовков. */}
      <Sections items={e.sections} />
      <Faq items={e.faq} />
    </>
  );

  const positions = (
    <>
      <div className="cap">
        Один и тот же аркан в разных позициях говорит о разном.{" "}
        {/* 17 точек октаграммы разбираются отдельным разделом: со страницы аркана к ним не было хода */}
        <Link href={encyclopediaSectionHref("pts")}>Все позиции карты</Link>
      </div>
      <dl className="kv">
        {Object.entries(e.inPositions).map(([key, text]) => {
          const pos = positionByKey(key);
          return (
            <div key={key} style={{ display: "contents" }}>
              <dt>{pos ? <Link href={positionHref(key)}>{pos.title}</Link> : key}</dt>
              <dd>{text}</dd>
            </div>
          );
        })}
      </dl>
    </>
  );

  const combos = (
    <>
      <div className="cap">21 пара: аркан рядом с каждым из остальных</div>
      {/* Плашка с парой карт: пара опознаётся по картинке, а не только по имени. Миниатюры
          берём из половинных файлов — 260 px хватает на 46 px с запасом под retina. */}
      <div className="combos">
        {pairs.map((c) => (
          <Link className="combo" key={c.with} href={c.href}>
            <span className="duo">
              <ArcanumCard n={n} size="mini" half decorative />
              <ArcanumCard n={c.with} size="mini" half decorative />
            </span>
            <span className="cbd">
              <span className="cnm">
                {e.title} и {ARCANA[c.with - 1].title}
              </span>
              <span className="ctl">{c.short}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );

  const yearTab = (
    <>
      {year ? (
        <>
          <div className="cap">Тот же аркан в рамке персонального года</div>
          <p>{year.short}</p>
          <p className="small">
            <Link href={yearHref(n)}>{year.title}</Link>
          </p>
        </>
      ) : (
        <p className="dim">Статья про этот аркан в рамке года ещё не написана.</p>
      )}
      {tails.length ? (
        <>
          <h3 className="section-gap">Кармические хвосты с этим арканом</h3>
          <div className="cap">Тройки нижнего угла карты, куда входит {n} аркан</div>
          <div className="taglist">
            {tails.map((t) => (
              <Link key={t.key} href={karmicTailHref(t.key)}>
                {t.key}
              </Link>
            ))}
            <Link href={KARMIC_TAIL_HUB}>Все хвосты</Link>
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          encyclopediaSectionCrumb("arc"),
          { name: `${n} · ${e.title}` },
        ]}
      />

      <JsonLd
        data={articleLd({
          headline: e.seo.title,
          description: e.seo.description,
          path: arcanumHref(n),
          image: arcanumImage(n),
          keywords: e.keywords,
        })}
      />

      {/* Первый экран: карта того же размера, что в колоде раздела, справа — заголовок, лид,
          ключевые слова и две врезки «сильная сторона / изнанка». */}
      <div className="arc-top">
        <figure className="arc-side">
          <ArcanumCard n={n} size="grid" eager decorative />
          <figcaption className="arc-cap">
            {n} · {e.title}
          </figcaption>
        </figure>

        <div className="arc-body">
          <h1>
            {n} в матрице судьбы: {e.title}
          </h1>
          <p className="hero-lead">{sentence(e.short)}</p>
          <div className="taglist">
            {e.keywords.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>

          {/* две колонки первого экрана — раздел страницы: без своего h2 иерархия шла
              h1 → h3, и разбор аркана читался как продолжение заголовка */}
          <h2 className="vh">Сильная сторона и изнанка аркана</h2>
          <div className="twocol arc-pm">
            <div className="panel">
              <h3>Сильная сторона</h3>
              <div className="cap">Что этот аркан даёт</div>
              <ul className="pmlist plus">
                {e.plus.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>Изнанка</h3>
              <div className="cap">Как тот же аркан работает против</div>
              <ul className="pmlist minus">
                {e.minus.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        items={[
          { key: "meaning", title: "Значение", body: meaning },
          { key: "positions", title: encyclopediaSection("sec").title, body: positions },
          { key: "combos", title: "Сочетания с другими арканами", body: combos },
          { key: "year", title: "На год", body: yearTab },
        ]}
      />

      <Related
        path={arcanumHref(n)}
        refs={[]}
        // блок хвостов на этой же странице уже вывел свои тройки: без этого один и тот же
        // хвост стоял ссылкой дважды
        skip={[...(year ? [yearHref(n)] : []), ...tails.map((t) => karmicTailHref(t.key))]}
        title="Где ещё разбирается этот аркан"
        hint="Статьи, которые ссылаются на эту страницу"
      />

      <div className="allbox">
        <h3>Где этот аркан в вашей карте</h3>
        <p>
          Аркан {n} ({e.title}) может стоять в центре, в линии рода или в денежном канале — от
          позиции зависит всё. Постройте свою октаграмму: расчёт бесплатный и идёт в браузере.
        </p>
        <Link className="btn" href="/#calc">
          Рассчитать матрицу бесплатно
        </Link>
        <p className="small" style={{ marginTop: 10 }}>
          Полный разбор всех 20 разделов — <Price />.
        </p>
      </div>
    </>
  );
}
