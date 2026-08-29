import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import ArcanumCard from "@/components/matrix/ArcanumCard";
import CalcPromo from "@/components/matrix/CalcPromo";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { arcanumTitle } from "@/lib/arcana";
import { fold } from "@/lib/matrix";
import { karmicTail, karmicTailKeys, karmicTails } from "@/lib/content";
import {
  KARMIC_TAIL_HUB,
  arcanumHref,
  karmicTailHref,
  parseTail,
  tailByFormula,
  tailShape,
} from "@/lib/encyclopedia";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";

type Params = { triple: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  // перестановки того же ключа перечислены рядом с каноническим: при dynamicParams = false
  // адрес вне списка не доходит до страницы, и постоянный редирект на канонический не сработал бы
  const out = new Set<string>();
  for (const key of karmicTailKeys()) {
    const arcana = parseTail(key) ?? [];
    for (const [i, j, k] of [[0, 1, 2], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0], [2, 1, 0]]) {
      out.add([arcana[i], arcana[j], arcana[k]].join("-"));
    }
    out.add(key);
  }
  return [...out].map((triple) => ({ triple }));
}

// Порядок чисел в ключе — тот, которым тройку набирают в поиске: «18-9-9» спрашивают чаще,
// чем отсортированное «9-9-18». Канонический адрес один — тот, что лежит в контенте; любая
// другая перестановка той же тройки уезжает на него постоянным редиректом, иначе один хвост
// оказался бы шестью адресами с одинаковым текстом.
function canonical(triple: string): string | null {
  const arcana = parseTail(triple);
  if (!arcana) return null;
  const shape = tailShape(arcana);
  return karmicTails().find((t) => tailShape(t.arcana) === shape)?.key ?? null;
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
  });
}

export default async function KarmicTailPage({ params }: { params: Promise<Params> }) {
  const triple = (await params).triple;
  const item = karmicTail(triple);
  if (!item) {
    const target = canonical(triple);
    if (target) permanentRedirect(karmicTailHref(target));
    notFound();
  }

  const formula = tailByFormula(item.arcana);
  const sorted = [...item.arcana].sort((a, b) => a - b);

  return (
    <>

      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          // цепочка обязана совпадать с видимой крошкой: разное имя и разный адрес в разметке
          // означали бы, что поисковику показывают не тот путь, что человеку
          { name: "Кармические хвосты", path: "/encyclopedia?sec=tls" },
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

        <div className="cardgrid section-gap">
          {sorted.map((n, i) => (
            <Link className="ecard withcard" key={`${n}-${i}`} href={arcanumHref(n)}>
              <ArcanumCard n={n} size="grid" eager={i === 0} decorative />
              <div>
                <div className="num">{n} аркан</div>
                <div className="nm">{arcanumTitle(n)}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="panel section-gap">
          <h2>Как считается хвост</h2>
          <div className="cap">Формула методики</div>
          {formula ? (
            <p style={{ margin: 0 }}>
              Хвост складывается из аркана года ({formula.year}) и аркана наследия рода (
              {formula.inheritance}): их сумма сворачивается до{" "}
              {fold(formula.year + formula.inheritance)}. Все три
              числа стоят в нижнем углу карты.
            </p>
          ) : (
            // Тройки вида 6-6-18 формулой не получаются: обещать, что калькулятор покажет
            // именно эту тройку, здесь нельзя — это была бы прямая неправда.
            <p style={{ margin: 0 }}>
              Эту тройку в поиске спрашивают именно в таком виде, но по формуле матрицы третье
              число — это всегда свёртка суммы первых двух. Разные школы считают хвост по-своему,
              поэтому в вашей карте набор чисел может отличаться.
            </p>
          )}
        </div>

        <Sections items={item.sections} />

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
            {[...new Set(sorted)].map((n) => (
              <Link key={n} href={arcanumHref(n)}>
                {n} · {arcanumTitle(n)}
              </Link>
            ))}
            <Link href={KARMIC_TAIL_HUB}>Все кармические хвосты</Link>
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
