import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CalcPromo from "@/components/matrix/CalcPromo";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price, { PriceOrFree } from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import PositionMap from "@/components/enc/PositionMap";
import Sections from "@/components/enc/Sections";

import { D, L } from "@/lib/i18n";
import { ALL_FREE } from "@/lib/access";
import { ARCANA } from "@/lib/arcana";
import { POSITIONS, arcanumHref, positionByKey, positionHref } from "@/lib/encyclopedia";
import { arcanumInPosition, positionArcanumRows, positionContent } from "@/lib/content";
import { positionArcanumHref, positionArcanumLabel } from "@/lib/positionArcanum";
import { calculate } from "@/lib/matrix";
import { mapPointsFor, mapPointsForSection } from "@/lib/matrixMap";
import { pageMeta } from "@/lib/site";
import { articleLd } from "@/lib/schema";
import { sectionByKey } from "@/lib/sections";
import { FREE_POSITION_KEYS } from "@/lib/publicSpec";
import { NOT_FOUND_META } from "@/lib/seo";
import { encyclopediaSectionCrumb, encyclopediaSectionHref } from "@/lib/encyclopediaNavigation";
import { PERSONAL_SECTION_KEYS, type PersonalSectionKey } from "@/lib/sectionReadingShared";
import { sectionExampleNote, sectionReadingHref, sectionReadingSlug } from "@/lib/sectionReadings";

