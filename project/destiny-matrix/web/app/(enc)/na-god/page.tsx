import type { Metadata } from "next";
import Link from "next/link";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import { arcanumTitle } from "@/lib/arcana";
import { categoryHub, yearArcanum, yearKeys } from "@/lib/content";
import { YEAR_HUB, arcanumHref, yearHref } from "@/lib/encyclopedia";
import { articleLd, itemListLd } from "@/lib/schema";
import { clip } from "@/lib/text";
import { pageMeta } from "@/lib/site";

const KEY = "na-god";

const FALLBACK = {
  title: "Матрица судьбы на год",
  short:
    "Персональный год — это отдельный аркан, который считается от даты рождения и текущей даты. " +
    "Он не отменяет карту рождения, а показывает, какая её часть выходит на первый план в этом году.",
  description:
    "Что такое матрица судьбы на год: как считается аркан персонального года, чем он отличается от " +
    "карты рождения и как читать значение каждого из 22 арканов в рамке года.",
};

export const metadata: Metadata = pageMeta({
  title: categoryHub(KEY)?.seo.title ?? `${FALLBACK.title} — как считается аркан года`,
  description: categoryHub(KEY)?.seo.description ?? FALLBACK.description,
  path: YEAR_HUB,
  article: true,
});

export default function YearHubPage() {
  const hub = categoryHub(KEY);
  const keys = yearKeys();
  const arcana = keys
    .map((key) => ({ key, n: /^\d{1,2}$/.test(key) ? Number(key) : null }))
    .filter((x) => x.n !== null && x.n >= 1 && x.n <= 22)
    .sort((a, b) => (a.n as number) - (b.n as number));
  const stamps = keys.filter((key) => /^\d{4}$/.test(key));

  return (
    <>
        <JsonLd
          data={articleLd({
            headline: hub?.seo.title ?? FALLBACK.title,
            description: hub?.seo.description ?? FALLBACK.description,
            path: YEAR_HUB,
          })}
        />
        {arcana.length ? (
          <JsonLd
            data={itemListLd({
              name: "Арканы на год",
              items: arcana.map((a) => ({
                name: `${a.key} на год`,
                path: yearHref(a.key),
              })),
            })}
          />
        ) : null}

        <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия", path: "/encyclopedia" },
          { name: "Статьи", path: "/encyclopedia?sec=art" },
          { name: "Матрица судьбы на год" },
        ]}
      />

        <h1>{hub?.title ?? FALLBACK.title}</h1>
        <p className="dim prose">{hub?.short ?? FALLBACK.short}</p>

        {hub ? (
          <Sections items={hub.sections} />
        ) : (
          <div className="prose section-gap">
            <h2>Как считается аркан года</h2>
            <p>
              К числу и месяцу рождения прибавляют текущий год, сумму сворачивают до диапазона от 1 до
              22 — получается аркан, который держит рамку этого года. Каждый год число другое, и в
              этом смысл: карта рождения не меняется, а годовая рамка меняется всегда.
            </p>
            <p>
              Читают его вместе с картой: аркан года подсвечивает ту позицию рождения, которая с ним
              совпала. Поэтому один и тот же год у двух людей проходит по-разному.
            </p>
          </div>
        )}

        <div className="section-gap">
          <CalcPromo
            title="Построить свою карту"
            // Персональный год движок не считает вовсе: обещать его расчёт нельзя, пока такого
            // раздела нет ни в бесплатной части, ни в платной.
            lead="Карта рождения строится по дате бесплатно и без регистрации — с неё и читают годовую рамку."
            place="na-god-hub"
          />
        </div>

        {arcana.length ? (
          <div className="panel section-gap">
            <h2>22 аркана в рамке года</h2>
            <div className="cap">Что означает каждое число, когда оно выпало на год</div>
            <div className="cardgrid">
              {arcana.map((a) => (
                <Link className="ecard" key={a.key} href={yearHref(a.key)} prefetch={false}>
                  <div className="num">{a.key} на год</div>
                  <div className="nm">{arcanumTitle(a.n as number)}</div>
                  <div className="ds">{clip(yearArcanum(a.key)?.short ?? "", 120)}</div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {stamps.length ? (
          <div className="panel section-gap">
            <h3>Прогноз по годам</h3>
            <div className="cap">Разбор конкретного года целиком</div>
            <div className="taglist">
              {stamps.map((key) => (
                <Link key={key} href={yearHref(key)} prefetch={false}>
                  Матрица судьбы на {key}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {hub ? <Faq items={hub.faq} /> : null}

        {hub ? <Related path={YEAR_HUB} refs={hub.related} /> : null}

        <div className="panel section-gap">
          <h3>Арканы вне рамки года</h3>
          <div className="cap">Базовое значение каждого числа в карте рождения</div>
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
            Годовая рамка читается по карте рождения — начните с расчёта по дате. Он бесплатный;
            полный разбор всех 20 разделов карты — <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу бесплатно
          </Link>
        </div>
    </>
  );
}
