import { D } from "./i18n";
import type { Lang } from "./i18n/hosts";
import { forLocale as localizedMatrix, type Matrix } from "./matrix";
import { computePair } from "./pair/engine";

export interface SharedLike { shared: "reading" | "individual"; product?: string; inputs: Record<string, unknown>; year?: number | null }

const birthOf = (v: unknown) => (v as { birth?: string } | undefined)?.birth ?? "";

export const pairDates = (L: Lang, a: string, b: string) => {
  const { birthLabel } = localizedMatrix(L);
  return `${birthLabel(a)} ${D.report.datesAnd[L]} ${birthLabel(b)}`;
};

export function sharedHeadline(row: SharedLike, L: Lang): { title: string; dates: string } {
  const T = D.report;
  const a = birthOf(row.inputs.a), b = birthOf(row.inputs.b), own = String(row.inputs.birth ?? "");
  const pair = Boolean(a && b);
  const dates = pair ? pairDates(L, a, b) : own ? localizedMatrix(L).birthLabel(own) : "";
  const title = row.shared === "individual"
    ? pair ? T.sharedIndividualPairTitle[L] : row.year ? T.sharedIndividualYearTitle[L](row.year) : T.sharedIndividualTitle[L]
    : pair ? T.sharedPairTitle[L] : T.sharedTitle[L];
  return { title, dates };
}

// the outer eight points from the left clockwise, then the centre: the order the preview draws them in
export function sharedPoints(row: SharedLike, L: Lang): number[] | null {
  const a = birthOf(row.inputs.a), b = birthOf(row.inputs.b), own = String(row.inputs.birth ?? "");
  try {
    if (a && b) {
      const p = computePair(a, b, L).p;
      return [p.A, p.F, p.B, p.G, p.C, p.H, p.D, p.I, p.E];
    }
    if (!own) return null;
    const m: Matrix = localizedMatrix(L).calculate(own, row.inputs.sex === "f" ? "f" : "m");
    return [m.day, m.father_line, m.month, m.mother_line, m.year, m.descendants, m.mission, m.inheritance, m.center];
  } catch {
    return null;
  }
}
