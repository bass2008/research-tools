// The year matrix takes the outer points of the site chart; its thirds sit on a wheel inside, the year running clockwise from the top.
import { at, xy, type Size } from "./geometry";

export const R_WHEEL = 96;
export const THIRDS: Record<string, number> = { P1: -30, P2: 90, P3: 210 };
export const THIRD_EDGES = [-90, 30, 150];

export const yearAt = (k: string) => (k in THIRDS ? xy(THIRDS[k], R_WHEEL) : at(k));
export const yearSize = (k: string): Size => (k in THIRDS ? "in" : k === "E" ? "ctr" : "ABCD".includes(k) ? "big" : "mid");
