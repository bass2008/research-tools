import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard from "@/components/ArcanumCard";
import Price from "@/components/Price";
import Octagram from "@/components/Octagram";
import { arcanumShort, arcanumTitle } from "@/lib/arcana";
import { arcanumInPosition, matrixItem, matrixSlugs } from "@/lib/content";
import { POSITIONS, arcanumHref, chakraHref, positionHref } from "@/lib/encyclopedia";
import type { Matrix } from "@/lib/matrix";
import { build } from "@/lib/sections";
import { SITE, pageMeta } from "@/lib/site";
import { NOT_FOUND_META } from "@/lib/seo";
import { counted } from "@/lib/plural";

import {
  MONTHS_GEN,
  MONTHS_NOM,
  birthDates,
  matrixHref,
  parseSlug,
  sameDayMonth,
  sameDayYear,
  sameMonthYear,
} from "../matrices";

type Params = { slug: string };

// false отдавал 404 ещё на маршрутизации, до generateMetadata, и на неизвестном слаге
// в заголовке вкладки оставался заголовок главной
export const dynamicParams = true;

export function generateStaticParams(): Params[] {
  return matrixSlugs().map((slug) => ({ slug }));
}

// в феврале 28 дней, в апреле, июне, сентябре и ноябре — 30: иначе пояснение обещало «30 февраля»
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const DATES_SHOWN = 12;

const CHAKRA_COLORS: Record<string, string> = {
  sahasrara: "#8e5bc4",
  ajna: "#3f5ec9",
  vishuddha: "#1f9ed6",
  anahata: "#159c69",
  manipura: "#d9ac1e",
  svadhisthana: "#dd7b2a",
  muladhara: "#c9453a",
};

const POINT_POSITIONS = POSITIONS.filter((p) => p.kind === "point");

// Линии карты: третий аркан в каждой — итог, поэтому он выделен золотым.
const LINES: Array<[string, string, (m: Matrix) => number[]]> = [
  ["Деньги", "Канал достатка: продолжение, условие и итог.", (m) => m.money],
  ["Отношения", "Линия близости от материнской ветви.", (m) => m.love],
  ["Таланты", "Что дано, при каком условии раскрывается и что выходит.", (m) => m.talent],
  ["Небо и земля", "Духовная и материальная задачи.", (m) => [m.sky[2], m.ground[2], m.harmony]],
  ["Род", "Мужская и женская ветви и планетарная задача.", (m) => [m.social_male[2], m.social_female[2], m.planetary]],
  ["Кармический хвост", "То, что пришло с вами и повторяется.", (m) => m.karmic_tail],
];

function seo(slug: string) {
  const item = matrixItem(slug);
  const key = parseSlug(slug);
  if (!item || !key) return null;
  const m = item.matrix;
  const dates = birthDates(key);
  // Заголовок короткий намеренно: layout дописывает « — Матрица судьбы», а выдача режет
  // всё после ~70 знаков. Остальные арканы уходят в description.
  const title = `Матрица ${slug}: центр ${m.center} «${arcanumTitle(m.center)}»`;
  const description =
    `Разбор карты ${slug} (день ${key.day}, месяц ${key.month}, год ${key.year}): центр ` +
    `${m.center} ${arcanumTitle(m.center)}, миссия ${m.mission} ${arcanumTitle(m.mission)}, ` +
    `денежный канал ${m.money[0]}, линия отношений ${m.love[0]}. Два раздела бесплатно; ` +
    `такую карту ${dates.length === 1 ? "даёт" : "дают"} ${counted(dates.length, "дата", "даты", "дат")} рождения.`;
  return { item, key, m, dates, title, description };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const data = seo((await params).slug);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!data) return NOT_FOUND_META;
  return pageMeta({
    title: data.title,
    description: data.description,
    path: matrixHref(data.item.slug),
  });
}

