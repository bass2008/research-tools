import type { Metadata } from "next";
import Link from "next/link";

import { hubCrumb, hubHref } from "@/lib/encyclopedia";
import { hub, hubKeys } from "@/lib/content";
import { articleLd } from "@/lib/schema";
import { NOT_FOUND_META } from "@/lib/seo";
import { pageMeta } from "@/lib/site";
import { encyclopediaSectionCrumb } from "@/lib/encyclopediaNavigation";

import CalcPromo from "@/components/matrix/CalcPromo";
import CrumbsLd from "@/components/ui/CrumbsLd";
import Faq from "@/components/ui/Faq";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Related from "@/components/enc/Related";
import Sections from "@/components/enc/Sections";

import type { ArticleContent } from "@/lib/content";

// Концепт-хаб — посадочная под именованное понятие («программы», «кармическая матрица»,
// «энергии»). Разметка у всех одна, различается только текст, поэтому роут остаётся
// трёхстрочным, а вёрстка живёт здесь.
/** Метаданные статьи-хаба: у пяти страниц они собираются из одной записи `hubs.json`. */
export function hubMeta(key: string): Metadata {
  const item = hub(key);
  if (!item) return NOT_FOUND_META;
  return pageMeta({
    title: item.seo.title,
    description: item.seo.description,
    path: hubHref(key),
    article: true,
  });
}

export default function HubArticle({ item }: { item: ArticleContent }) {
  const path = hubHref(item.key);

  return (
    <>
      <JsonLd
        data={articleLd({
          headline: item.seo.title,
          description: item.seo.description,
          path,
          keywords: item.seo.queries,
        })}
      />

      <CrumbsLd
      trail={[
        { name: "Главная", path: "/" },
        { name: "Энциклопедия", path: "/encyclopedia" },
        encyclopediaSectionCrumb("art"),
        { name: hubCrumb(item.key) },
      ]}
      />

      <h1>{item.title}</h1>
      <p className="dim prose">{item.short}</p>

      <Sections items={item.sections} />

      <div className="section-gap">
        <CalcPromo
          title="Посмотреть это в своей карте"
          lead="Расчёт по дате рождения бесплатный и идёт в браузере, без регистрации."
          place={`hub-${item.key}`}
        />
      </div>

      <Faq items={item.faq} />

      <Related path={path} refs={item.related} />

      <div className="panel section-gap">
        <h3>Куда дальше</h3>
        <div className="cap">Справочник и полный разбор</div>
        <div className="taglist">
          <Link href="/encyclopedia">Энциклопедия матрицы судьбы</Link>
          <Link href="/encyclopedia/karmic-tail">Кармический хвост</Link>
          <Link href="/na-god">Матрица судьбы на год</Link>
          {hubKeys()
            .filter((key) => key !== item.key)
            .map((key) => (
              <Link key={key} href={hubHref(key)}>
                {hub(key)!.title}
              </Link>
            ))}
        </div>
      </div>

      <div className="allbox">
        <h3>Построить свою карту</h3>
        <p>
          Расчёт бесплатный и идёт в браузере: дата рождения не уходит на сервер. Полный разбор всех
          20 разделов — <Price />.
        </p>
        <Link className="btn" href="/#calc">
          Рассчитать матрицу бесплатно
        </Link>
      </div>
    </>
  );
}
