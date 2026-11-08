import LocalizedAnchor from "@/components/ui/LocalizedAnchor";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n/lang";
import { LIGHT_COLORS, ORDER, cap } from "@/lib/individualLinks";
import { PAIR_ORDER } from "@/lib/pairLinks";
import { POINT, at, f1, type Size } from "./geometry";
import { routePath } from "./routes";
import { Frame, SIZE, YearFrame } from "./schemeParts";
import { yearAt, yearSize } from "./yearGeometry";
import "@/app/individual/landing.css";

export type SchemeKind = "personal" | "pair" | "year" | "month";

const KEYS: Record<SchemeKind, readonly string[]> = {
  personal: ORDER, pair: PAIR_ORDER,
  year: ["A", "B", "C", "D", "F", "G", "H", "I", "P1", "P2", "P3", "E"], month: ["A", "B", "C", "D", "F", "G", "H", "I", "E"],
};
// a link of the couple's amplifiers and continuations alone says nothing (Lisovskaya, "Compatibility", ch. 3)
const MINOR = new Set(["H", "I", "K", "P", "N", "O", "Q"]);
// the widget's hues without its two golds: on the gold background they do not read as a highlight
const PALETTE = LIGHT_COLORS.filter((_, i) => i !== 0 && i !== 7);

/** A scheme on the gold background, drawn like the links widget: white points, a ring and an arc for each link.
 *  `all` shows every repeat of the chart; otherwise only the `focus` points and the links between them. */
export default function GoldScheme({ kind, values, locale: L, focus, all = false, mini = false, label, href }: {
  kind: SchemeKind; values: Record<string, number | undefined>; locale: Lang; focus?: readonly string[]; all?: boolean;
  mini?: boolean; label: string; href?: (n: number) => string;
}) {
  const { arcanumTitle } = arcanaForLocale(L);
  const forecast = kind === "year" || kind === "month";
  const keys = KEYS[kind].filter((k) => values[k] !== undefined);
  const linksOf = (pool: readonly string[]) => {
    const byValue = new Map<number, string[]>();
    pool.forEach((k) => byValue.set(values[k]!, [...(byValue.get(values[k]!) ?? []), k]));
    return [...byValue.values()].filter((g) => g.length > 1 && !(kind === "pair" && g.every((k) => MINOR.has(k))));
  };
  // a link keeps the colour it has on the whole scheme, so a thumbnail matches the scheme at the top of the reading;
  const whole = new Map<string, string>();
  linksOf(keys).forEach((g, i) => g.forEach((k) => whole.set(k, PALETTE[i % PALETTE.length])));
  const tint = (k: string) => whole.get(k) ?? PALETTE[0];
  const groups = all ? linksOf(keys) : linksOf((focus ?? []).filter((k) => values[k] !== undefined));
  const colour = (i: number) => tint(groups[i][0]);
  const ring: Record<string, string> = {};
  groups.forEach((g, i) => g.forEach((k) => { ring[k] = colour(i); }));
  if (!all) focus?.forEach((k) => { if (values[k] !== undefined) ring[k] ??= tint(k); });
  const pos = forecast ? yearAt : at;
  const sizeOf = (k: string): Size => forecast ? yearSize(k) : POINT[k as keyof typeof POINT].size;
  const role = (k: string) => (forecast ? D.yearLinks.points[L][k as keyof typeof D.yearLinks.points.ru]
    : kind === "pair" ? D.pairLinks.points[L][k as keyof typeof D.pairLinks.points.ru]
      : D.individualLinks.points[L][k as keyof typeof D.individualLinks.points.ru])[0];
  const node = (k: string) => {
    const [x, y] = pos(k), size = sizeOf(k), v = values[k]!, lit = ring[k];
    // on a thumbnail the discussed point must stay readable while the rest fades out
    const grow = mini && focus?.includes(k) ? 1.35 : 1, [r, fs] = SIZE[size].map((n) => n * grow);
    // a thumbnail fills its points with colour, as the widget's small maps do
    const solid = mini && lit;
    const body = <>
      <title>{`${cap(role(k))} · ${v} ${arcanumTitle(v)}`}</title>
      <circle className="lm-halo" cx={f1(x)} cy={f1(y)} r={r + 5} stroke={lit ?? "none"} />
      <circle className="lm-b" cx={f1(x)} cy={f1(y)} r={r} style={solid ? { fill: lit, stroke: "none" } : undefined} />
      <text x={f1(x)} y={f1(y + 1)} fontSize={fs} style={solid ? { fill: "#fff" } : undefined}>{v}</text>
    </>;
    const props = { className: `lm-node lm-${size}${lit ? " lm-on" : ""}`, "data-muted": focus && !focus.includes(k) ? true : undefined };
    return href && !mini ? <LocalizedAnchor key={k} href={href(v)} {...props}>{body}</LocalizedAnchor> : <g key={k} {...props}>{body}</g>;
  };
  return <div className="lm-host gold-scheme">
    <svg className={`lm-oct${mini ? " lm-m" : ""}`} viewBox={mini ? "0 0 620 620" : "8 8 604 604"} role="img" aria-label={label}>
      {forecast
        ? <YearFrame mini={mini} wheel={D.yearLinks.wheel[L]} thirds={kind === "year"} />
        : <Frame mini={mini} sky={kind === "personal" ? D.individualLinks.sky[L] : ""} earth={kind === "personal" ? D.individualLinks.earth[L] : ""} ages={kind === "personal"} />}
      <g className="lm-routes">{groups.map((g, i) => <path key={g.join()} className="lm-route" d={routePath(g, pos)} stroke={colour(i)} />)}</g>
      <g className="lm-nodes">{[...keys.filter((k) => k !== "E"), ...keys.filter((k) => k === "E")].map(node)}</g>
    </svg>
  </div>;
}
