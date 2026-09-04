import Link from "next/link";

import ArcanumCard from "@/components/matrix/ArcanumCard";

import { ARCANA } from "@/lib/arcana";
import { chakraContent, positionContent } from "@/lib/content";
import { CHAKRA_PAGES, POSITIONS, arcanumHref, chakraHref, combinationHref, positionHref } from "@/lib/encyclopedia";
import { clip } from "@/lib/text";

// Списки разделов справочника. Раньше все шесть лежали телами панелей на /encyclopedia, и та
// страница раздавала 363 ссылки сразу: вес делился между 231 парой арканов и 7 чакрами поровну,
// а поиск читал справочник как один каталог однотипного. Теперь список живёт на шапке своего
// раздела, а /encyclopedia раздаёт ссылки на шапки. Разметка перенесена без изменений: она уже
// проверена браузерными сценариями, и менять её заодно с адресами значило бы менять две вещи
// разом.

export function ArcanaDeck() {
  return (
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
  );
}

export type PositionKind = (typeof POSITIONS)[number]["kind"];

export function positionsOfKind(kind: "section" | "point") {
  return POSITIONS.filter((p) => (kind === "section" ? p.kind === "section" : p.kind !== "section")).map(
    (position) => {
      const content = positionContent(position.key);
      if (!content) throw new Error(`нет канонического материала позиции ${position.key}`);
      return { ...position, lead: content.lead };
    },
  );
}

export function PositionRows({ items }: { items: { key: string; title: string; lead: string }[] }) {
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

export function ChakraList() {
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

export function CombinationMatrix() {
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
  );
}
