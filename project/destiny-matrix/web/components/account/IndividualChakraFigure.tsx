import type { CSSProperties } from "react";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import Octagram from "@/components/matrix/Octagram";
import { CHAKRA_COLORS } from "@/components/matrix/OctagramParts";
import Link from "@/components/ui/LocalizedLink";
import chakraLevels from "@/lib/__fixtures__/chakras.json";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import type { Lang } from "@/lib/i18n/lang";
import type { Matrix } from "@/lib/matrix";
import { forLocale as matrixMapForLocale } from "@/lib/matrixMap";

const ORDER = ["muladhara", "svadhisthana", "manipura", "anahata", "vishuddha", "ajna", "sahasrara"];
const COLUMNS = [
  ["physics", "Физика", "Physics"],
  ["energy", "Энергия", "Energy"],
  ["emotions", "Эмоции", "Emotions"],
] as const;

/** Три карты чакры из расчёта читателя и её точки физики и энергии на мини-схеме; у итога точек нет. */
export default function IndividualChakraFigure({ m, chakra, locale, eager = false }: {
  m: Matrix; chakra: string; locale: Lang; eager?: boolean;
}) {
  const { arcanumTitle } = arcanaForLocale(locale);
  const { mapPointsBySymbol } = matrixMapForLocale(locale);
  const row = chakra === "total" ? m.chakra_totals : m.chakras?.find((r) => r.key === chakra);
  if (!row) return null;
  const level = chakraLevels.find((l) => l.key === chakra);
  const keys = level ? [...new Set([level.physics, level.energy])]
    .map((s) => s === "E" ? "center" : mapPointsBySymbol([s])[0]?.key).filter((k): k is string => Boolean(k)) : [];
  const color = CHAKRA_COLORS[ORDER.indexOf(chakra)];
  return <figure className="individual-chakra" data-chakra={chakra} data-map={keys.length ? "" : undefined}
    style={color ? { "--focus-color": color } as CSSProperties : undefined}>
    {COLUMNS.map(([column, ru, en]) => <Link key={column} className="poscard" href={`/encyclopedia/arcanum/${row[column]}`}>
      <span className="who">{locale === "en" ? en : ru}</span>
      <ArcanumCard locale={locale} n={row[column]} size="big" decorative eager={eager} />
      <span className="lb"><span className="nm"><span className="rn">{row[column]}</span> {arcanumTitle(row[column])}</span></span>
    </Link>)}
    {keys.length > 0 && <div className="individual-card-map"><Octagram m={m} locale={locale} linked={false} focus={keys} /></div>}
  </figure>;
}
