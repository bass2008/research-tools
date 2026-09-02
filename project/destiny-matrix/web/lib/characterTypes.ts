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

export interface CharacterRoleParts extends ReadingRoleParts {}

export interface CharacterRoleTemplate extends ReadingRoleTemplate {}

export interface CharacterRoleReading extends ReadingRole {
  key: CharacterRoleKey;
}

export interface CharacterInteractionReading extends ReadingInteraction {
  roles: CharacterRoleKey[];
}

export interface CharacterConclusionReading extends ReadingConclusion {}

export interface CharacterReading extends LongformReading {
  roles: CharacterRoleReading[];
  interactions: CharacterInteractionReading[];
}

export const CHARACTER_ROLE_META: Record<
  CharacterPositionKey,
  { key: CharacterRoleKey; label: string; question: string }
> = {
  day: {
    key: "A",
    label: "Портрет личности",
    question: "Как вас считывают люди и с чего вы начинаете контакт",
  },
  month: {
    key: "B",
    label: "Духовная задача",
    question: "Что включается изнутри и требует зрелого применения",
  },
  year: {
    key: "C",
    label: "Материальная задача",
    question: "Как внутреннее качество становится поступком и результатом",
  },
};

function summary(items: CharacterRoleReading[]): string {
  const [a, b, c] = items;
  if (!a || !b || !c) throw new Error("[character] для итога нужны роли A, B и C");
  const unique = new Set(items.map((role) => role.arcanum));
  if (unique.size === 1) {
    return `В тройке ${a.arcanum}–${b.arcanum}–${c.arcanum} одна тема проходит через весь характер. ${a.title} определяет и первое впечатление, и внутреннюю задачу, и способ действовать. Это даёт цельность, но требует особенно внимательно следить за теневой стороной аркана.`;
  }
  if (unique.size === 2) {
    const repeated = items.find(
      (role) => items.filter((candidate) => candidate.arcanum === role.arcanum).length === 2,
    )!;
    const single = items.find((role) => role.arcanum !== repeated.arcanum)!;
    return `В тройке ${a.arcanum}–${b.arcanum}–${c.arcanum} тема ${repeated.title} звучит дважды, поэтому она становится основной привычкой характера. ${single.title} не отменяет её, а показывает место, где привычный способ приходится дополнять другим качеством.`;
  }
  return `Тройка ${a.arcanum}–${b.arcanum}–${c.arcanum} соединяет три разные задачи: ${a.title} задаёт первое впечатление, ${b.title} работает изнутри, а ${c.title} проверяет характер поступками. Цельность здесь появляется не из одинаковых качеств, а из умения переводить одно в другое.`;
}

/** Один и тот же компактный итог используют бесплатный отчёт, PDF и полная статья. */
export function buildCharacterConclusion(
  items: CharacterRoleReading[],
): CharacterConclusionReading {
  const [a, b, c] = items;
  if (!a || !b || !c) throw new Error("[character] для итога нужны роли A, B и C");
  return {
    summary: summary(items),
    strength:
      `Главная сила тройки проявляется, когда человек одновременно ${a.strength}, ` +
      `${b.strength} и в практических решениях ${c.strength}. ` +
      `Тогда внешний образ не расходится с внутренним мотивом, а обещанное подтверждается поступком.`,
    tension:
      `На внешнем уровне риск выглядит так: человек ${a.risk}. ` +
      `Изнутри напряжение проявляется, когда человек ${b.risk}. ` +
      `В материальных решениях напряжение закрепляется, когда человек ${c.risk}. ` +
      `Это не три приговора, а три места, где один и тот же жизненный эпизод можно проверить по фактам.`,
    practice:
      `Возьмите одну повторяющуюся ситуацию ближайшей недели и ответьте письменно на три вопроса: ` +
      `какое впечатление я произвожу, чего на самом деле хочу и какой поступок это подтвердит. ` +
      `Начать лучше с сильной стороны позиции C: человек ${c.strength}. ` +
      `После действия сравните результат с первоначальным образом — так тройка становится рабочим наблюдением, а не набором ярлыков.`,
  };
}

export function characterSlug(matrix: Pick<Matrix, "day" | "month" | "year">): string {
  return `${matrix.day}-${matrix.month}-${matrix.year}`;
}

export function characterHref(matrix: Pick<Matrix, "day" | "month" | "year">): string {
  return `/encyclopedia/character/${characterSlug(matrix)}`;
}
