import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard from "@/components/matrix/ArcanumCard";
import CalcPromo from "@/components/matrix/CalcPromo";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import { positionHref } from "@/lib/publicSpec";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { arcanumTitle } from "@/lib/arcana";
import { karmicTail, karmicTailKeys } from "@/lib/content";
import {
  KARMIC_TAIL_HUB,
  arcanumHref,
  karmicTailHref,
  parseTail,
  tailByFormula,
} from "@/lib/encyclopedia";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

type Params = { triple: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  // Корпус обязан быть полным: build-content.py проверяет точное равенство реестру метода.
  return karmicTailKeys().map((triple) => ({ triple }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const triple = (await params).triple;
  const item = karmicTail(triple);
  if (!item) return NOT_FOUND_META;
  return pageMeta({
    title: item.seo.title,
    description: item.seo.description,
    path: karmicTailHref(item.key),
    article: true,
    noindex: !item.publication.index,
    follow: item.publication.follow,
  });
}

export default async function KarmicTailPage({ params }: { params: Promise<Params> }) {
  const triple = (await params).triple;
  const item = karmicTail(triple);
  if (!item) notFound();

  const formula = tailByFormula(parseTail(item.key) ?? []);
  const displayArcana = formula?.triple ?? parseTail(item.key) ?? item.arcana;

  return (
    <>

      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          // цепочка обязана совпадать с видимой крошкой: разное имя и разный адрес в разметке
          // означали бы, что поисковику показывают не тот путь, что человеку
          encyclopediaSectionCrumb("tls"),
          { name: item.key },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: item.seo.title,
            description: item.seo.description,
            path: karmicTailHref(item.key),
            keywords: item.seo.queries,
          })}
        />

        <h1>{item.title}</h1>
        <p className="dim prose">{item.short}</p>

        <div className="tail-deck section-gap">
          {displayArcana.map((n, i) => (
            <Link className="ecard tail-card" key={`${n}-${i}`} href={arcanumHref(n)}>
              <ArcanumCard n={n} size="big" eager={i === 0} decorative />
              <div className="tail-card-label">
                <div className="num">{n} аркан</div>
                <div className="nm">{arcanumTitle(n)}</div>
              </div>
            </Link>
          ))}
        </div>

        <Sections items={item.sections} />

        <div className="panel section-gap">
          <h2>Как считается хвост</h2>
          <div className="cap">Формула методики</div>
          {formula ? (
            <p style={{ margin: 0 }}>
              В классической схеме порядок фиксирован: M–N–D. Для этой формы это{" "}
              <strong>{formula.triple.join("–")}</strong>: M — нижняя внутренняя точка,
              N — свёртка D+M, D — корневая кармическая задача. Пример даты, которая даёт
              этот хвост: {formula.sampleBirth.split("-").reverse().join(".")}.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Эта поисковая тройка не входит в 26 хвостов, достижимых по формуле M–N–D нашего
              калькулятора. Она может относиться к программе в другой позиции или к другой школе;
              обещать её появление в хвосте вашей карты было бы неверно.
            </p>
          )}
        </div>

        <div className="section-gap">
          <CalcPromo
            title="Построить свою карту"
            // Тройка с подписью и толкованием живёт в разделе «Задачи прошлых воплощений», а он
            // платный: обещать её в бесплатном расчёте — прямая неправда.
            lead="Карта по дате рождения строится бесплатно и без регистрации. Свою тройку с толкованием открывает полный разбор."
            place="karmic-tail"
          />
        </div>

        <Faq items={item.faq} />

        <Related
          path={karmicTailHref(item.key)}
          refs={item.related}
          hint="Тройки и страницы, связанные с этим хвостом"
        />

        <div className="panel section-gap">
          <h3>Куда дальше</h3>
          <div className="cap">Арканы тройки и остальные хвосты</div>
          <div className="taglist">
            {[...new Set(displayArcana)].map((n) => (
              <Link key={n} href={arcanumHref(n)}>
                {n} · {arcanumTitle(n)}
              </Link>
            ))}
            <Link href={KARMIC_TAIL_HUB}>Все кармические хвосты</Link>
            {/* Перелинковка трёх разведённых интентов была односторонней: хаб и статья раздела
                вели сюда, а обратно на разбор метода — нет. */}
            <Link href={positionHref("past_lives")}>Как читается раздел «Задачи прошлых воплощений»</Link>
          </div>
        </div>

        <div className="allbox">
          {/* обещать «найдите эту тройку у себя» можно только там, где движок её вообще
              выдаёт: у половины страниц набор формулой не складывается */}
          <h3>{formula ? "Найти свой хвост в своей карте" : "Построить свою карту"}</h3>
          <p>
            {formula
              ? "Октаграмма по дате рождения строится бесплатно и в браузере."
              : "Октаграмма по дате рождения строится бесплатно и в браузере, но тройка в ней " +
                "сложится по формуле матрицы и с этой совпасть не обязана."}{" "}
            Тройка хвоста с разбором входит в раздел «Задачи прошлых воплощений» полного разбора —{" "}
            <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу бесплатно
          </Link>
        </div>
    </>
  );
}
