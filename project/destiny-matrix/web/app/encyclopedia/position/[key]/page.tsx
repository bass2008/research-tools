import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CalcPromo from "@/components/matrix/CalcPromo";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { ARCANA } from "@/lib/arcana";
import { POSITIONS, arcanumHref, positionByKey, positionHref } from "@/lib/encyclopedia";
import { arcanumInPosition, positionContent } from "@/lib/content";
import { calculate } from "@/lib/matrix";
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
    : `Общая статья объясняет порядок и границы метода. Рассчитанный хвост ${exampleCode} показывает, как эти правила читаются на одном результате.`;

  return (
    <>

      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
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

        <div className="panel section-gap">
          <h2>Как считается</h2>
          <div className="cap">Формула позиции в методике</div>
          <p style={{ margin: 0 }}>{extra.formula}</p>
          {section ? (
            <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
              Раздел в отчёте{" "}
              {isFree ? (
                "открыт бесплатно, без регистрации."
              ) : (
                <>
                  открывается в полном разборе за <Price />.
                </>
              )}{" "}
              <Link href="/report">Посмотреть свой отчёт</Link>
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
              Подробнее о полном разделе «Характер и личные качества» →
            </Link>
          </p>
        ) : null}

        {p.key === "character" ? (
          <div className="panel section-gap">
            <h2>Пример полного персонального разбора</h2>
            <div className="cap">Тройка 4–3–22: три роли, три связи и общий вывод</div>
            <p>
              В статье выше показан метод. На персональной странице видно, как те же правила
              собирают отдельные значения Императора, Императрицы и Шута в один связный текст.
            </p>
            <p className="encref">
              <Link href="/encyclopedia/character/4-3-22">
                Посмотреть разбор 4–3–22 в энциклопедии →
              </Link>
            </p>
          </div>
        ) : null}

        {p.key === "comfort" ? (
          <div className="panel section-gap">
            <h2>Пример полного персонального разбора</h2>
            <div className="cap">Тройка 4–15–7: центр, реакция и возвращающий талант</div>
            <p>
              Общая статья объясняет точки E, M и K. В персональном разборе видно, как их
              отдельные значения и три связи складываются в один внутренний цикл.
            </p>
            <p className="encref">
              <Link href="/encyclopedia/comfort/4-15-7">
                Посмотреть разбор 4–15–7 в энциклопедии →
              </Link>
            </p>
          </div>
        ) : null}

        {p.key === "profession" ? (
          <div className="panel section-gap">
            <h2>Пример полного персонального разбора</h2>
            <div className="cap">Линия 3–10–7: дар, форма работы и внутренний результат</div>
            <p>
              Общая статья объясняет порядок B→P→K. Персональная страница показывает, как
              значения трёх арканов образуют связный сценарий профессиональной реализации.
            </p>
            <p className="encref">
              <Link href="/encyclopedia/profession/3-10-7">
                Посмотреть разбор 3–10–7 в энциклопедии →
              </Link>
            </p>
          </div>
        ) : null}

        {exampleHref && exampleCode && !["character", "comfort", "profession"].includes(p.key) ? (
          <div className="panel section-gap">
            <h2>Пример полного персонального разбора</h2>
            <div className="cap">
              {p.key === "chakras"
                ? "Карта энергий для контрольной матрицы 4–3–22"
                : p.key === "years"
                  ? "Возрастная линия для контрольной матрицы 4–3–22"
                  : `Рассчитанный результат ${exampleCode}`}
            </div>
            <p>{exampleText}</p>
            <p className="encref">
              <Link href={exampleHref}>
                Посмотреть персональный пример в энциклопедии →
              </Link>
            </p>
          </div>
        ) : null}

        {extra.reading ? (
          <div className="panel">
            <h3>Как читать позицию</h3>
            <div className="cap">Порядок, в котором смотрят на арканы</div>
            <p style={{ margin: 0 }}>{extra.reading}</p>
          </div>
        ) : null}

        <div className="section-gap">
          <CalcPromo
            title="Построить свою карту"
            // Бесплатны только два раздела разбора («характер» и «зона комфорта»): обещать
            // бесплатный результат на остальных восемнадцати нельзя.
            lead={
              isFree
                ? `Что стоит у вас в позиции «${p.title}» — покажет расчёт по дате рождения. Бесплатно, без регистрации.`
                : `Карта по дате рождения строится бесплатно и без регистрации. Позицию «${p.title}» открывает полный разбор.`
            }
            place="position"
          />
        </div>

        <Faq items={extra.faq} />

        {/* У «Карты энергий» связанные материалы — не точки матрицы, а семь статей уровней.
            Поле `links` было заполнено, но на странице не выводилось: дочерние статьи получали
            входящие ссылки только с корня энциклопедии и с noindex-карты. */}
        {p.kind === "section" && extra.links?.length ? (
          <div className="panel section-gap">
            <h2>Уровни карты по отдельности</h2>
            <div className="cap">Каждый уровень разобран своей статьёй</div>
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
              <h2>Позиции этого раздела</h2>
              <div className="cap">У каждой точки — своё значение аркана</div>
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
            <h2>Все 22 аркана в этой позиции</h2>
            <div className="cap">Откройте аркан, который стоит у вас в этой точке карты</div>
            <div className="cardgrid">
              {ARCANA.map((a) => (
                <Link className="ecard" key={a.n} href={arcanumHref(a.n)}>
                  <div className="num">{a.n} аркан</div>
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
          title="Где ещё разбирается эта позиция"
          hint="Статьи, которые ссылаются на эту страницу"
        />

        <div className="panel section-gap">
          <h2>Рядом в карте</h2>
          <div className="cap">{p.kind === "section" ? "Другие разделы разбора" : "Другие позиции матрицы"}</div>
          <div className="taglist">
            {siblings.map((s) => (
              <Link key={s.key} href={positionHref(s.key)}>
                {s.title}
              </Link>
            ))}
            <Link href={encyclopediaSectionHref(p.kind === "section" ? "sec" : "pts")}>
              {p.kind === "section" ? "Все разделы отчёта" : "Все позиции карты"}
            </Link>
          </div>
        </div>

        <div className="allbox">
          <h2>Посмотреть эту позицию в своей карте</h2>
          <p>
            Расчёт бесплатный и идёт в браузере: дата рождения не уходит на сервер. Карта и два
            раздела открываются сразу, полный разбор — <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу
          </Link>
        </div>
    </>
  );
}
