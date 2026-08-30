import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { EncSection } from "@/components/enc/EncFrame";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CrumbsLd from "@/components/ui/CrumbsLd";
import { articleList } from "@/components/enc/EncShell";

import { ARCANA } from "@/lib/arcana";
import {
  CHAKRA_PAGES,
  KARMIC_TAIL_HUB,
  POSITIONS,
  YEAR_HUB,
  allCombinationSlugs,
  arcanumHref,
  chakraHref,
  hubHref,
  karmicTailHref,
  parseTail,
  positionHref,
  yearHref,
} from "@/lib/encyclopedia";
import {
  chakraContent,
  hub,
  hubKeys,
  karmicTails,
  yearArcanum,
  yearKeys,
  positionContent,
} from "@/lib/content";
import { pageMeta } from "@/lib/site";
import { clip } from "@/lib/text";
import { encyclopediaSection, type EncyclopediaSectionKey } from "@/lib/encyclopediaNavigation";

export const metadata: Metadata = pageMeta({
  title: "Энциклопедия матрицы судьбы: арканы, позиции, чакры",
  description:
    "Справочник по матрице судьбы: значения 22 арканов, 20 разделов отчёта, 17 позиций карты, " +
    "7 чакр и 231 сочетание арканов. Все страницы с перекрёстными ссылками.",
  path: "/encyclopedia",
});

function rows(items: { key: string; title: string; lead: string }[]) {
  return (
    <dl className="kv">
      {items.map((p) => (
        <div key={p.key} style={{ display: "contents" }}>
          <dt>
            <Link href={positionHref(p.key)}>{p.title}</Link>
          </dt>
          <dd>{p.lead}</dd>
        </div>
      ))}
    </dl>
  );
}

function tab(key: EncyclopediaSectionKey, count: number, body: ReactNode) {
  return { ...encyclopediaSection(key), count, body };
}

