import { requestSite } from "@/lib/siteProfile.server";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";
import ArcanumCard, { forLocale as localizedArcanumCard } from "@/components/matrix/ArcanumCard";
import { PriceOrFree } from "@/components/pay/Price";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Tabs from "@/components/ui/Tabs";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedPositionArcanum } from "@/lib/positionArcanum";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedText } from "@/lib/text";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { n: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { arcanumImage } = localizedArcanumCard(L);
  const { ARCANA } = localizedArcana(L);
  const { KARMIC_TAIL_HUB, arcanumHref, positionByKey, karmicTailHref, positionHref } = localizedEncyclopedia(L);
  const { arcanumContent, combinationContent, karmicTails } = localizedContent(L);
  const { pageMeta } = localizedSite(L, site);
  const { sentence } = localizedText(L);
  const { articleLd } = localizedSchema(L, site);
  const { positionArcanumHref, positionArcanumLabel, registryItems } = localizedPositionArcanum(L);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { encyclopediaSection, encyclopediaSectionCrumb, encyclopediaSectionHref } = localizedEncyclopediaNavigation(L);

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
  return { arcanumImage, ARCANA, KARMIC_TAIL_HUB, arcanumHref, positionByKey, karmicTailHref, positionHref, arcanumContent, combinationContent, karmicTails, pageMeta, sentence, articleLd, positionArcanumHref, positionArcanumLabel, registryItems, NOT_FOUND_META, encyclopediaSection, encyclopediaSectionCrumb, encyclopediaSectionHref, entry, num };
});