export default async function MatrixPage({ params }: { params: Promise<Params> }) {
  const data = seo((await params).slug);
  if (!data) notFound();
  const { item, key, m, dates, title, description } = data;
  const slug = item.slug;

  const sections = build(m, false);
  const free = sections.filter((s) => s.access === "free");
  const paid = sections.filter((s) => s.access === "paid");
  const monthName = MONTHS_NOM[key.month - 1];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: "ru",
    mainEntityOfPage: { "@type": "WebPage", "@id": new URL(matrixHref(slug), SITE.url).toString() },
  };

  return (
    <main className="page">
      <div className="wrap">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/matrix">Все матрицы</Link>{" "}
          <span>/</span> <span>{slug}</span>
        </p>

        <h1>Матрица судьбы {slug}</h1>
        <div className="matrixcards">
          <Link className="cardlink" href={arcanumHref(m.center)}>
            <ArcanumCard n={m.center} size="grid" eager decorative />
            <span>
              центр · {m.center} «{arcanumTitle(m.center)}»
            </span>
          </Link>
          <Link className="cardlink" href={arcanumHref(m.mission)}>
            <ArcanumCard n={m.mission} size="grid" eager decorative />
            <span>
              миссия · {m.mission} «{arcanumTitle(m.mission)}»
            </span>
          </Link>
        </div>
        <p className="dim prose">
          Карта, в которой день сводится к аркану {key.day}, месяц — к {key.month} ({monthName}), а год — к{" "}
          {key.year}. Центр карты — {m.center} «{arcanumTitle(m.center)}», миссия — {m.mission} «
          {arcanumTitle(m.mission)}». Ниже все позиции карты и два бесплатных раздела; чтобы
          посмотреть свою карту, <Link href="/#calc">введите дату рождения</Link> — расчёт идёт в браузере.
        </p>

        <div className="rgrid section-gap">
          <div className="panel">
            <h3>Октаграмма этой матрицы</h3>
            <div className="cap">
              Восемь внешних позиций, четыре точки комфорта и центр; по кругу — десятилетия
            </div>
            <Octagram m={m} linked={false} />
          </div>

          <div>
            <div className="panel">
              <h3>Карта энергий по чакрам</h3>
              <div className="cap">Семь уровней в трёх колонках: материя, энергия и чувства</div>
              <table className="chak">
                <thead>
                  <tr>
                    <th>Уровень</th>
                    <th>Физика</th>
                    <th>Энергия</th>
                    <th>Эмоции</th>
                  </tr>
                </thead>
                <tbody>
                  {m.chakras.map((r, i) => (
                    <tr key={r.key}>
                      <td style={{ background: CHAKRA_COLORS[r.key] }}>
                        <Link href={chakraHref(r.key)} style={{ color: "#fff" }}>
                          {7 - i}. {r.title}
                        </Link>
                      </td>
                      <td>{r.physics}</td>
                      <td>{r.energy}</td>
                      <td>{r.emotions}</td>
                    </tr>
                  ))}
                  <tr className="tot">
                    <td>Итого</td>
                    <td>{m.chakra_totals.physics}</td>
                    <td>{m.chakra_totals.energy}</td>
                    <td>{m.chakra_totals.emotions}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mini">
              {LINES.map(([label, hint, triad]) => (
                <div className="mb" key={label}>
                  <h4>{label}</h4>
                  <p>{hint}</p>
                  <div className="row">
                    {triad(m).map((v, i) => (
                      <Link
                        className={i === 2 ? "bub g" : "bub"}
                        key={`${label}-${i}`}
                        href={`/encyclopedia/arcanum/${v}`}
                      >
                        {v}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel section-gap">
          <h3>Все позиции этой карты</h3>
          <div className="cap">Позиция · аркан · как читается</div>
          <div className="tabscroll">
            <table className="postab short">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Аркан</th>
                  <th>Значение</th>
                </tr>
              </thead>
              <tbody>
                {POINT_POSITIONS.map((p) => {
                  const v = (m as unknown as Record<string, number>)[p.key];
                  return (
                    <tr key={p.key}>
                      <td className="pn">
                        <Link href={positionHref(p.key)}>{p.title}</Link>
                      </td>
                      <td>
                        <span className="ar">
                          <Link href={`/encyclopedia/arcanum/${v}`}>
                            {v} · <b>{arcanumTitle(v)}</b>
                          </Link>
                        </span>
                      </td>
                      <td className="vl">{arcanumShort(v)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="section-gap">Разбор по этой матрице</h2>
        <p className="dim">
          Открыты без регистрации и оплаты. Остальные {paid.length} разделов входят в полный разбор за{" "}
          <Price />.
        </p>
        {free.map((s) => (
          <div className="panel section-gap" key={s.key}>
            <h3>{s.title}</h3>
            <div className="cap">{s.lead}</div>
            <ul className="poslist">
              {s.positions.map((p) => (
                <li key={p.label}>
                  <Link className="bub g" href={p.href}>
                    {p.arcanum}
                  </Link>
                  <span className="lb">
                    <b>{p.label}</b> · <Link href={p.href}>{arcanumTitle(p.arcanum)}</Link> —{" "}
                    {arcanumInPosition(p.arcanum, s.key)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
              <Link href={positionHref(s.key)}>Как читается раздел «{s.title}»</Link>
            </p>
          </div>
        ))}

        <div className="panel section-gap">
          <h3>Что ещё есть в полном разборе</h3>
          <div className="cap">{paid.length} разделов: род, деньги, отношения, программы и годы</div>
          <div className="taglist">
            {paid.map((s) => (
              <Link key={s.key} href={positionHref(s.key)}>
                {s.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="panel section-gap">
          <h3>Какие даты рождения дают эту матрицу</h3>
          <div className="cap">
            {counted(dates.length, "дата", "даты", "дат")}: аркан дня повторяется каждые 22 числа,
            аркан года — у всех лет с той же суммой цифр
          </div>
          <div className="taglist">
            {dates.slice(0, DATES_SHOWN).map((d) => (
              <span key={d.iso}>{d.label}</span>
            ))}
            {dates.length > DATES_SHOWN ? <span>и ещё {dates.length - DATES_SHOWN}</span> : null}
          </div>
          <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
            {key.day + 22 <= DAYS_IN_MONTH[key.month - 1]
              ? `Методика работает со свёрнутыми числами, поэтому ${key.day} и ${key.day + 22} ${MONTHS_GEN[key.month - 1]} дают одну и ту же карту.`
              : `Методика работает со свёрнутыми числами, поэтому ${key.day} ${MONTHS_GEN[key.month - 1]} любого года, который сворачивается в ${key.year}, даёт одну и ту же карту.`}
          </p>
        </div>

        <div className="panel section-gap">
          <h3>Соседние матрицы</h3>
          <div className="cap">Тот же день и месяц, другой аркан года</div>
          <div className="taglist">
            {sameDayMonth(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="cap" style={{ marginTop: 14 }}>
            Тот же день и год, другой месяц
          </div>
          <div className="taglist">
            {sameDayYear(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)}>
                {n.label}
              </Link>
            ))}
          </div>
          <div className="cap" style={{ marginTop: 14 }}>
            Тот же месяц и год, другой день
          </div>
          <div className="taglist">
            {sameMonthYear(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)}>
                {n.label}
              </Link>
            ))}
          </div>
          <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
            <Link href="/matrix">Все матрицы</Link> · <Link href="/encyclopedia">Энциклопедия</Link>
          </p>
        </div>

        <div className="allbox">
          <h3>Ваша матрица может быть другой</h3>
          <p>
            Эта страница собрана по тройке {slug}. Свою карту постройте по дате рождения: расчёт
            бесплатный и идёт в браузере — дата не уходит на сервер. Карта и два раздела
            открываются сразу, полный разбор — <Price />.
          </p>
          <Link className="btn" href="/#calc">
            Рассчитать свою матрицу
          </Link>
        </div>
      </div>
    </main>
  );
}
