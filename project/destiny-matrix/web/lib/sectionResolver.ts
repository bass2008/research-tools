import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedPublicLabels } from "./i18n/publicLabels";
import type { Matrix } from "./matrix";

export interface SectionPositionDefinition {
  label?: string;
  selector?: string;
  expand?: string;
  position_key: string;
}

export type ResolvedSectionPosition = [label: string, arcanum: number, positionKey: string];

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { ageScaleLabel, chakraPhysicsLabel } = localizedPublicLabels(L);

  function selectorValue(matrix: Matrix, selector: string): number {
    const values: Record<string, number> = {
      A: matrix.day,
      B: matrix.month,
      C: matrix.year,
      D: matrix.mission,
      E: matrix.center,
      F: matrix.father_line,
      G: matrix.mother_line,
      H: matrix.descendants,
      I: matrix.inheritance,
      J: matrix.comfort_west,
      K: matrix.comfort_north,
      L: matrix.comfort_east,
      M: matrix.comfort_south,
      N: matrix.karmic_tail[1],
      P: matrix.talent[1],
      R: matrix.money[2],
      R1: matrix.love[1],
      R2: matrix.money[1],
      "reduce(C+D)": matrix.chakras[6].emotions,
      "reduce(L+M)": matrix.chakras[5].emotions,
      "sky.total": matrix.sky[2],
      "ground.total": matrix.ground[2],
      "social_male.total": matrix.social_male[2],
      "social_female.total": matrix.social_female[2],
      harmony: matrix.harmony,
      planetary: matrix.planetary,
      purpose_personal: matrix.purpose_personal,
      purpose_social: matrix.purpose_social,
      "chakra_totals.physics": matrix.chakra_totals.physics,
      "chakra_totals.energy": matrix.chakra_totals.energy,
      "chakra_totals.emotions": matrix.chakra_totals.emotions,
    };
    const value = values[selector];
    if (value === undefined) throw new Error(`неизвестный селектор раздела: ${selector}`);
    return value;
  }

  function resolveSectionPositions(
    rows: readonly SectionPositionDefinition[],
    matrix: Matrix,
  ): ResolvedSectionPosition[] {
    const result: ResolvedSectionPosition[] = [];
    for (const row of rows) {
      if (!row.position_key) throw new Error("позиция раздела без position_key");
      if (row.expand === "chakra_physics") {
        result.push(
          ...matrix.chakras.map(
            (chakra) =>
              [chakraPhysicsLabel(chakra.title), chakra.physics, row.position_key] as ResolvedSectionPosition,
          ),
        );
        continue;
      }
      if (row.expand === "age_scale") {
        result.push(
          ...matrix.age_scale.map(
            (period) =>
              [ageScaleLabel(period.from, period.to), period.arcanum, row.position_key] as ResolvedSectionPosition,
          ),
        );
        continue;
      }
      if (row.expand) throw new Error(`неизвестное разворачивание раздела: ${row.expand}`);
      if (!row.label || !row.selector) throw new Error("позиция раздела без label или selector");
      result.push([row.label, selectorValue(matrix, row.selector), row.position_key]);
    }
    return result;
  }

  function positionKeys(rows: readonly SectionPositionDefinition[]): string[] {
    return [...new Set(rows.map((row) => row.position_key))];
  }
  return { resolveSectionPositions, positionKeys };
});

// Compatibility for callers that explicitly use the deployment default.
export const { resolveSectionPositions, positionKeys } = forLocale(defaultLocale);
