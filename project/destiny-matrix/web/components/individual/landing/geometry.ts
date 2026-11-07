// Places of the points on the octagram come from the site chart (lib/matrixMap); only the drawing differs.
import type { Letter } from "@/lib/individualLinks";
import { MAP_CENTER, MAP_POINTS } from "@/lib/matrixMap";

export type Size = "big" | "mid" | "in" | "sm" | "ctr";
export const CX = MAP_CENTER;
export const R_OUT = Math.max(...MAP_POINTS.map((p) => p.radius));
export const R_IN = MAP_POINTS.find((p) => p.symbol === "J")!.radius;

const R_MID = MAP_POINTS.find((p) => p.symbol === "N")!.radius;

// Q (Г2) is read only in the couple's matrix: the personal chart has no circle for it, it mirrors O.
export const POINT = {
  ...Object.fromEntries(MAP_POINTS.map((p) => [p.symbol, {
    angle: p.angle, radius: p.radius,
    size: (p.radius === 0 ? "ctr" : p.size === "small" ? "sm" : p.size === "big" ? "big" : p.radius === R_OUT ? "mid" : "in") as Size,
  }])),
  Q: { angle: 0, radius: R_MID, size: "sm" as Size },
} as Record<Letter | "Q", { angle: number; radius: number; size: Size }>;

export const xy = (angle: number, r: number): [number, number] => {
  const t = angle * Math.PI / 180;
  return [CX + r * Math.cos(t), CX + r * Math.sin(t)];
};
export const at = (k: string) => xy(POINT[k as Letter].angle, POINT[k as Letter].radius);
export const f1 = (n: number) => n.toFixed(1);
export const poly = (angles: number[], r: number) => angles.map((a) => xy(a, r).map(f1).join(",")).join(" ");
export const OUTLINE = [180, 225, -90, -45, 0, 45, 90, 135];
