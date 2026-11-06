import { forLocale as matrixForLocale } from "@/lib/matrix";
import { computePair } from "@/lib/pair/engine";
import { pairUnits } from "@/lib/pair/corpus";
import { forLocale as sectionsForLocale } from "@/lib/sections";

// The automatic reading an individual request is written from: built here, where the
// interpretation corpus lives, and stored with the request.
export function personalSnapshot(birth: string, sex: string, L: "ru" | "en") {
  const matrix = matrixForLocale(L).calculate(birth, sex === "m" ? "m" : "f");
  const { build, withPositionArticles } = sectionsForLocale(L);
  return { matrix, sections: withPositionArticles(matrix, build(matrix, true)) };
}

export function pairSnapshot(a: string, b: string, L: "ru" | "en") {
  const matrix = computePair(a, b, L);
  return { matrix, units: pairUnits(L, matrix, { a, b }, true) };
}
