import {
  arcanumContent,
  combinationContent,
  type ArcanumContent,
  type CombinationContent,
} from "./content";
import type { Matrix } from "./matrix";
import {
  buildCombinationContext,
  type CombinationContextKey,
} from "./combinationReading";
import {
  CHARACTER_ROLE_META,
  buildCharacterConclusion,
  characterSlug,
  type CharacterInteractionReading,
  type CharacterPositionKey,
  type CharacterReading,
  type CharacterRoleKey,
  type CharacterRoleReading,
  type CharacterRoleTemplate,
} from "./characterTypes";

interface RoleDefinition {
  position: CharacterPositionKey;
  value: (matrix: Matrix) => number;
}

interface EdgeDefinition {
  left: CharacterRoleKey;
  right: CharacterRoleKey;
  title: string;
  question: string;
  context: CombinationContextKey;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    position: "day",
    value: (matrix) => matrix.day,
  },
  {
    position: "month",
    value: (matrix) => matrix.month,
  },
  {
    position: "year",
    value: (matrix) => matrix.year,
  },
];

const EDGES: EdgeDefinition[] = [
  {
    left: "A",
    right: "B",
    title: "Внешний образ и внутренняя задача",
    question: "Эта связь показывает, совпадает ли первое впечатление с тем, что движет человеком изнутри.",
    context: "A-B",
  },
  {
    left: "B",
    right: "C",
    title: "От внутреннего качества к поступку",
    question: "Эта связь показывает, насколько естественно внутренняя задача превращается в практическое действие.",
    context: "B-C",
  },
  {
    left: "A",
    right: "C",
    title: "Обещание образа и реальное поведение",
    question: "Эта связь сверяет то, чего люди ждут по первому впечатлению, с тем, как человек действует на деле.",
    context: "A-C",
  },
];

const ARCANA = new Map<number, ArcanumContent>();
const PAIRS = new Map<string, CombinationContent>();

function arcana(number: number): ArcanumContent {
  const cached = ARCANA.get(number);
  if (cached) return cached;
  const value = arcanumContent(number);
  if (!value) throw new Error(`[character] нет аркана ${number}`);
  ARCANA.set(number, value);
  return value;
}

/**
 * Готовый позиционный абзац уже содержит четыре нужных кубика. Выделяем их без написания
 * второго корпуса: роль берётся из первого предложения, действие — из последнего, а сила и риск
 * остаются каноническими plus/minus аркана.
 */
export function characterRoleTemplate(
  number: number,
  position: CharacterPositionKey,
): CharacterRoleTemplate {
  const content = arcana(number);
  const text = content.inPositions[position];
  if (!text) throw new Error(`[character] нет текста ${position}:${number}`);
  const sentences = text.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length < 3) {
    throw new Error(`[character] текст ${position}:${number} не делится на суть, проявления и действие`);
  }
  const essence = sentences[0].replace(/^Аркан «[^»]+» · [ABC] ·\s*/, "");
  const action = sentences.at(-1)!;
  return {
    title: content.title,
    essence,
    strength: content.plus[0],
    risk: content.minus[0],
    action,
  };
}

function pair(a: number, b: number): CombinationContent {
  const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
  const cached = PAIRS.get(key);
  if (cached) return cached;
  const value = combinationContent(key);
  if (!value) throw new Error(`[character] нет сочетания ${key}`);
  PAIRS.set(key, value);
  return value;
}

function roles(matrix: Matrix): CharacterRoleReading[] {
  return ROLE_DEFINITIONS.map((definition) => {
    const arcanum = definition.value(matrix);
    const meta = CHARACTER_ROLE_META[definition.position];
    return {
      key: meta.key,
      label: meta.label,
      question: meta.question,
      arcanum,
      ...characterRoleTemplate(arcanum, definition.position),
    };
  });
}

function pairKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

function interactionGroups(items: CharacterRoleReading[]): CharacterInteractionReading[] {
  const byRole = new Map(items.map((role) => [role.key, role]));
  const grouped = new Map<string, EdgeDefinition[]>();
  for (const edge of EDGES) {
    const left = byRole.get(edge.left)!;
    const right = byRole.get(edge.right)!;
    const key = pairKey(left.arcanum, right.arcanum);
    const current = grouped.get(key) ?? [];
    current.push(edge);
    grouped.set(key, current);
  }

  return [...grouped.entries()].map(([key, edges]) => {
    const first = edges[0];
    const left = byRole.get(first.left)!;
    const right = byRole.get(first.right)!;
    const roleKeys = [...new Set(edges.flatMap((edge) => [edge.left, edge.right]))];
    const contexts = edges.map((edge) => edge.question);

    if (left.arcanum === right.arcanum) {
      const content = arcana(left.arcanum);
      const where = roleKeys.join(", ");
      const allThree = roleKeys.length === 3;
      return {
        key,
        title: allThree
          ? `${content.title} во всех трёх ролях`
          : `${content.title} повторяется: позиции ${where}`,
        roles: roleKeys,
        paragraphs: [
          allThree
            ? `Один и тот же ${left.arcanum} аркан задаёт внешний образ, внутреннюю и материальную задачи. Характер получается собранным вокруг одной темы: разные части личности не спорят о направлении, но усиливают цену любого перекоса.`
            : `Один и тот же ${left.arcanum} аркан стоит в позициях ${where}. Повтор не добавляет второй независимый сюжет: он делает одну тему заметнее и переносит её сразу между несколькими слоями характера.`,
          `${contexts.join(" ")} В сильном проявлении человек ${content.plus[0]} и ${content.plus[1]}.`,
          `Цена усиления тоже двойная: в теневом проявлении человек ${content.minus[0]} или ${content.minus[1]}. Поэтому задача повтора — не делать одного и того же ещё больше, а вовремя менять способ действия.`,
        ],
      };
    }

    const content = pair(left.arcanum, right.arcanum);
    const repeatedContext = edges.length > 1;
    const contextual = edges.map((edge) => {
      const edgeLeft = byRole.get(edge.left)!;
      const edgeRight = byRole.get(edge.right)!;
      return buildCombinationContext(edgeLeft.arcanum, edgeRight.arcanum, edge.context);
    });
    return {
      key,
      title: repeatedContext
        ? `${left.title} и ${right.title} сразу в двух связях`
        : first.title,
      roles: roleKeys,
      paragraphs: [
        ...(repeatedContext
          ? [`Одна и та же пара ${left.arcanum}–${right.arcanum} связывает сразу несколько ролей. Общий сюжет пары читается один раз, а позиционные варианты ниже показывают каждый переход отдельно.`]
          : []),
        ...contextual.flatMap((context) => context.paragraphs),
        ...content.meaning,
      ],
      href: `/encyclopedia/combination/${key}`,
      linkLabel: `Подробнее про сочетание ${key.replace("-", " и ")} аркана в энциклопедии →`,
    };
  });
}

export function buildCharacterReading(matrix: Matrix): CharacterReading {
  const roleItems = roles(matrix);
  const [a, b, c] = roleItems;
  const slug = characterSlug(matrix);
  return {
    slug,
    title: `Характер ${slug}: ${a.title}, ${b.title} и ${c.title}`,
    lead: `Персональный разбор трёх исходных точек матрицы: A отвечает за портрет личности, B — за духовную задачу, C — за материальное проявление характера.`,
    roles: roleItems,
    interactions: interactionGroups(roleItems),
    ...buildCharacterConclusion(roleItems),
  };
}
