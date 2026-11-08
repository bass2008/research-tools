import { CX, f1 } from "./geometry";

export type Pos = (k: string) => [number, number];

// A link is drawn as arcs through its points, nearest to nearest, bowing away from the centre.
export function chain(keys: string[], at: Pos): string[] {
  if (keys.length < 3) return keys;
  const pts = keys.map((k) => [k, ...at(k)] as const);
  const cx = pts.reduce((s, p) => s + p[1], 0) / pts.length, cy = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  let cur = pts.reduce((m, p) => Math.hypot(p[1] - cx, p[2] - cy) > Math.hypot(m[1] - cx, m[2] - cy) ? p : m, pts[0]);
  const out = [cur], left = pts.filter((p) => p !== cur);
  while (left.length) {
    let bi = 0;
    left.forEach((p, i) => { if (Math.hypot(p[1] - cur[1], p[2] - cur[2]) < Math.hypot(left[bi][1] - cur[1], left[bi][2] - cur[2])) bi = i; });
    cur = left.splice(bi, 1)[0]; out.push(cur);
  }
  return out.map((p) => p[0]);
}
export function routePath(keys: string[], at: Pos) {
  const ks = chain(keys, at);
  let d = "";
  for (let i = 0; i < ks.length - 1; i++) {
    const [x1, y1] = at(ks[i]), [x2, y2] = at(ks[i + 1]);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1);
    let nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    if ((mx - CX) * nx + (my - CX) * ny < 0) { nx = -nx; ny = -ny; }
    const bow = Math.min(64, Math.max(14, len * 0.2));
    d += `${i ? "" : `M${f1(x1)},${f1(y1)}`} Q${f1(mx + nx * bow)},${f1(my + ny * bow)} ${f1(x2)},${f1(y2)}`;
  }
  return d;
}
