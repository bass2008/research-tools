import ArcanumCard from "@/components/matrix/ArcanumCard";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { forLocale as localizedContent } from "@/lib/content";
import { POSITIONS, forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedText } from "@/lib/text";
import Link from "next/link";

export type PositionKind = (typeof POSITIONS)[number]["kind"];

export const forLocale = localized((L: Locale) => {
  const { ARCANA } = localizedArcana(L);
  const { chakraContent, positionContent } = localizedContent(L);
  const { CHAKRA_PAGES, POSITIONS, arcanumHref, chakraHref, combinationHref, positionHref } = localizedEncyclopedia(L);
  const { clip } = localizedText(L);

  function positionsOfKind(kind: "section" | "point") {
    return POSITIONS.filter((p) => (kind === "section" ? p.kind === "section" : p.kind !== "section")).map(
      (position) => {
        const content = positionContent(position.key);
        if (!content) throw new Error(`нет канонического материала позиции ${position.key}`);
        return { ...position, lead: content.lead };
      },
    );
  }
  return { ARCANA, chakraContent, positionContent, CHAKRA_PAGES, POSITIONS, arcanumHref, chakraHref, combinationHref, positionHref, clip, positionsOfKind };
});

export const { positionsOfKind } = forLocale(defaultLocale);

// Списки разделов справочника. Раньше все шесть лежали телами панелей на /encyclopedia, и та
// страница раздавала 363 ссылки сразу: вес делился между 231 парой арканов и 7 чакрами поровну,
// а поиск читал справочник как один каталог однотипного. Теперь список живёт на шапке своего
// раздела, а /encyclopedia раздаёт ссылки на шапки. Разметка перенесена без изменений: она уже
// проверена браузерными сценариями, и менять её заодно с адресами значило бы менять две вещи
// разом.

export function ArcanaDeck({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const L = requestedLocale ?? defaultLocale;
  const { ARCANA, arcanumHref } = forLocale(L);

  return (
    <div className="enc-deck">
      {ARCANA.map((a) => (
        <Link className="enc-card" key={a.n} href={arcanumHref(a.n)} prefetch={false}>
          <ArcanumCard locale={L} n={a.n} size="grid" decorative />
          <span className="dn">
            {a.n} · {a.title}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function PositionRows({ locale: requestedLocale, ...localeProps }: ({ items: { key: string; title: string; lead: string }[] }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { items } = localeProps;
  const { positionHref } = forLocale(L);

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

export function ChakraList({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const L = requestedLocale ?? defaultLocale;
  const { chakraContent, CHAKRA_PAGES, chakraHref, clip } = forLocale(L);

  return (
    <div className="chcol">
      {CHAKRA_PAGES.map((c) => {
        const content = chakraContent(c.key);
        if (!content) throw new Error(`нет канонического материала чакры ${c.key}`);
        return (
          <Link className={`chrow k${c.index}`} key={c.key} href={chakraHref(c.key)}>
            <span className="chn">{c.index}</span>
            <span className="chb">
              <span className="cht">{c.title}</span>
              <span className="chh">{c.hint}</span>
            </span>
            {content.columns.map((col) => (
              <span className="chc" key={col.title}>
                <i>{col.title}</i>
                {clip(col.text, 62)}
              </span>
            ))}
          </Link>
        );
      })}
    </div>
  );
}

export function CombinationMatrix({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const L = requestedLocale ?? defaultLocale;
  const { ARCANA, combinationHref } = forLocale(L);

  return (
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
                return (
                  <td key={b.n}>
                    <Link
                      href={combinationHref(a.n, b.n)}
                      title={D.octagram.pairTitle[L](a.n, b.n)}
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
  );
}
