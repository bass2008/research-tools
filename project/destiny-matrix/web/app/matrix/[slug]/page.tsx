import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraTable from "@/components/matrix/ChakraTable";
import SectionEncyclopediaLinks from "@/components/matrix/SectionEncyclopediaLinks";
import Crumbs from "@/components/ui/Crumbs";
import JsonLd from "@/components/ui/JsonLd";
import Price from "@/components/pay/Price";
import Octagram from "@/components/matrix/Octagram";
import { arcanumShort, arcanumTitle } from "@/lib/arcana";
import { matrixItem, matrixSlugs } from "@/lib/content";
import { POSITIONS, arcanumHref, chakraHref, positionHref } from "@/lib/encyclopedia";
import type { Matrix } from "@/lib/matrix";
import { build } from "@/lib/sections";
import { pageMeta } from "@/lib/site";
import { articleLd } from "@/lib/schema";
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

// Перечень адресов полный: неизвестный отдаётся готовым 404 (_not-found), а не
// динамическим рендером — у того пустое тело и заголовок главной.
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return matrixSlugs().map((slug) => ({ slug }));
}

// в феврале 28 дней, в апреле, июне, сентябре и ноябре — 30: иначе пояснение обещало «30 февраля»
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const DATES_SHOWN = 12;


const POINT_POSITIONS = POSITIONS.filter((p) => p.kind === "point");

// Линии карты: третий аркан в каждой — итог, поэтому он выделен золотым.
const LINES: Array<[string, string, (m: Matrix) => number[]]> = [
  ["Деньги", "Канал достатка: продолжение, условие и итог.", (m) => m.money],
  ["Отношения", "Линия близости от материнской ветви.", (m) => m.love],
  ["Таланты", "Что дано, при каком условии раскрывается и что выходит.", (m) => m.talent],
  ["Небо и земля", "Духовная и материальная задачи.", (m) => [m.sky[2], m.ground[2], m.harmony]],
  ["Род", "Мужская и женская ветви и планетарное предназначение.", (m) => [m.social_male[2], m.social_female[2], m.planetary]],
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
    `${m.center} ${arcanumTitle(m.center)}, кармическая задача ${m.mission} ${arcanumTitle(m.mission)}, ` +
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
    // страница отдаёт schema.org Article — og:type должен утверждать то же самое
    article: true,
    // 5544 страницы одной формы — массив почти-дублей. Страница остаётся как результат расчёта
    // и как узел перелинковки, поэтому follow, но в индекс не идёт и в карте сайта её нет.
    noindex: true,
    follow: true,
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

  return (
    <main id="content" className="page">
      <div className="wrap">
        <JsonLd data={articleLd({ headline: title, description, path: matrixHref(slug) })} />

        <Crumbs
          trail={[
            { name: "Главная", path: "/" },
            { name: "Все матрицы", path: "/matrix" },
            { name: slug },
          ]}
        />

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
              кармическая задача · {m.mission} «{arcanumTitle(m.mission)}»
            </span>
          </Link>
        </div>
        <p className="dim prose">
          Карта, в которой день сводится к аркану {key.day}, месяц — к {key.month} ({monthName}), а год — к{" "}
          {key.year}. Центр карты — {m.center} «{arcanumTitle(m.center)}», кармическая задача — {m.mission} «
          {arcanumTitle(m.mission)}». Ниже все позиции карты и два бесплатных раздела; чтобы
          посмотреть свою карту, <Link href="/#calc">введите дату рождения</Link> — расчёт идёт в браузере.
        </p>

        <div className="rgrid section-gap">
          <div className="panel">
            <h2>Октаграмма этой матрицы</h2>
            <div className="cap">
              Восемь внешних позиций, четыре точки комфорта и центр; по кругу — десятилетия
            </div>
            <Octagram m={m} linked={false} />
          </div>

          <div>
            <ChakraTable m={m} heading="h2" />

            <div className="mini">
              {LINES.map(([label, hint, triad]) => (
                <div className="mb" key={label}>
                  <h3>{label}</h3>
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
          <h2>Все позиции этой карты</h2>
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
                    {p.text}
                  </span>
                </li>
              ))}
            </ul>
            <SectionEncyclopediaLinks section={s} />
          </div>
        ))}

        <div className="panel section-gap">
          <h2>Что ещё есть в полном разборе</h2>
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
          <h2>Какие даты рождения дают эту матрицу</h2>
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
          <h2>Соседние матрицы</h2>
          <div className="cap">Тот же день и месяц, другой аркан года</div>
          <div className="taglist">
            {sameDayMonth(key).map((n) => (
              <Link key={n.slug} href={matrixHref(n.slug)} prefetch={false}>
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
          <h2>Ваша матрица может быть другой</h2>
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
