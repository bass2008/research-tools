import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Price from "@/components/Price";

import { ARCANA } from "@/lib/arcana";
import { POSITIONS, arcanumHref, positionByKey, positionHref } from "@/lib/encyclopedia";
import { arcanumInPosition, positionContent } from "@/lib/content";
import { pageMeta } from "@/lib/site";
import { sectionByKey } from "@/lib/sections";

type Params = { key: string };

export function generateStaticParams(): Params[] {
  return POSITIONS.map((p) => ({ key: p.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = positionByKey((await params).key);
  if (!p) return {};
  const kind = p.kind === "section" ? "раздел разбора" : "позиция матрицы";
  const extra = positionContent(p.key);
  return pageMeta({
    title: extra?.seo?.title ?? `${p.title} — ${kind} матрицы судьбы`,
    description:
      extra?.seo?.description ??
      `${p.lead} Как считается: ${p.formula}. Значение всех 22 арканов в этой позиции.`,
    path: positionHref(p.key),
  });
}

export default async function PositionPage({ params }: { params: Promise<Params> }) {
  const p = positionByKey((await params).key);
  if (!p) notFound();

  const extra = positionContent(p.key);
  const paragraphs = extra?.meaning ?? p.paragraphs;
  const section = p.kind === "section" ? sectionByKey(p.key) : undefined;
  const siblings = POSITIONS.filter((x) => x.kind === p.kind && x.key !== p.key).slice(0, 8);
  const isFree = section?.access === "free";

  return (
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/encyclopedia">Энциклопедия</Link>{" "}
          <span>/</span> <span>{p.title}</span>
        </p>

        <h1>{p.title}</h1>
        <p className="dim prose">{p.lead}</p>

        <div className="panel section-gap">
          <h3>Как считается</h3>
          <div className="cap">Формула позиции в методике</div>
          <p style={{ margin: 0 }}>{p.formula}</p>
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

        {extra?.reading ? (
          <div className="panel">
            <h3>Как читать позицию</h3>
            <div className="cap">Порядок, в котором смотрят на арканы</div>
            <p style={{ margin: 0 }}>{extra.reading}</p>
          </div>
        ) : null}

        <div className="panel section-gap">
          <h3>Все 22 аркана в этой позиции</h3>
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

        <div className="panel section-gap">
          <h3>Рядом в карте</h3>
          <div className="cap">{p.kind === "section" ? "Другие разделы разбора" : "Другие позиции матрицы"}</div>
          <div className="taglist">
            {siblings.map((s) => (
              <Link key={s.key} href={positionHref(s.key)}>
                {s.title}
              </Link>
            ))}
            <Link href="/encyclopedia">Все позиции</Link>
          </div>
        </div>

        <div className="allbox">
          <h3>Посмотреть эту позицию в своей карте</h3>
          <p>
            Расчёт бесплатный и идёт в браузере: дата рождения не уходит на сервер. Карта и два
            раздела открываются сразу, полный разбор — <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу
          </Link>
        </div>
      </div>
    </main>
  );
}
