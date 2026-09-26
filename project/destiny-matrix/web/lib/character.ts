import {
  forLocale as localizedCharacterTypes,
  type CharacterInteractionReading,
  type CharacterPositionKey,
  type CharacterReading,
  type CharacterRoleKey,
  type CharacterRoleReading,
  type CharacterRoleTemplate
} from "./characterTypes";
import {
  forLocale as localizedCombinationReading,
  type CombinationContextKey
} from "./combinationReading";
import {
  forLocale as localizedContent,
  type ArcanumContent,
  type CombinationContent
} from "./content";
import { D, DR } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import type { Matrix } from "./matrix";
import { forLocale as localizedRoleContent } from "./roleContent";

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

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { arcanumContent, combinationContent } = localizedContent(L);
  const { buildCombinationContext } = localizedCombinationReading(L);
  const { CHARACTER_ROLE_META, buildCharacterConclusion, characterSlug } = localizedCharacterTypes(L);
  const { positionRoleTemplate } = localizedRoleContent(L);

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
      title: DR.characterLinks.abTitle[L],
      question: DR.characterLinks.abQuestion[L],
      context: "A-B",
    },
    {
      left: "B",
      right: "C",
      title: DR.characterLinks.bcTitle[L],
      question: DR.characterLinks.bcQuestion[L],
      context: "B-C",
    },
    {
      left: "A",
      right: "C",
      title: DR.characterLinks.acTitle[L],
      question: DR.characterLinks.acQuestion[L],
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
  function characterRoleTemplate(
    number: number,
    position: CharacterPositionKey,
  ): CharacterRoleTemplate {
    return positionRoleTemplate(number, position);
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
            ? DR.characterLinks.repeatAll[L](content.title)
            : DR.characterLinks.repeatSome[L](content.title, where),
          roles: roleKeys,
          paragraphs: [
            allThree
              ? DR.characterLinks.repeatAllText[L](left.arcanum)
              : DR.characterLinks.repeatSomeText[L](left.arcanum, where),
            `${contexts.join(" ")} ${content.repeat}`,
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
          ? DR.characterLinks.pairTwice[L](left.title, right.title)
          : first.title,
        roles: roleKeys,
        paragraphs: [
          ...(repeatedContext
            ? [DR.characterLinks.pairTwiceText[L](left.arcanum, right.arcanum)]
            : []),
          ...contextual.flatMap((context) => context.paragraphs),
          ...content.meaning,
        ],
        href: `/encyclopedia/combination/${key}`,
        linkLabel: DR.characterLinks.pairLink[L](key.replace("-", ` ${D.encArcanum.and[L]} `)),
      };
    });
  }

  function buildCharacterReading(matrix: Matrix): CharacterReading {
    const roleItems = roles(matrix);
    const [a, b, c] = roleItems;
    const slug = characterSlug(matrix);
    return {
      slug,
      title: DR.characterLinks.title[L](slug, a.title, b.title, c.title),
      lead: DR.characterLinks.lead[L],
      rolesTitle: DR.characterLinks.rolesTitle[L],
      rolesLead:
        DR.characterLinks.rolesLead[L],
      interactionsTitle: DR.characterLinks.interactionsTitle[L],
      interactionsLead:
        DR.characterLinks.interactionsLead[L],
      testId: "character-reading",
      roles: roleItems,
      interactions: interactionGroups(roleItems),
      ...buildCharacterConclusion(roleItems),
    };
  }
  return { characterRoleTemplate, buildCharacterReading };
});

// Compatibility for callers that explicitly use the deployment default.
export const { characterRoleTemplate, buildCharacterReading } = forLocale(defaultLocale);
