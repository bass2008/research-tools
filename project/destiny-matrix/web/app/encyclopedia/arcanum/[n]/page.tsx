import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard, { arcanumImage } from "@/components/ArcanumCard";
import Price from "@/components/Price";

import { ARCANA, roman } from "@/lib/arcana";
import {
  CHAKRA_PAGES,
  arcanumEntry,
  arcanumHref,
  chakraHref,
  positionByKey,
  positionHref,
} from "@/lib/encyclopedia";
import { arcanumContent, arcanumInPosition } from "@/lib/content";
import { SITE, pageMeta } from "@/lib/site";

type Params = { n: string };

export function generateStaticParams(): Params[] {
  return ARCANA.map((a) => ({ n: String(a.n) }));
}

// Сгенерированный контент перекрывает встроенный корпус по полям, которые прошли проверку.
function entry(n: number) {
  const base = arcanumEntry(n);
  const extra = arcanumContent(n);
  // Позиции добираются пополю: отбракованный гигиеной ключ не должен пропадать со страницы.
  const in_positions = Object.fromEntries(
    Object.keys(base.in_positions).map((key) => [key, arcanumInPosition(n, key)]),
  );
  if (!extra) return { ...base, in_positions };
  return {
    ...base,
    short: extra.short ?? base.short,
    keywords: extra.keywords ?? base.keywords,
    meaning: extra.meaning ? extra.meaning.join("\n\n") : base.meaning,
    in_positions,
    plus: extra.plus ?? base.plus,
    minus: extra.minus ?? base.minus,
    seo: extra.seo ? { ...base.seo, ...extra.seo } : base.seo,
  };
}

function num(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 22 ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const n = num((await params).n);
  if (!n) return {};
  const e = entry(n);
  return pageMeta({ title: e.seo.title, description: e.seo.description, path: arcanumHref(n) });
}

export default async function ArcanumPage({ params }: { params: Promise<Params> }) {
  const n = num((await params).n);
  if (!n) notFound();
  const e = entry(n);
  const prev = n === 1 ? 22 : n - 1;
  const next = n === 22 ? 1 : n + 1;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: e.seo.title,
    description: e.seo.description,
    inLanguage: "ru",
    keywords: e.keywords.join(", "),
    image: new URL(arcanumImage(n), SITE.url).toString(),
    mainEntityOfPage: { "@type": "WebPage", "@id": new URL(arcanumHref(n), SITE.url).toString() },
  };

  return (
    <main className="page">
      <div className="wrap">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/encyclopedia">Энциклопедия</Link>{" "}
          <span>/</span> <span>{e.title}</span>
        </p>

        <div className="hero-arc">
          <ArcanumCard n={n} size="big" eager decorative />
          <div className="hero-arc-text">
            <span className="arcnum">{n}</span>
            <h1 style={{ marginBottom: 2 }}>{e.title}</h1>
            <div className="arcroman">
              {e.roman} · номер в матрице {e.matrix_number} · {e.short}
            </div>
          </div>
        </div>

        <div className="taglist section-gap">
          {e.keywords.map((k) => (
            <span key={k}>{k}</span>
          ))}
        </div>

        <div className="prose section-gap">
          <h2>Значение аркана</h2>
          {e.meaning.split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="twocol section-gap">
          <div className="panel">
            <h3>Сильная сторона</h3>
            <div className="cap">Что этот аркан даёт</div>
            <ul className="pmlist plus">
              {e.plus.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Изнанка</h3>
            <div className="cap">Как тот же аркан работает против</div>
            <ul className="pmlist minus">
              {e.minus.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel section-gap">
          <h3>Как читается в позициях карты</h3>
          <div className="cap">Один и тот же аркан в разных позициях говорит о разном</div>
          <dl className="kv">
            {Object.entries(e.in_positions).map(([key, text]) => {
              const pos = positionByKey(key);
              return (
                <div key={key} style={{ display: "contents" }}>
                  <dt>{pos ? <Link href={positionHref(key)}>{pos.title}</Link> : key}</dt>
                  <dd>{text}</dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="panel section-gap">
          <h3>Сочетания с другими арканами</h3>
          <div className="cap">21 пара: аркан рядом с каждым из остальных</div>
          <ul className="poslist">
            {e.combinations.map((c) => (
              <li key={c.with}>
                <Link className="bub g" href={arcanumHref(c.with)}>
                  {c.with}
                </Link>
                <span className="lb">
                  <Link href={c.href}>
                    {e.title} и {ARCANA[c.with - 1].title}
                  </Link>{" "}
                  — {c.short}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel section-gap">
          <h3>Куда дальше</h3>
          <div className="cap">Соседние арканы, чакры и ваш собственный расчёт</div>
          <div className="taglist">
            <Link href={arcanumHref(prev)}>
              ← {prev} · {ARCANA[prev - 1].title}
            </Link>
            <Link href={arcanumHref(next)}>
              {next} · {ARCANA[next - 1].title} →
            </Link>
            {CHAKRA_PAGES.map((c) => (
              <Link key={c.key} href={chakraHref(c.key)}>
                {c.title}
              </Link>
            ))}
            <Link href="/encyclopedia">Все 22 аркана</Link>
          </div>
        </div>

        <div className="allbox">
          <h3>Где этот аркан в вашей карте</h3>
          <p>
            {e.title} может стоять в центре, в линии рода или в денежном канале — от позиции зависит
            всё. Постройте свою октаграмму: расчёт бесплатный и идёт в браузере.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать матрицу бесплатно
          </Link>
          <p className="small" style={{ marginTop: 10 }}>
            Полный разбор всех 20 разделов — <Price />.
          </p>
        </div>
      </div>
    </main>
  );
}
