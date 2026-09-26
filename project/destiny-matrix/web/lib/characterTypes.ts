import { DR } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import type { Matrix } from "./matrix";
import type {
  LongformReading,
  ReadingConclusion,
  ReadingInteraction,
  ReadingRole,
  ReadingRoleParts,
  ReadingRoleTemplate,
} from "./readingTypes";

export type CharacterRoleKey = "A" | "B" | "C";

export type CharacterPositionKey = "day" | "month" | "year";

export interface CharacterRoleParts extends ReadingRoleParts { }

export interface CharacterRoleTemplate extends ReadingRoleTemplate { }

export interface CharacterRoleReading extends ReadingRole {
  key: CharacterRoleKey;
}

export interface CharacterInteractionReading extends ReadingInteraction {
  roles: CharacterRoleKey[];
}

export interface CharacterConclusionReading extends ReadingConclusion { }

export interface CharacterReading extends LongformReading {
  roles: CharacterRoleReading[];
  interactions: CharacterInteractionReading[];
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {

  const CHARACTER_ROLE_META: Record<
    CharacterPositionKey,
    { key: CharacterRoleKey; label: string; question: string }
  > = {
    day: {
      key: "A",
      label: DR.characterReading.roleDay[L],
      question: DR.characterReading.roleDayQuestion[L],
    },
    month: {
      key: "B",
      label: DR.characterReading.roleMonth[L],
      question: DR.characterReading.roleMonthQuestion[L],
    },
    year: {
      key: "C",
      label: DR.characterReading.roleYear[L],
      question: DR.characterReading.roleYearQuestion[L],
    },
  };

  function summary(items: CharacterRoleReading[]): string {
    const [a, b, c] = items;
    if (!a || !b || !c) throw new Error("[character] для итога нужны роли A, B и C");
    const unique = new Set(items.map((role) => role.arcanum));
    if (unique.size === 1) {
      return DR.characterReading.summaryOne[L](a.arcanum, b.arcanum, c.arcanum, a.title);
    }
    if (unique.size === 2) {
      const repeated = items.find(
        (role) => items.filter((candidate) => candidate.arcanum === role.arcanum).length === 2,
      )!;
      const single = items.find((role) => role.arcanum !== repeated.arcanum)!;
      return DR.characterReading.summaryTwo[L](
        a.arcanum, b.arcanum, c.arcanum, repeated.title, single.title,
      );
    }
    return DR.characterReading.summaryThree[L](
      a.arcanum, b.arcanum, c.arcanum, a.title, b.title, c.title,
    );
  }

  /** Один и тот же компактный итог используют бесплатный отчёт, PDF и полная статья. */
  function buildCharacterConclusion(
    items: CharacterRoleReading[],
  ): CharacterConclusionReading {
    const [a, b, c] = items;
    if (!a || !b || !c) throw new Error("[character] для итога нужны роли A, B и C");
    return {
      summary: summary(items),
      strength: DR.characterReading.strength[L](a.strength, b.strength, c.strength),
      tension: DR.characterReading.tension[L](a.risk, b.risk, c.risk),
      practice: DR.characterReading.practice[L](c.strength),
    };
  }

  function characterSlug(matrix: Pick<Matrix, "day" | "month" | "year">): string {
    return `${matrix.day}-${matrix.month}-${matrix.year}`;
  }

  function characterHref(matrix: Pick<Matrix, "day" | "month" | "year">): string {
    return `/encyclopedia/character/${characterSlug(matrix)}`;
  }
  return { CHARACTER_ROLE_META, buildCharacterConclusion, characterSlug, characterHref };
});

// Compatibility for callers that explicitly use the deployment default.
export const { CHARACTER_ROLE_META, buildCharacterConclusion, characterSlug, characterHref } = forLocale(defaultLocale);