export default function EncyclopediaIndexPage() {
  const combos = allCombinationSlugs();
  const withLead = (position: (typeof POSITIONS)[number]) => {
    const content = positionContent(position.key);
    if (!content) throw new Error(`нет канонического материала позиции ${position.key}`);
    return { ...position, lead: content.lead };
  };
  const sections = POSITIONS.filter((p) => p.kind === "section").map(withLead);
  const points = POSITIONS.filter((p) => p.kind === "point").map(withLead);
  // тройки — числа, а не строки: иначе 11-11-4 стоит после 11-11-22
  const tails = karmicTails()
    .slice()
    .sort((a, b) => {
      const x = a.key.split("-").map(Number);
      const y = b.key.split("-").map(Number);
      for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
      return 0;
    });
  // ключи года — строки: без числовой сортировки список шёл 1, 10, 11, …, 2, 20, 2026, 21
  const years = yearKeys()
    .slice()
    .sort((a, b) => (Number(a) || 1e6) - (Number(b) || 1e6) || a.localeCompare(b));

  const tabs = [
    tab(
      "arc",
      ARCANA.length,
      (
        <div className="enc-deck">
          {ARCANA.map((a) => (
            <Link className="enc-card" key={a.n} href={arcanumHref(a.n)} prefetch={false}>
              <ArcanumCard n={a.n} size="grid" decorative />
              <span className="dn">
                {a.n} · {a.title}
              </span>
            </Link>
          ))}
        </div>
      ),
    ),
    tab("sec", sections.length, rows(sections)),
    tab("pts", points.length, rows(points)),
    tab(
      "chk",
      CHAKRA_PAGES.length,
      (
        <div className="chcol">
          {CHAKRA_PAGES.map((c) => {
            const content = chakraContent(c.key);
            if (!content) throw new Error(`нет канонического материала чакры ${c.key}`);
            const cols = content.columns;
            return (
              <Link className={`chrow k${c.index}`} key={c.key} href={chakraHref(c.key)}>
                <span className="chn">{c.index}</span>
                <span className="chb">
                  <span className="cht">{c.title}</span>
                  <span className="chh">{c.hint}</span>
                </span>
                {cols.map((col) => (
                  <span className="chc" key={col.title}>
                    <i>{col.title}</i>
                    {clip(col.text, 62)}
                  </span>
                ))}
              </Link>
            );
          })}
        </div>
      ),
    ),
    tab(
      "tls",
      tails.length,
      (
        <div className="enc-tails">
          {tails.map((t) => {
            const arcana = parseTail(t.key) ?? [];
            return (
              <Link className="enc-tail" key={t.key} href={karmicTailHref(t.key)} prefetch={false}>
                <span className="trio">
                  {arcana.map((n, k) => (
                    <ArcanumCard key={`${t.key}-${k}`} n={n} size="mini" half decorative />
                  ))}
                </span>
                <span className="tb">
                  <span className="tk">{t.key}</span>
                  <span className="td">{clip(t.short, 96)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ),
    ),
    tab(
      "yer",
      years.length,
      (
        <div className="enc-years">
          {years.map((key) => {
            const item = yearArcanum(key);
            const n = Number(key);
            return (
              <Link className="enc-year" key={key} href={yearHref(key)} prefetch={false}>
                {Number.isFinite(n) && n >= 1 && n <= 22 ? (
                  <ArcanumCard n={n} size="grid" decorative />
                ) : null}
                <span className="yb">
                  <span className="yn">{item?.title ?? `${key} на год`}</span>
                  <span className="yd">{clip(item?.short ?? "", 88)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ),
    ),
    tab(
      "cmb",
      combos.length,
      (
        <div className="enc-matrix">
          <table className="mx">
            <thead>
              <tr>
                <th />
                {ARCANA.map((b) => (
                  <th key={b.n}>{b.n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ARCANA.map((a) => (
                <tr key={a.n}>
                  <th scope="row">{a.n}</th>
                  {ARCANA.map((b) => {
                    if (a.n === b.n) return <td className="self" key={b.n} />;
                    const [lo, hi] = a.n < b.n ? [a.n, b.n] : [b.n, a.n];
                    return (
                      <td key={b.n}>
                        <Link
                          href={`/encyclopedia/combination/${lo}-${hi}`}
                          title={`${a.n} и ${b.n}`}
                          // 462 ячейки таблицы: префетч каждой пары стоил бы мегабайты трафика
                          prefetch={false}
                        >
                          {b.n}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    ),
    tab(
      "art",
      articleList().length,
      (
        <div className="enc-articles">
          {articleList().map((a) => (
            <Link className="enc-article" key={a.href} href={a.href}>
              <span className="an">{a.title}</span>
              <span className="ad">{clip(a.short, 150)}</span>
            </Link>
          ))}
        </div>
      ),
    ),
  ];

  return (
    <>
      <CrumbsLd
        trail={[
          { name: "Главная", path: "/" },
          { name: "Энциклопедия" },
        ]}
      />

      {tabs.map((t) => (
        <EncSection key={t.key} sectionKey={t.key}>
          {t.body}
        </EncSection>
      ))}

      <div className="panel section-gap">
        <h2>Разделы справочника</h2>
        <div className="cap">Категории, которые собраны отдельными ветками</div>
        <div className="taglist">
          <Link href={KARMIC_TAIL_HUB}>
            Кармический хвост{tails.length ? ` · ${tails.length}` : ""}
          </Link>
          <Link href={YEAR_HUB}>
            {encyclopediaSection("yer").title}{years.length ? ` · ${years.length}` : ""}
          </Link>
          {/* концепт-хабы появляются здесь вместе со статьёй: иначе страница попадала бы в
              карту сайта, не имея ни одной входящей ссылки */}
          {hubKeys().map((key) => (
            <Link key={key} href={hubHref(key)}>
              {hub(key)!.title}
            </Link>
          ))}
          <Link href="/matrix">Каталог матриц</Link>
        </div>
      </div>
    </>
  );
}
