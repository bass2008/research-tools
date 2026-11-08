import type { Mark } from "@/lib/individualLanding";
import type { Letter, Values } from "@/lib/individualLinks";
import { CX, OUTLINE, POINT, R_IN as RI, R_OUT as RO, at, f1, poly, xy, type Size } from "./geometry";

const COLORS: Partial<Record<Letter, string>> = { A: "#d9ac1e", B: "#8e5bc4", C: "#1f9ed6", D: "#c9453a", F: "#3f5ec9", G: "#3f5ec9", H: "#159c69", I: "#dd7b2a", E: "#0e8f88" };
const SIZE: Record<Size, [number, number]> = { big: [24, 19], mid: [19, 15.5], in: [15, 13], sm: [13, 11], ctr: [31, 23] };
const ORDER: Letter[] = ["N", "O", "P", "Q", "S", "T", "R", "R1", "R2", "J", "K", "L", "M", "A", "F", "B", "G", "C", "H", "D", "I", "E"];

const TICKS = Array.from({ length: 80 }, (_, i) => {
  const a = 180 + i * 4.5, [x1, y1] = xy(a, RO + 22), [x2, y2] = xy(a, i % 5 ? RO + 27 : RO + 31);
  return `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
}).join("");

export interface SchemeFocus {
  keys?: Letter[];
  links?: { chain: Letter[]; closed?: boolean }[];
  marks?: Mark[];
  dim?: boolean;
}

/** The light chart of the sample pages: lit points, the dotted link between them, marks on the age scale. */
export default function Scheme({ values, focus = {}, target = 30, ages = false, label }: {
  values: Values; focus?: SchemeFocus; target?: number; ages?: boolean; label: string;
}) {
  const keys = focus.keys ?? [];
  const on = keys.length > 0 || Boolean(focus.dim);
  return (
    <svg className={`lp-oct${on ? " lp-focus" : ""}`} viewBox="-6 -6 632 632" role="img" aria-label={label}>
      <circle className="lp-ring" cx={CX} cy={CX} r={RO + 38} />
      <circle className="lp-ring" cx={CX} cy={CX} r={RO + 22} />
      <path className="lp-ticks" d={TICKS} />
      {ages && [10, 20, 30, 40, 50, 60, 70].map((i) => {
        const [x, y] = xy(180 + i * 4.5, RO + 50);
        return <text key={i} className="lp-age" x={f1(x)} y={f1(y)}>{i}</text>;
      })}
      <polygon className="lp-side" points={poly(OUTLINE, RO)} />
      <polygon className="lp-diag" points={poly([-90, 0, 90, 180], RI)} />
      <polygon className="lp-diag" points={poly([-45, 45, 135, 225], RI)} />
      {[180, 225, -90, -45].map((a) => {
        const [x1, y1] = xy(a, RO), [x2, y2] = xy(a + 180, RO);
        return <line key={a} className="lp-axis" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />;
      })}
      <g className="lp-lk">
        {(focus.links ?? []).map((l, i) => {
          const pts = l.chain.map((k) => at(k).map(f1).join(",")).join(" ");
          return l.closed && l.chain.length > 2 ? <polygon key={i} points={pts} /> : <polyline key={i} points={pts} />;
        })}
      </g>
      <g className="lp-mks">
        {(focus.marks ?? []).map((mk, i) => {
          const [x, y] = xy(180 + mk.age * 4.5, RO + 30);
          return <g key={i} className={`lp-mk${mk.now ? " lp-now" : ""}`}>
            <circle cx={f1(x)} cy={f1(y)} r={mk.now ? 11 : 17} />
            {mk.n ? <text x={f1(x)} y={f1(y)}>{mk.n}</text> : null}
          </g>;
        })}
      </g>
      {ORDER.map((k) => {
        const [x, y] = at(k), [rad, fs] = SIZE[POINT[k].size];
        const lit = keys.includes(k);
        return <g key={k} className={`lp-nd${lit ? " lp-on" : ""}`} style={lit ? { transform: `scale(${Math.max(1.3, target / rad).toFixed(2)})` } : undefined}>
          <circle className="lp-rg" cx={f1(x)} cy={f1(y)} r={rad + 4} />
          <circle cx={f1(x)} cy={f1(y)} r={rad} fill={COLORS[k] ?? "#7d92a1"} />
          <text className="lp-n" x={f1(x)} y={f1(y)} fontSize={fs}>{values[k]}</text>
        </g>;
      })}
    </svg>
  );
}
