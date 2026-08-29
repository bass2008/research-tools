import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";

import { ARCANA } from "@/lib/arcana";
import { CHAKRA_PAGES, arcanumHref, chakraByKey, chakraHref, positionHref } from "@/lib/encyclopedia";
import { chakraContent } from "@/lib/content";
import { pageMeta } from "@/lib/site";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";

type Params = { key: string };

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return CHAKRA_PAGES.map((c) => ({ key: c.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const c = chakraByKey((await params).key);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!c) return NOT_FOUND_META;
  const extra = chakraContent(c.key);
  return pageMeta({
    title: extra?.seo?.title ?? `${c.title} — чакра ${c.index} в матрице судьбы`,
    description:
      extra?.seo?.description ??
      `${c.title}: ${c.hint}. Как уровень читается в трёх колонках карты энергий — физика, энергия и эмоции.`,
    path: chakraHref(c.key),
    article: true,
  });
}

export default async function ChakraPage({ params }: { params: Promise<Params> }) {
  const c = chakraByKey((await params).key);
  if (!c) notFound();
  const extra = chakraContent(c.key);
  const paragraphs = extra?.level ?? c.paragraphs;
  const title = extra?.seo?.title ?? `${c.title} — чакра ${c.index} в матрице судьбы`;

  return (
    <>

      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          { name: "Семь чакр", path: "/encyclopedia?sec=chk" },
          { name: c.title },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: title,
            description: extra?.seo?.description ?? c.hint,
            path: chakraHref(c.key),
          })}
        />

        <h1>
          {c.title} — уровень {c.index}
        </h1>
        <p className="dim prose">{c.hint}</p>

        <div className="prose section-gap">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          <h2>Как считается уровень</h2>
          <p>
            В карте энергий каждый уровень раскладывается на три числа. Физика считается от аркана дня и
            родовой опоры, энергия — от месяца и миссии, эмоции — сумма первых двух. Строки разводит
            смещение, и считается оно сверху вниз: к верхнему уровню прибавляется единица, к нижнему —
            семь, то есть «восемь минус номер уровня». Без этого все семь строк были бы одинаковыми.
          </p>
          <p>
            Итог колонки — тоже аркан: он собирает семь уровней в одно число.{" "}
            <Link href={positionHref("chakras")}>Раздел «Карта энергий по чакрам»</Link> показывает всю
            таблицу целиком, а <Link href={positionHref("body_resource")}>«Ресурс тела и восстановление»</Link>{" "}
            разбирает нижний уровень.
          </p>
        </div>

        {extra?.columns ? (
          <div className="panel section-gap">
            <h3>Три колонки уровня</h3>
            <div className="cap">Материя, энергия и чувства на этом уровне</div>
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

        <div className="section-gap">
          <CalcPromo
            title="Посмотреть свой уровень"
            lead={`Какой аркан стоит у вас на уровне «${c.title}» — видно сразу после расчёта. Бесплатно, без регистрации.`}
            place="chakra"
          />
        </div>

        <div className="panel section-gap">
          <h3>Остальные уровни</h3>
          <div className="cap">Шесть остальных уровней, сверху вниз</div>
          <div className="taglist">
            {CHAKRA_PAGES.filter((o) => o.key !== c.key).map((o) => (
              <Link key={o.key} href={chakraHref(o.key)}>
                {o.index}. {o.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="panel section-gap">
          <h3>Какой аркан стоит на этом уровне</h3>
          <div className="cap">22 значения — откройте своё после расчёта</div>
          <div className="taglist">
            {ARCANA.map((a) => (
              <Link key={a.n} href={arcanumHref(a.n)}>
                {a.n} · {a.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="allbox">
          <h3>Построить свою карту энергий</h3>
          <p>
            Таблица чакр считается вместе с октаграммой по дате рождения. Расчёт бесплатный и идёт в
            браузере; полная расшифровка карты энергий входит в разбор за <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу
          </Link>
        </div>
    </>
  );
}
