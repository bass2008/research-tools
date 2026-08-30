import type { Metadata } from "next";
import Link from "next/link";

import CalcPromo from "@/components/matrix/CalcPromo";
import Faq from "@/components/ui/Faq";
import CrumbsLd from "@/components/ui/CrumbsLd";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { arcanumTitle } from "@/lib/arcana";
import { categoryHub, karmicTails } from "@/lib/content";
import { KARMIC_TAIL_HUB, arcanumHref, karmicTailHref, parseTail } from "@/lib/encyclopedia";
import { articleLd, itemListLd } from "@/lib/schema";
import { clip } from "@/lib/text";
import { pageMeta } from "@/lib/site";

const KEY = "karmic-tail";

const FALLBACK = {
  title: "Кармический хвост в матрице судьбы",
  short:
    "Кармический хвост — три числа на нижнем луче карты в порядке M–N–D: внутренняя нижняя " +
    "точка, её сумма с D и корневая кармическая задача.",
  description:
    "Что такое кармический хвост в матрице судьбы, из каких трёх арканов он складывается, как " +
    "считается по дате рождения и как читать тройку целиком, а не по отдельным числам.",
};

export const metadata: Metadata = pageMeta({
  title: categoryHub(KEY)?.seo.title ?? `${FALLBACK.title} — расшифровка тройки`,
  description: categoryHub(KEY)?.seo.description ?? FALLBACK.description,
  path: KARMIC_TAIL_HUB,
  article: true,
});

/** Тройки по числам, а не по строке: localeCompare ставил 11-11-4 после 11-11-22. */
function byTriple(a: string, b: string): number {
  const x = a.split("-").map(Number);
  const y = b.split("-").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

export default function KarmicTailHubPage() {
  const hub = categoryHub(KEY);
  const items = karmicTails().slice().sort((a, b) => byTriple(a.key, b.key));

  return (
    <>

      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          { name: "Статьи", path: "/encyclopedia?sec=art" },
          { name: "Кармический хвост" },
        ]}
      />
        <JsonLd
          data={articleLd({
            headline: hub?.seo.title ?? FALLBACK.title,
            description: hub?.seo.description ?? FALLBACK.description,
            path: KARMIC_TAIL_HUB,
          })}
        />
        {items.length ? (
          <JsonLd
            data={itemListLd({
              name: "Кармические хвосты",
              items: items.map((t) => ({ name: t.key, path: karmicTailHref(t.key) })),
            })}
          />
        ) : null}

        <h1>{hub?.title ?? FALLBACK.title}</h1>
        <p className="dim prose">{hub?.short ?? FALLBACK.short}</p>

        {hub ? (
          <Sections items={hub.sections} />
        ) : (
          <div className="prose section-gap">
            <h2>Как складывается тройка</h2>
            <p>
              Сначала считается D как сумма дня, месяца и года, затем центр E и внутренняя точка
              M=D+E. Средняя точка N равна свёртке D+M. В продукте хвост записывается M–N–D,
              и этот порядок не сортируется.
            </p>
            <p>
              Читают тройку целиком и с учётом позиции. Перестановка меняет расположение арканов,
              поэтому поисковая форма может не совпадать с порядком калькулятора. Из всех наборов
              трёх чисел по этой формуле достижимы ровно 26 упорядоченных хвостов.
            </p>
          </div>
        )}

        <div className="section-gap">
          <CalcPromo
            title="Построить свою карту"
            lead="Карта по дате рождения строится бесплатно и без регистрации. Свою тройку с толкованием открывает полный разбор."
            place="karmic-tail-hub"
          />
        </div>

        {items.length ? (
          <div className="panel section-gap">
            <h2>Разобранные тройки</h2>
            <div className="cap">
              {items.length === 1 ? "Пока одна тройка" : `${items.length} троек с разбором`}
            </div>
            <div className="cardgrid">
              {items.map((t) => (
                <Link className="ecard" key={t.key} href={karmicTailHref(t.key)} prefetch={false}>
                  <div className="num">{t.key}</div>
                  {/* имена берём из ключа: в данных arcana лежит отсортированным, и подпись
                      расходилась с номерами — «10-15-5» против «Иерофант · Колесо · Дьявол» */}
                  <div className="nm">
                    {(parseTail(t.key) ?? t.arcana).map((n) => arcanumTitle(n)).join(" · ")}
                  </div>
                  <div className="ds">{clip(t.short, 120)}</div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {hub ? <Faq items={hub.faq} /> : null}

        {hub ? <Related path={KARMIC_TAIL_HUB} refs={hub.related} /> : null}

        <div className="panel section-gap">
          <h3>Арканы тройки</h3>
          <div className="cap">22 значения, из которых складывается любой хвост</div>
          <div className="taglist">
            {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={arcanumHref(n)}>
                {n} · {arcanumTitle(n)}
              </Link>
            ))}
          </div>
        </div>

        <div className="allbox">
          <h3>Построить свою карту</h3>
          <p>
            Хвост — одна из позиций октаграммы. Сама карта по дате рождения строится бесплатно, а
            тройка с разбором входит в раздел «Задачи прошлых воплощений» — <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу бесплатно
          </Link>
        </div>
    </>
  );
}