type Params = { key: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return POSITIONS.map((p) => ({ key: p.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = positionByKey((await params).key);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!p) return NOT_FOUND_META;
  const extra = positionContent(p.key);
  if (!extra) throw new Error(`нет канонического материала позиции ${p.key}`);
  return pageMeta({
    title: extra.seo.title,
    description: extra.seo.description,
    path: positionHref(p.key),
    article: true,
  });
}

export default async function PositionPage({ params }: { params: Promise<Params> }) {
  const p = positionByKey((await params).key);
  if (!p) notFound();

  const extra = positionContent(p.key);
  if (!extra) throw new Error(`нет канонического материала позиции ${p.key}`);
  const lead = extra.lead;
  const paragraphs = extra.meaning;
  const section = p.kind === "section" ? sectionByKey(p.key) : undefined;
  // Точка отмечает себя, раздел — все свои точки: «линия любви в матрице где» просит показать
  // линию целиком, а не одно звено.
  const spots = p.kind === "section"
    ? mapPointsForSection(p.key, extra.points.map((x) => x.key))
    : mapPointsFor([p.key]);
  const crossings = positionArcanumRows()
    .filter((item) => item.position === p.key)
    .sort((a, b) => a.arcanum - b.arcanum);
  const siblings = POSITIONS.filter((x) => x.kind === p.kind && x.key !== p.key).slice(0, 8);
  // Точки бесплатных разделов уже показывает бесплатный расчёт: шесть страниц обещали за них
  // деньги. Список — тот же, по которому собирается публичный разбор.
  const isFree = section?.access === "free" || FREE_POSITION_KEYS.includes(p.key);
  const exampleMatrix = calculate("1993-03-31", "f");
  const personalKey = (PERSONAL_SECTION_KEYS as readonly string[]).includes(p.key)
    ? p.key as PersonalSectionKey
    : null;
  const exampleHref = p.key === "past_lives"
      ? `/encyclopedia/karmic-tail/${exampleMatrix.karmic_tail.join("-")}`
      : personalKey
        ? sectionReadingHref(personalKey, exampleMatrix)
        : null;
  const exampleCode = personalKey
    ? sectionReadingSlug(personalKey, exampleMatrix)
    : p.key === "past_lives"
      ? exampleMatrix.karmic_tail.join("-")
      : null;
  // Один и тот же абзац «те же правила к одному достижимому результату» стоял на 17 страницах.
  // Роли и арканы примера у каждого раздела свои, поэтому подпись собирается из них.
  const exampleText = personalKey
    ? sectionExampleNote(personalKey, exampleMatrix)
    : D.encPosition.personalExampleLead[L](exampleCode ?? "");

  return (
    <>

      <CrumbsLd
        trail={[
          { name: D.nav.home[L], path: "/" },
          { name: D.nav.encyclopedia[L], path: "/encyclopedia" },
          encyclopediaSectionCrumb(p.kind === "section" ? "sec" : "pts"),
          { name: p.title },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: extra.seo.title,
            description: extra.seo.description,
            path: positionHref(p.key),
          })}
        />

        <h1>{p.title}</h1>
        <p className="dim prose">{lead}</p>

        <PositionMap
          highlight={spots}
          caption={spots.length === 1
            ? D.encPosition.whereOnePoint[L](`${spots[0]!.label} · ${spots[0]!.symbol}`)
            : D.encPosition.whereSeveralPoints[L](
                spots.map((x) => `${x.label} · ${x.symbol}`).join(", "),
              )}
        />

        <div className="panel section-gap">
          <h2>{D.encPosition.howCounted[L]}</h2>
          <div className="cap">{D.encPosition.howCountedHint[L]}</div>
          <p style={{ margin: 0 }}>{extra.formula}</p>
          {section ? (
            <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
              {D.encPosition.sectionInReport[L]}{" "}
              {isFree || ALL_FREE ? (
                D.encPosition.openFree[L]
              ) : (
                <>
                  {D.encPosition.opensInFull[L]} <Price />.
                </>
              )}{" "}
              <Link href="/report">{D.encPosition.seeYourReport[L]}</Link>
            </p>
          ) : null}
        </div>

        <div className="prose section-gap">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>

        <Sections items={extra.sections} />

        {p.key === "day" ? (
          <p className="encref">
            <Link href={positionHref("character")}>
              {D.encPosition.moreAboutCharacter[L]}
            </Link>
          </p>
        ) : null}

        {p.key === "character" ? (
          <div className="panel section-gap">
            <h2>{D.encPosition.personalExampleTitle[L]}</h2>
            <div className="cap">{D.encPosition.characterExampleHint[L]}</div>
            <p>{D.encPosition.characterExampleText[L]}</p>
            <p className="encref">
              <Link href="/encyclopedia/character/4-3-22">
                {D.encPosition.characterExampleLink[L]}
              </Link>
            </p>
          </div>
        ) : null}

        {p.key === "comfort" ? (
          <div className="panel section-gap">
            <h2>{D.encPosition.personalExampleTitle[L]}</h2>
            <div className="cap">{D.encPosition.comfortExampleHint[L]}</div>
            <p>{D.encPosition.comfortExampleText[L]}</p>
            <p className="encref">
              <Link href="/encyclopedia/comfort/4-15-7">
                {D.encPosition.comfortExampleLink[L]}
              </Link>
            </p>
          </div>
        ) : null}

        {p.key === "profession" ? (
          <div className="panel section-gap">
            <h2>{D.encPosition.personalExampleTitle[L]}</h2>
            <div className="cap">{D.encPosition.professionExampleHint[L]}</div>
            <p>{D.encPosition.professionExampleText[L]}</p>
            <p className="encref">
              <Link href="/encyclopedia/profession/3-10-7">
                {D.encPosition.professionExampleLink[L]}
              </Link>
            </p>
          </div>
        ) : null}

        {exampleHref && exampleCode && !["character", "comfort", "profession"].includes(p.key) ? (
          <div className="panel section-gap">
            <h2>{D.encPosition.personalExampleTitle[L]}</h2>
            <div className="cap">
              {p.key === "chakras"
                ? D.encPosition.chakraExampleHint[L]
                : p.key === "years"
                  ? D.encPosition.yearsExampleHint[L]
                  : D.encPosition.calculatedResult[L](exampleCode)}
            </div>
            <p>{exampleText}</p>
            <p className="encref">
              <Link href={exampleHref}>
                {D.encPosition.personalExampleLink[L]}
              </Link>
            </p>
          </div>
        ) : null}

        {extra.reading ? (
          <div className="panel">
            <h3>{D.encPosition.howToRead[L]}</h3>
            <div className="cap">{D.encPosition.howToReadHint[L]}</div>
            <p style={{ margin: 0 }}>{extra.reading}</p>
          </div>
        ) : null}

        <div className="section-gap">
          <CalcPromo
            title={D.enc.buildYourChart[L]}
            // Бесплатны только два раздела разбора («характер» и «зона комфорта»): обещать
            // бесплатный результат на остальных восемнадцати нельзя.
            lead={
              isFree || ALL_FREE
                ? D.encPosition.promoFreeLead[L](p.title)
                : D.encPosition.promoPaidLead[L](p.title)
            }
            place="position"
          />
        </div>

        {/* Пересечения этой позиции: спрашивают именно их — «8 аркан профессии», «6 в центре
            матрицы». Без этих ссылок 80 страниц реестра оставались бы сиротами: в карте сайта
            есть, а входящих ссылок нет ни одной. */}
        {crossings.length ? (
          <div className="panel section-gap">
            <h2>{D.encPosition.crossingsTitle[L]}</h2>
            <div className="cap">{D.encPosition.crossingsHint[L](crossings.length)}</div>
            <div className="taglist">
              {crossings.map((item) => (
                <Link
                  key={item.arcanum}
                  href={positionArcanumHref(item.position, item.arcanum)}
                  prefetch={false}
                >
                  {positionArcanumLabel(item)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <Faq items={extra.faq} />

        {/* У «Карты энергий» связанные материалы — не точки матрицы, а семь статей уровней.
            Поле `links` было заполнено, но на странице не выводилось: дочерние статьи получали
            входящие ссылки только с корня энциклопедии и с noindex-карты. */}
        {p.kind === "section" && extra.links?.length ? (
          <div className="panel section-gap">
            <h2>{D.encPosition.levelsTitle[L]}</h2>
            <div className="cap">{D.encPosition.levelsHint[L]}</div>
            <div className="taglist">
              {extra.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {p.kind === "section" ? (
          extra.points.length ? (
            <div className="panel section-gap">
              <h2>{D.encPosition.sectionPositions[L]}</h2>
              <div className="cap">{D.encPosition.sectionPositionsHint[L]}</div>
              <div className="taglist">
                {extra.points.map((point) => (
                  <Link key={point.key} href={positionHref(point.key)}>
                    {point.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null
        ) : (
          <div className="panel section-gap">
            <h2>{D.encPosition.allArcanaHere[L]}</h2>
            <div className="cap">{D.encPosition.allArcanaHereHint[L]}</div>
            <div className="cardgrid">
              {ARCANA.map((a) => (
                <Link className="ecard" key={a.n} href={arcanumHref(a.n)}>
                  <div className="num">{D.encPosition.arcanumNumber[L](a.n)}</div>
                  <div className="nm">{a.title}</div>
                  <div className="ds">{arcanumInPosition(a.n, p.key)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Related
          path={positionHref(p.key)}
          refs={[]}
          title={D.encPosition.relatedTitle[L]}
          hint={D.encPosition.relatedHint[L]}
        />

        <div className="panel section-gap">
          <h2>{D.encPosition.nearby[L]}</h2>
          <div className="cap">
            {p.kind === "section" ? D.encPosition.otherSections[L] : D.encPosition.otherPositions[L]}
          </div>
          <div className="taglist">
            {siblings.map((s) => (
              <Link key={s.key} href={positionHref(s.key)}>
                {s.title}
              </Link>
            ))}
            <Link href={encyclopediaSectionHref(p.kind === "section" ? "sec" : "pts")}>
              {p.kind === "section" ? D.encPosition.allSections[L] : D.encPosition.allPositions[L]}
            </Link>
          </div>
        </div>

        <div className="allbox">
          <h2>{D.encPosition.seeInYourChart[L]}</h2>
          <p>{D.encPosition.seeInYourChartText[L]}</p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcMatrix[L]}
          </Link>
        </div>
    </>
  );
}
