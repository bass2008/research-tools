import { CX, OUTLINE, R_IN, R_OUT, f1, poly, xy, type Size } from "./geometry";
import { R_WHEEL, THIRD_EDGES, THIRDS } from "./yearGeometry";

// Shared by the links widget and the schemes of a reading on the gold background: one drawing everywhere.
export const SIZE: Record<Size, [number, number]> = { big: [24, 20], mid: [21, 17.5], in: [19, 16], sm: [15.5, 13.5], ctr: [33, 27] };

export function YearFrame({ mini, wheel, thirds = true }: { mini: boolean; wheel: string[]; thirds?: boolean }) {
  return <>
    {!mini && <><circle className="lm-ring" cx={CX} cy={CX} r={R_OUT + 30} /><circle className="lm-ring" cx={CX} cy={CX} r={R_OUT + 18} /></>}
    <polygon className="lm-side" points={poly(OUTLINE, R_OUT)} />
    <polygon className="lm-diag" points={poly([-90, 0, 90, 180], R_OUT)} />
    <polygon className="lm-diag" points={poly([-45, 45, 135, 225], R_OUT)} />
    {[180, 225, -90, -45].map((a) => { const [x1, y1] = xy(a, R_OUT), [x2, y2] = xy(a + 180, R_OUT); return <line key={a} className="lm-axis" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />; })}
    {thirds && <>
    <circle className="lm-wheel" cx={CX} cy={CX} r={R_WHEEL} />
    {THIRD_EDGES.map((a) => { const [x1, y1] = xy(a, R_WHEEL - 9), [x2, y2] = xy(a, R_WHEEL + 9); return <line key={a} className="lm-wheel-tick" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />; })}
    {!mini && Object.values(THIRDS).map((a, i) => {
      const side = Math.cos(a * Math.PI / 180), [x, y] = xy(a, R_WHEEL + (Math.abs(side) > 0.3 ? 26 : 44));
      return <text key={a} className="lm-lbl lm-third" x={f1(x)} y={f1(y + (Math.abs(side) > 0.3 ? -14 : 12))}
        style={{ textAnchor: side > 0.3 ? "start" : side < -0.3 ? "end" : "middle" }}>{wheel[i]}</text>;
    })}
    </>}
  </>;
}

export function Frame({ mini, sky, earth, ages }: { mini: boolean; sky: string; earth: string; ages: boolean }) {
  return <>
    {!mini && <>
      <circle className="lm-ring" cx={CX} cy={CX} r={R_OUT + 30} /><circle className="lm-ring" cx={CX} cy={CX} r={R_OUT + 18} />
      {ages && Array.from({ length: 80 }, (_, i) => {
        const a = 180 + i * 4.5, [x1, y1] = xy(a, R_OUT + 18), [x2, y2] = xy(a, R_OUT + (i % 5 ? 23 : 27));
        const age = i % 10 === 0 && i ? xy(a, R_OUT + 39) : null;
        return <g key={i}>
          <line className="lm-tick" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} strokeWidth={i % 5 ? 0.7 : 1.3} />
          {age && <text className="lm-age" x={f1(age[0])} y={f1(age[1])}>{i}</text>}
        </g>;
      })}
    </>}
    <polygon className="lm-side" points={poly(OUTLINE, R_OUT)} />
    <polygon className="lm-diag" points={poly([-90, 0, 90, 180], R_IN)} />
    <polygon className="lm-diag" points={poly([-45, 45, 135, 225], R_IN)} />
    {[180, 225, -90, -45].map((a) => { const [x1, y1] = xy(a, R_OUT), [x2, y2] = xy(a + 180, R_OUT); return <line key={a} className="lm-axis" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />; })}
    {!mini && <>
      <text className="lm-lbl" x={CX} y={CX - R_IN + 34}>{sky}</text><text className="lm-lbl" x={CX} y={CX + R_IN - 26}>{sky}</text>
      <text className="lm-lbl" x={CX - R_IN} y={CX - 30}>{earth}</text><text className="lm-lbl" x={CX + R_IN} y={CX - 30}>{earth}</text>
    </>}
  </>;
}
