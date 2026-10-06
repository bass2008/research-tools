import { requestSite } from "@/lib/siteProfile.server";
import PositionMap from "@/components/enc/PositionMap";
import Sections, { Paragraphs } from "@/components/enc/Sections";
import TocHeading from "@/components/enc/TocHeading";
import CalcPromo from "@/components/matrix/CalcPromo";
import ChakraAtlasExample from "@/components/matrix/ChakraAtlasExample";
import Price from "@/components/pay/Price";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import { ALL_FREE } from "@/lib/access";
import { exampleDay } from "@/lib/today";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { forLocale as localizedEncyclopediaNavigation } from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedMatrixMap } from "@/lib/matrixMap";
import { forLocale as localizedSchema } from "@/lib/schema";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = { key: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

const forLocale = localized((L: Locale, site) => {
  const { ARCANA } = localizedArcana(L);
  const { CHAKRA_PAGES, arcanumHref, chakraByKey, chakraHref, positionHref } = localizedEncyclopedia(L);
  const { chakraContent } = localizedContent(L);
  const { mapPointsBySymbol } = localizedMatrixMap(L);
  const { pageMeta } = localizedSite(L, site);
  const { articleLd } = localizedSchema(L, site);
  const { NOT_FOUND_META } = localizedSeo(L, site);
  const { encyclopediaSectionCrumb } = localizedEncyclopediaNavigation(L);

  return { ARCANA, CHAKRA_PAGES, arcanumHref, chakraByKey, chakraHref, positionHref, chakraContent, mapPointsBySymbol, pageMeta, articleLd, NOT_FOUND_META, encyclopediaSectionCrumb };
});

export function generateStaticParams(): Params[] {
  const L = defaultLocale;
  const { CHAKRA_PAGES } = forLocale(L);

  return CHAKRA_PAGES.map((c) => ({ key: c.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await publicLocale();
  const { chakraByKey, chakraHref, chakraContent, pageMeta, NOT_FOUND_META } = forLocale(L, await requestSite());

  const c = chakraByKey((await params).key);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!c) return NOT_FOUND_META;
  const extra = chakraContent(c.key);
  if (!extra) throw new Error(`нет канонического материала чакры ${c.key}`);
  const seo = extra.article?.seo ?? extra.seo;
  return pageMeta({
    title: seo.title,
    description: seo.description,
    path: chakraHref(c.key),
    article: true,
  });
}

export default async function ChakraPage({ params }: { params: Promise<Params> }) {
  const L = await requestLocale();
  const { ARCANA, CHAKRA_PAGES, arcanumHref, chakraByKey, chakraHref, positionHref, chakraContent, mapPointsBySymbol, articleLd, encyclopediaSectionCrumb } = forLocale(L, await requestSite());

  const c = chakraByKey((await params).key);
  if (!c) notFound();
  const extra = chakraContent(c.key);
  if (!extra) throw new Error(`нет канонического материала чакры ${c.key}`);
  if (extra.article) {
    return <ChakraArticlePage locale={L} chakraKey={c.key} />;
  }
  const paragraphs = extra.level;
  // Уровень — это горизонтальная пара точек карты, и «где находится свадхистана» спрашивают
  // ровно про место. Символы пары лежат в контракте метода.
  const spots = mapPointsBySymbol([c.physics, c.energy]);
  const title = extra.seo.title;

  return (
    <>

      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("chk"),
          { name: c.title },
        ]}
      />
      <JsonLd
        data={articleLd({
          headline: title,
          description: extra.seo.description,
          path: chakraHref(c.key),
        })}
      />

      {/* Форма запроса, а не только имя: «чакра <имя> в матрице судьбы» — единственная
            формулировка со спросом у верхних трёх чакр, а «<имя> — уровень N» не спрашивает
            никто. Номер уровня остаётся, но после названия страницы. */}
      <h1>
        {extra.readings.length ? D.encChakra.readingTitle[L](c.title) : D.encChakra.h1[L](c.title, c.index)}
      </h1>
      <p className="dim prose">{c.hint}</p>

      {extra.readings.length ? (
        <div className="prose section-gap">
          {paragraphs.map((text, i) => <p key={i}>{text}</p>)}
          <nav aria-label={D.encChakra.onPage[L]} className="taglist">
            <Link href="#calculation">{D.encChakra.howCounted[L]}</Link>
            <Link href="#reading">{D.encChakra.readingSteps[L]}</Link>
            <Link href="#examples">{D.encChakra.examples[L]}</Link>
            <Link href="#numbers">{D.encChakra.numbers[L]}</Link>
            <Link href="#questions">{D.octagram.faqTitle[L]}</Link>
          </nav>
        </div>
      ) : null}

      <PositionMap locale={L}
        highlight={spots}
        caption={D.encChakra.caption[L](
          spots.map((x) => `${x.label} · ${x.symbol}`).join(` ${D.encArcanum.and[L]} `),
        )}
      />

      <div className="prose section-gap">
        {!extra.readings.length && paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <TocHeading id="calculation">{D.encChakra.howCounted[L]}</TocHeading>
        <p>
          {D.encChakra.howCountedText[L](c.title, c.physics, c.energy)}
        </p>
        <p>
          {D.encChakra.totalsText[L]}{" "}
          <Link href={positionHref("chakras")}>{D.encChakra.sectionChakras[L]}</Link>{" "}
          {D.encChakra.showsWholeTable[L]}{" "}
          <Link href={positionHref("body_resource")}>{D.encChakra.sectionBody[L]}</Link>{" "}
          {D.encChakra.coversLowest[L]}
        </p>
      </div>

      {extra.columns.length ? (
        <div className="panel section-gap">
          <TocHeading id="columns">{D.encChakra.threeColumns[L]}</TocHeading>
          <div className="cap">{D.encChakra.threeColumnsHint[L]}</div>
          <dl className="kv">
            {extra.columns.map((col) => (
              <div key={col.title} style={{ display: "contents" }}>
                <dt>{col.title}</dt>
                <dd>{col.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div id="reading"><Sections items={extra.sections} locale={L} idPrefix="r" /></div>

      {extra.examples.length ? (
        <section className="prose section-gap" id="examples">
          <TocHeading id="examples-title">{D.encChakra.examples[L]}</TocHeading>
          {extra.examples.map((example) => (
            <section key={example.birth}>
              <h3>{example.numbers.join(" / ")}</h3>
              <p className="dim">{D.encChakra.exampleDate[L](example.birth.split("-").reverse().join("."))}</p>
              {example.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
            </section>
          ))}
        </section>
      ) : null}

      {extra.readings.length ? (
        <section className="section-gap" id="numbers">
          <TocHeading id="numbers-title">{D.encChakra.numbers[L]}</TocHeading>
          <p className="prose">{D.encChakra.numbersHint[L]}</p>
          <nav className="taglist" aria-label={D.encChakra.numbers[L]}>
            {extra.readings.map((row) => (
              <Link key={row.n} href={`#arcanum-${row.n}`}>{row.n} · {ARCANA.find((a) => a.n === row.n)!.title}</Link>
            ))}
          </nav>
          {extra.readings.map((row) => (
            <section className="panel section-gap" id={`arcanum-${row.n}`} key={row.n}>
              <h3>{row.n} · {ARCANA.find((a) => a.n === row.n)!.title}</h3>
              <dl className="kv">
                {extra.columns.map((col) => {
                  const text = row[col.key as "physics" | "energy" | "emotions"];
                  return text ? (
                    <div key={col.key} style={{ display: "contents" }}>
                      <dt>{col.title}</dt><dd>{text}</dd>
                    </div>
                  ) : null;
                })}
              </dl>
            </section>
          ))}
        </section>
      ) : null}

      {extra.faq.length ? <div id="questions"><Faq locale={L} items={extra.faq} /></div> : null}

      <div className="section-gap">
        <CalcPromo locale={L}
          title={D.encChakra.promoTitle[L]}
          lead={D.encChakra.promoLead[L](c.title)}
          place="chakra"
        />
      </div>

      <div className="panel section-gap">
        <h3>{D.encChakra.otherLevels[L]}</h3>
        <div className="cap">{D.encChakra.otherLevelsHint[L]}</div>
        <div className="taglist">
          {CHAKRA_PAGES.filter((o) => o.key !== c.key).map((o) => (
            <Link key={o.key} href={chakraHref(o.key)}>
              {o.index}. {o.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="panel section-gap">
        <h3>{D.encChakra.whichArcanum[L]}</h3>
        <div className="cap">{D.encChakra.whichArcanumHint[L]}</div>
        <div className="taglist">
          {ARCANA.map((a) => (
            <Link key={a.n} href={arcanumHref(a.n)}>
              {a.n} · {a.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="allbox">
        <h3>{D.encChakra.buildEnergyMap[L]}</h3>
        <p>
          {D.encChakra.buildEnergyMapText[L]}{" "}
          {ALL_FREE ? (
            <>{D.encChakra.fullMapOpen[L]}</>
          ) : (
            <>{D.encChakra.fullMapPaid[L]} <Price locale={L} />.</>
          )}
        </p>
        <Link className="btn" href="/#calc">
          {D.matrixPages.calcMatrix[L]}
        </Link>
      </div>
    </>
  );
}

async function ChakraArticlePage({ locale: L, chakraKey }: { locale: Locale; chakraKey: string }) {
  const site = await requestSite();
  const { ARCANA, CHAKRA_PAGES, arcanumHref, chakraByKey, chakraHref, chakraContent, mapPointsBySymbol, articleLd, encyclopediaSectionCrumb } = forLocale(L, site);
  const { calculate, toIso } = localizedMatrix(L);
  const c = chakraByKey(chakraKey)!;
  const article = chakraContent(chakraKey)!.article!;
  // Match MatrixForm's initial date; its preview then follows the saved date and edits.
  const seed = exampleDay();
  const example = calculate(toIso({ ...seed, year: seed.year - 30 }), "f");
  const spots = mapPointsBySymbol([c.physics, c.energy]);
  // One calculator under the chart and one closing call to action after the article.
  const cta = (
    <div className="allbox">
      <h3>{D.encChakra.buildEnergyMap[L]}</h3>
      <p>
        {D.encChakra.buildEnergyMapText[L]}{" "}
        {ALL_FREE ? <>{D.encChakra.fullMapOpen[L]}</> : <>{D.encChakra.fullMapPaid[L]} <Price locale={L} />.</>}
      </p>
      <Link className="btn" href="/#calc">{D.matrixPages.calcMatrix[L]}</Link>
    </div>
  );
  const intro = article.intro.filter((p) => typeof p === "string" || !("slot" in p));
  const combinations = article.sections.flatMap((s) => s.paragraphs).flatMap((p) =>
    typeof p !== "string" && "chakra_reading" in p ? [p.chakra_reading] : []);

  return (
    <>
      <CrumbsLd locale={L}
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb("chk"),
          { name: c.title },
        ]}
      />
      <JsonLd data={articleLd({ headline: article.seo.title, description: article.seo.description, path: chakraHref(c.key) })} />

      <h1>{article.title}</h1>
      <PositionMap locale={L}
        highlight={spots}
        caption={D.encChakra.caption[L](
          spots.map((x) => `${x.label} · ${x.symbol}`).join(` ${D.encArcanum.and[L]} `),
        )}
      />
      <p className="dim prose">{article.short}</p>

      {combinations.length ? (
        <nav className="panel section-gap" aria-labelledby="combination-picker-title">
          <h2 id="combination-picker-title">{D.encChakra.chooseCombination[L]}</h2>
          <div className="taglist">
            {combinations.map((item) => (
              <Link key={item.id} href={`#${item.id}`}>{item.row.cells.map((cell) => cell.arcanum).join(" / ")}</Link>
            ))}
          </div>
        </nav>
      ) : null}

      {intro.length ? (
        <div className="section-gap"><Paragraphs items={intro} locale={L} /></div>
      ) : null}

      <ChakraAtlasExample site={site} locale={L} m={example}
        promoTitle={D.encChakra.promoTitle[L]} promoLead={D.encChakra.promoLead[L](c.title)} />

      <Sections items={article.sections} locale={L} />

      {article.faq.length ? <div id="questions"><Faq locale={L} items={article.faq} /></div> : null}

      <div className="panel section-gap">
        <h3>{D.encChakra.otherLevels[L]}</h3>
        <div className="cap">{D.encChakra.otherLevelsHint[L]}</div>
        <div className="taglist">
          {CHAKRA_PAGES.filter((o) => o.key !== c.key).map((o) => (
            <Link key={o.key} href={chakraHref(o.key)}>
              {o.index}. {o.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="panel section-gap">
        <h3>{D.encChakra.whichArcanum[L]}</h3>
        <div className="cap">{D.encChakra.whichArcanumHint[L]}</div>
        <div className="taglist">
          {ARCANA.map((a) => (
            <Link key={a.n} href={arcanumHref(a.n)}>
              {a.n} · {a.title}
            </Link>
          ))}
        </div>
      </div>
      {cta}
    </>
  );
}