export function generateStaticParams(): Params[] {
  const L = defaultLocale;
  const { ARCANA } = forLocale(L);

  return ARCANA.map((a) => ({ n: String(a.n) }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { arcanumHref, pageMeta, NOT_FOUND_META, entry, num } = forLocale(L, await requestSite());

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
  const L = await requestLocale();
  const { arcanumImage, ARCANA, KARMIC_TAIL_HUB, arcanumHref, positionByKey, karmicTailHref, positionHref, combinationContent, karmicTails, sentence, articleLd, positionArcanumHref, positionArcanumLabel, registryItems, encyclopediaSection, encyclopediaSectionCrumb, encyclopediaSectionHref, entry, num } = forLocale(L, await requestSite());

  const n = num((await params).n);
  if (!n) notFound();
  const e = entry(n);
  const prev = n === 1 ? 22 : n - 1;
  const next = n === 22 ? 1 : n + 1;

  // обратная ссылка на хвосты: аркан — самая посещаемая страница справочника, и без неё
  // разобранные тройки висели бы только на своём хабе
  const crossings = registryItems().filter((item) => item.arcanum === n);
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
      <Faq locale={L} items={e.faq} />
    </>
  );

  const positions = (
    <>
      <div className="cap">
        {D.encArcanum.positionsHint[L]}{" "}
        {/* 18 точек карты разбираются отдельным разделом: со страницы аркана к ним не было хода */}
        <Link href={encyclopediaSectionHref("pts")}>{D.encArcanum.allPositionsLink[L]}</Link>
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
      <div className="cap">{D.encArcanum.combosHint[L]}</div>
      {/* Плашка с парой карт: пара опознаётся по картинке, а не только по имени. Миниатюры
          берём из половинных файлов — 260 px хватает на 46 px с запасом под retina. */}
      <div className="combos">
        {pairs.map((c) => (
          <Link className="combo" key={c.with} href={c.href}>
            <span className="duo">
              <ArcanumCard locale={L} n={n} size="mini" half decorative />
              <ArcanumCard locale={L} n={c.with} size="mini" half decorative />
            </span>
            <span className="cbd">
              <span className="cnm">
                {e.title} {D.encArcanum.and[L]} {ARCANA[c.with - 1].title}
              </span>
              <span className="ctl">{c.short}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );

  // Вкладки «На год» здесь нет намеренно. Она пересказывала первый абзац годовой статьи —
  // совпадение 47–80% шестисловных шинглов, — и по запросу «N аркан на год» Яндекс показывал эту
  // страницу вместо самой статьи (в Google, где корпус тот же, годовые стоят на 10–18 месте, а
  // арканы на 40–50). Год — отдельная тема; ссылка на неё живёт в блоке «Где ещё разбирается».
  const elsewhereTab = (
    <>
      {/* Тот же аркан на конкретных позициях: страница аркана отвечает «какая это энергия»,
          пересечение — «что она делает именно здесь». Спрашивают чаще второе. */}
      {crossings.length ? (
        <>
          <h3 className="section-gap">{D.encArcanum.crossingsTitle[L]}</h3>
          <div className="cap">{D.encArcanum.crossingsHint[L](crossings.length)}</div>
          <div className="taglist">
            {crossings.map((item) => (
              <Link
                key={item.position}
                href={positionArcanumHref(item.position, item.arcanum)}
                prefetch={false}
              >
                {positionArcanumLabel(item)}
              </Link>
            ))}
          </div>
        </>
      ) : null}
      {tails.length ? (
        <>
          <h3 className="section-gap">{D.encArcanum.tailsTitle[L]}</h3>
          <div className="cap">{D.encArcanum.tailsHint[L](n)}</div>
          <div className="taglist">
            {tails.map((t) => (
              <Link key={t.key} href={karmicTailHref(t.key)}>
                {t.key}
              </Link>
            ))}
            <Link href={KARMIC_TAIL_HUB}>{D.encArcanum.allTails[L]}</Link>
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
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
          <ArcanumCard locale={L} n={n} size="grid" eager decorative />
          <figcaption className="arc-cap">
            {n} · {e.title}
          </figcaption>
        </figure>

        <div className="arc-body">
          <h1>{D.encArcanum.h1[L](n, e.title)}</h1>
          <p className="hero-lead">{sentence(e.short)}</p>
          <div className="taglist">
            {e.keywords.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>

          {/* две колонки первого экрана — раздел страницы: без своего h2 иерархия шла
              h1 → h3, и разбор аркана читался как продолжение заголовка */}
          <h2 className="vh">{D.encArcanum.strengthAndShadow[L]}</h2>
          <div className="twocol arc-pm">
            <div className="panel">
              <h3>{D.encArcanum.strength[L]}</h3>
              <div className="cap">{D.encArcanum.strengthHint[L]}</div>
              <ul className="pmlist plus">
                {e.plus.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>{D.encArcanum.shadow[L]}</h3>
              <div className="cap">{D.encArcanum.shadowHint[L]}</div>
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
          { key: "meaning", title: D.encArcanum.tabMeaning[L], body: meaning },
          { key: "positions", title: encyclopediaSection("sec").title, body: positions },
          { key: "combos", title: D.encArcanum.tabCombos[L], body: combos },
          { key: "where", title: D.encArcanum.tabWhere[L], body: elsewhereTab },
        ]}
      />

      <Related locale={L}
        path={arcanumHref(n)}
        refs={[]}
        // блок хвостов на этой же странице уже вывел свои тройки: без этого один и тот же
        // хвост стоял ссылкой дважды. Годовая статья, наоборот, показывается именно здесь —
        // своей вкладки у неё больше нет.
        skip={tails.map((t) => karmicTailHref(t.key))}
        title={D.encArcanum.relatedTitle[L]}
        hint={D.encArcanum.relatedHint[L]}
      />

      <div className="allbox">
        <h3>{D.encArcanum.whereInYourChart[L]}</h3>
        <p>{D.encArcanum.whereInYourChartText[L](n, e.title)}</p>
        <Link className="btn" href="/#calc">
          {D.matrixPages.calcFree[L]}
        </Link>
        <p className="small" style={{ marginTop: 10 }}>
          {D.encArcanum.fullReadingAll[L]} <PriceOrFree locale={L} />.
        </p>
      </div>
    </>
  );
}
