import type { Metadata } from "next";
import Link from "next/link";

import Crumbs from "@/components/ui/Crumbs";

import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import { matrixCount } from "@/lib/content";
import Price from "@/components/pay/Price";
import { pageMeta } from "@/lib/site";
import { DAY_KEYS, MONTHS_NOM, MONTH_KEYS, matrixHref, yearKeys } from "./matrices";

// Каталог остаётся страницей — это путь человека с главной к конкретной карте, — но из индекса
// уходит. Причины: спроса на список всех матриц нет (за шесть дней в поиске ноль показов при
// наличии в карте сайта: люди ищут свою карту, а не перечень), а всё содержимое каталога — ссылки
// на 5 544 адреса, закрытых от обхода в robots.txt, то есть для поиска это страница из тупиков.
// `follow` обязателен: по этим ссылкам ходит человек, и обрывать каталог незачем.
//
// В `Disallow` каталог не добавлен намеренно: чтобы прочитать `noindex`, робот обязан скачать
// страницу. Запрет обхода вместе с `noindex` оставил бы её в выдаче адресом без описания.
export const metadata: Metadata = pageMeta({
  title: D.matrixPages.catalogTitle[L],
  description:
    D.matrixPages.catalogDescription[L],
  path: "/matrix",
  noindex: true,
  follow: true,
});

export default function MatrixIndexPage() {
  const years = yearKeys();
  const entry = years[0];
  // Без content/matrices.json страниц матриц не существует: сетку входов рисовать нельзя,
  // иначе каталог наполняется ссылками в никуда.
  const ready = years.length > 0;

  return (
    <main id="content" className="page">
      <div className="wrap">
        <Crumbs trail={[{ name: D.nav.home[L], path: "/" }, { name: D.nav.allMatrices[L] }]} />

        <h1>{D.matrixPages.catalogH1[L]}</h1>
        <p className="dim prose">
          {D.matrixPages.catalogLead[L](
            ready ? ` (${years[0]}–${years[years.length - 1]})` : "",
            ready ? matrixCount() : 5544,
          )}{" "}
          <Link href="/#calc">{D.matrixPages.catalogCalcLink[L]}</Link>
          {D.matrixPages.catalogCalcTail[L]}
        </p>

        <div className="panel section-gap">
          <h2>{D.matrixPages.addressTitle[L]}</h2>
          <div className="cap">{D.matrixPages.addressHint[L]}</div>
          <p style={{ margin: 0 }}>
            <code>/matrix/14-6-7</code> {D.matrixPages.addressExample[L]}{" "}
            {ALL_FREE ? (
              <>{D.matrixPages.allFreeSections[L]}</>
            ) : (
              <>
                {D.matrixPages.paidTail[L]} <Price />.
              </>
            )}
          </p>
        </div>

        {ready ? (
          <>
            <h2 className="section-gap">{D.matrixPages.entryByDay[L]}</h2>
            <p className="dim">
              {D.matrixPages.entryLead[L](D.matrixPages.yearArcanaCount[L](years.length))}
            </p>
            <div className="cardgrid">
              {DAY_KEYS.map((day) => (
                <div className="ecard" key={day}>
                  <div className="num">{D.matrixPages.dayWord[L]} {day}</div>
                  <div className="nm">{D.matrixPages.dayArcanum[L](day)}</div>
                  <div className="taglist" style={{ marginTop: 8 }}>
                    {MONTH_KEYS.map((month) => (
                      // 264 ссылки сетки: с префетчем каждый просмотр каталога тянул RSC-пейлоад
                      // каждой страницы матрицы — мегабайты на список ссылок
                      <Link key={month} href={matrixHref(`${day}-${month}-${entry}`)} prefetch={false}>
                        {MONTHS_NOM[month - 1]}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="panel section-gap">
            <h2>{D.matrixPages.catalogMissing[L]}</h2>
            <div className="cap">{D.matrixPages.catalogMissingHint[L]}</div>
            <p style={{ margin: 0 }}>
              {D.matrixPages.catalogMissingText[L]}
            </p>
          </div>
        )}

        <div className="panel section-gap">
          <h2>{D.matrixPages.whereNext[L]}</h2>
          <div className="cap">{D.matrixPages.whereNextHint[L]}</div>
          <div className="taglist">
            <Link href="/encyclopedia">{D.matrixPages.encyclopediaFull[L]}</Link>
            <Link href="/encyclopedia/position/character">{D.matrixPages.linkCharacter[L]}</Link>
            <Link href="/encyclopedia/position/money">{D.matrixPages.linkMoney[L]}</Link>
            <Link href="/encyclopedia/position/relations">{D.matrixPages.linkRelations[L]}</Link>
            <Link href="/encyclopedia/position/center">{D.matrixPages.linkCenter[L]}</Link>
          </div>
        </div>

        <div className="allbox">
          <h2>{D.matrixPages.findYours[L]}</h2>
          <p>{D.matrixPages.findYoursText[L]}</p>
          <Link className="btn" href="/#calc">
            {D.matrixPages.calcFree[L]}
          </Link>
        </div>
      </div>
    </main>
  );
}
