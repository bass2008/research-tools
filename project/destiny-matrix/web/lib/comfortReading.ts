import type { Matrix } from "./matrix";
import type { ReadingConclusion, ReadingRole } from "./readingTypes";
import { withRepeat } from "./text";

export type ComfortPositionKey = "center" | "comfort_south" | "comfort_north";

/** Метаданные бесплатного раздела: их безопасно отдавать браузеру вместе с расчётом. */
export const COMFORT_ROLE_META: Record<
  ComfortPositionKey,
  { key: string; label: string; question: string }
> = {
  center: {
    key: "E",
    label: "Базовое состояние",
    question: "В каком состоянии человеку проще чувствовать себя собой и сохранять опору",
  },
  comfort_south: {
    key: "M",
    label: "Автоматическая реакция",
    question: "Что включается первым в отношениях, напряжении и знакомых повторяющихся сюжетах",
  },
  comfort_north: {
    key: "K",
    label: "Талант, возвращающий управление",
    question: "Какое качество помогает выйти из автоматической реакции и снова действовать осознанно",
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
    return `В последовательности ${slug} один аркан проходит через все роли раздела. Это делает тему цельной и заметной, но особенно усиливает риск действовать одним способом там, где вопросы у точек разные.`;
  }
  if (unique.size < items.length) {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(item.arcanum, (counts.get(item.arcanum) ?? 0) + 1);
    const [number, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const repeated = items.find((role) => role.arcanum === number)!;
    const contrast = items.find((role) => role.arcanum !== number);
    return `В последовательности ${slug} тема ${repeated.title} звучит ${count} раза и становится привычным способом проходить раздел. ${contrast ? `${contrast.title} показывает место, где этот способ нужно дополнить другим качеством, а не повторить ещё раз.` : "Роли всё равно отвечают на разные вопросы и не сливаются в одну."}`;
  }
  return null;
}

export function buildComfortConclusion(items: ReadingRole[]): ReadingConclusion {
  const [first, middle, last] = items;
  if (!first || !middle || !last) throw new Error("[comfort-reading] нужны три роли");
  return {
    summary: withRepeat(
      `Тройка ${first.arcanum}–${middle.arcanum}–${last.arcanum} описывает внутренний цикл: ${first.title} задаёт базовое состояние, ${middle.title} включается как первая реакция, а ${last.title} показывает качество, через которое проще вернуть управление.`,
      repeatedSummary(items),
    ),
    strength:
      `Опора тройки появляется, когда в базовом состоянии человек ${first.strength}, ` +
      `в первой реакции ${middle.strength}, а для возвращения к себе ${last.strength}.`,
    tension:
      `Цикл уводит от центра, когда человек ${first.risk}; затем автоматически ${middle.risk}; ` +
      `а попытка восстановиться закрепляет перекос, если он ${last.risk}. Эти признаки полезно проверять по одной реальной ситуации, а не принимать за постоянные качества.`,
    practice:
      `При следующей сильной реакции сделайте короткую паузу и назовите три вещи: что было моей опорой до события, что я сделал автоматически и какое действие позиции K вернёт управление. ` +
      `Начните с подсказки: ${last.action}`,
  };
}
