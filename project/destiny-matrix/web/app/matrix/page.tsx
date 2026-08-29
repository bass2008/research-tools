import type { Metadata } from "next";
import Link from "next/link";

import Crumbs from "@/components/ui/Crumbs";

import { matrixCount } from "@/lib/content";
import Price from "@/components/pay/Price";
import { pageMeta } from "@/lib/site";
import { counted, plural } from "@/lib/plural";
import { DAY_KEYS, MONTHS_NOM, MONTH_KEYS, matrixHref, yearKeys } from "./matrices";

export const metadata: Metadata = pageMeta({
  title: "Все матрицы судьбы: 5544 карты по свёрнутым числам даты",
  description:
    "Каталог матриц судьбы: 5544 карты по свёрнутым числам даты. На каждой — октаграмма, " +
    "позиции карты и два бесплатных раздела разбора.",
  path: "/matrix",
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
        <Crumbs trail={[{ name: "Главная", path: "/" }, { name: "Все матрицы" }]} />

        <h1>Все матрицы судьбы</h1>
        <p className="dim prose">
          Матрица зависит не от даты, а от трёх свёрнутых чисел: аркана дня (1–22), аркана месяца
          (1–12) и аркана года{ready ? ` (${years[0]}–${years[years.length - 1]})` : ""}. Поэтому все
          даты рождения с 1900 года дают {ready ? matrixCount() : 5544} различных карт — каждая
          разобрана отдельной страницей. Свою карту удобнее получить{" "}
          <Link href="/#calc">расчётом по дате</Link>: он идёт в браузере, дата не уходит на сервер.
        </p>

        <div className="panel section-gap">
          <h2>Как устроен адрес</h2>
          <div className="cap">Слаг матрицы — три числа через дефис</div>
          <p style={{ margin: 0 }}>
            <code>/matrix/14-6-7</code> — день сведён к 14, месяц к 6, год к 7. Так читается матрица
            всех, кто родился 14 июня года с суммой цифр 7 (например, 2005). Карта и два раздела на
            каждой странице открыты бесплатно, остальные 18 входят в полный разбор за{" "}
            <Price />.
          </p>
        </div>

        {ready ? (
          <>
            <h2 className="section-gap">Вход по аркану дня</h2>
            <p className="dim">
              Внутри каждой страницы — ссылки на все 12 месяцев, все{" "}
              {counted(years.length, "аркан", "аркана", "арканов")} года и все
              22 аркана дня, поэтому от любой карты можно дойти до любой другой.
            </p>
            <div className="cardgrid">
              {DAY_KEYS.map((day) => (
                <div className="ecard" key={day}>
                  <div className="num">день {day}</div>
                  <div className="nm">Аркан дня {day}</div>
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
            <h2>Каталог ещё не собран</h2>
            <div className="cap">Нет content/matrices.json — список троек считает engine/precompute.py</div>
            <p style={{ margin: 0 }}>
              Расчёт по своей дате работает и без каталога: он идёт в браузере на том же движке.
            </p>
          </div>
        )}

        <div className="panel section-gap">
          <h2>Куда дальше</h2>
          <div className="cap">Справочник, на который ссылается каждая позиция карты</div>
          <div className="taglist">
            <Link href="/encyclopedia">Энциклопедия матрицы судьбы</Link>
            <Link href="/encyclopedia/position/character">Характер</Link>
            <Link href="/encyclopedia/position/money">Деньги</Link>
            <Link href="/encyclopedia/position/relations">Отношения</Link>
            <Link href="/encyclopedia/position/center">Центр карты</Link>
          </div>
        </div>

        <div className="allbox">
          <h2>Найти свою матрицу</h2>
          <p>
            Вводить слаг руками не нужно: расчёт по дате рождения сам приведёт к нужной карте и покажет
            карту и два раздела сразу.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу бесплатно
          </Link>
        </div>
      </div>
    </main>
  );
}
