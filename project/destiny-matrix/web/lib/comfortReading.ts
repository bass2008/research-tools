import { DR, L } from "./i18n";
import type { Matrix } from "./matrix";
import type { ReadingConclusion, ReadingRole } from "./readingTypes";
import { cubeClause, withRepeat } from "./text";

export type ComfortPositionKey = "center" | "comfort_south" | "comfort_north";

/** Метаданные бесплатного раздела: их безопасно отдавать браузеру вместе с расчётом. */
export const COMFORT_ROLE_META: Record<
  ComfortPositionKey,
  { key: string; label: string; question: string }
> = {
  center: {
    key: "E",
    label: DR.comfort.centerLabel[L],
    question: DR.comfort.centerQuestion[L],
  },
  comfort_south: {
    key: "M",
    label: DR.comfort.reactionLabel[L],
    question: DR.comfort.reactionQuestion[L],
  },
  comfort_north: {
    key: "K",
    label: DR.comfort.talentLabel[L],
    question: DR.comfort.talentQuestion[L],
  },
};

export function comfortRoleMeta(position: string) {
  return COMFORT_ROLE_META[position as ComfortPositionKey] ?? null;
}

export function comfortHref(matrix: Matrix): string {
  return `/encyclopedia/comfort/${matrix.center}-${matrix.comfort_south}-${matrix.comfort_north}`;
}

export function repeatedSummary(items: ReadingRole[]): string | null {
  const unique = new Set(items.map((role) => role.arcanum));
  const slug = items.map((role) => role.arcanum).join("–");
  if (unique.size === 1) {
    return DR.comfort.sameAll[L](slug);
  }
  if (unique.size < items.length) {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(item.arcanum, (counts.get(item.arcanum) ?? 0) + 1);
    const [number, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const repeated = items.find((role) => role.arcanum === number)!;
    const contrast = items.find((role) => role.arcanum !== number);
    return DR.comfort.repeated[L](
      slug,
      repeated.title,
      count,
      contrast ? DR.comfort.contrastWith[L](contrast.title) : DR.comfort.contrastNone[L],
    );
  }
  return null;
}

export function buildComfortConclusion(items: ReadingRole[]): ReadingConclusion {
  const [first, middle, last] = items;
  if (!first || !middle || !last) throw new Error("[comfort-reading] нужны три роли");
  return {
    summary: withRepeat(
      DR.comfort.summary[L](
        first.arcanum, middle.arcanum, last.arcanum, first.title, middle.title, last.title,
      ),
      repeatedSummary(items),
    ),
    strength:
      DR.comfort.strength[L](cubeClause(first.strength), middle.strength, last.strength),
    tension:
      DR.comfort.tension[L](cubeClause(first.risk), middle.risk, last.risk),
    practice:
      DR.comfort.practice[L](last.action),
  };
}
