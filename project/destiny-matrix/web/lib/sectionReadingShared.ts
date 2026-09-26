import { forLocale as localizedComfortReading } from "./comfortReading";
import { D, DR } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import type { Matrix } from "./matrix";
import type { ReadingConclusion, ReadingRole } from "./readingTypes";
import { readingRoleReference } from "./readingRoleLabel";
import { forLocale as localizedText } from "./text";

export const PERSONAL_SECTION_KEYS = [
  "comfort",
  "profession",
  "realisation",
  "karma40",
  "resources",
  "family_gifts",
  "soul_tasks",
  "purpose",
  "money",
  "money40",
  "relations",
  "parents_children",
  "ancestry",
  "body_resource",
  "chakras",
  "rest",
  "loops",
  "years",
] as const;

export type PersonalSectionKey = (typeof PERSONAL_SECTION_KEYS)[number];

export interface SectionRoleDefinition {
  key: string;
  label: string;
  question: string;
  position: string;
  value: (matrix: Matrix) => number;
  variant?: string;
  /**
   * Роль читает ту же позицию корпуса, что и названная здесь, но другим модификатором. Когда
   * формула даёт им один аркан, все четыре кубика совпадают дословно — разбор печатает отсылку
   * вместо второй копии. Признак задан явно: структурно эту пару не отличить от «физика уровня»
   * и «итог физики», где одинаковый аркан означает разные сущности, а не повтор текста.
   */
  pairedWith?: string;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { buildComfortConclusion, comfortHref, repeatedSummary, COMFORT_ROLE_META } = localizedComfortReading(L);
  const { cubeClause, withRepeat } = localizedText(L);

  /** Безопасные для браузера метаданные ролей; полный корпус трактовок сюда не импортируется. */
  const SECTION_ROLES: Record<PersonalSectionKey, SectionRoleDefinition[]> = {
    comfort: [
      {
        ...COMFORT_ROLE_META.center,
        position: "center",
        value: (matrix) => matrix.center,
      },
      {
        ...COMFORT_ROLE_META.comfort_south,
        position: "comfort_south",
        value: (matrix) => matrix.comfort_south,
      },
      {
        ...COMFORT_ROLE_META.comfort_north,
        position: "comfort_north",
        value: (matrix) => matrix.comfort_north,
      },
    ],
    profession: [
      {
        key: "B",
        label: DR.sectionRoles.profession["B"].label[L],
        question: DR.sectionRoles.profession["B"].question[L],
        position: "month",
        value: (matrix) => matrix.talent[0],
      },
      {
        key: "P",
        label: DR.sectionRoles.profession["P"].label[L],
        question: DR.sectionRoles.profession["P"].question[L],
        position: "profession",
        value: (matrix) => matrix.talent[1],
      },
      {
        key: "K",
        label: DR.sectionRoles.profession["K"].label[L],
        question: DR.sectionRoles.profession["K"].question[L],
        position: "comfort_north",
        value: (matrix) => matrix.talent[2],
      },
    ],
    realisation: [
      { key: "D", label: DR.sectionRoles.realisation["D"].label[L], question: DR.sectionRoles.realisation["D"].question[L], position: "mission", value: (matrix) => matrix.mission },
      { key: "personal", label: DR.sectionRoles.realisation["personal"].label[L], question: DR.sectionRoles.realisation["personal"].question[L], position: "purpose_personal", variant: "growth_personal", value: (matrix) => matrix.purpose_personal },
      { key: "social", label: DR.sectionRoles.realisation["social"].label[L], question: DR.sectionRoles.realisation["social"].question[L], position: "purpose_social", variant: "growth_social", value: (matrix) => matrix.purpose_social },
    ],
    karma40: [
      { key: "I", label: DR.sectionRoles.karma40["I"].label[L], question: DR.sectionRoles.karma40["I"].question[L], position: "inheritance", value: (matrix) => matrix.inheritance },
      { key: "J", label: DR.sectionRoles.karma40["J"].label[L], question: DR.sectionRoles.karma40["J"].question[L], position: "comfort_west", value: (matrix) => matrix.comfort_west },
    ],
    resources: [
      { key: "L", label: DR.sectionRoles.resources["L"].label[L], question: DR.sectionRoles.resources["L"].question[L], position: "comfort_east", value: (matrix) => matrix.comfort_east },
      { key: "R2", label: DR.sectionRoles.resources["R2"].label[L], question: DR.sectionRoles.resources["R2"].question[L], position: "resources", variant: "resource_direction", value: (matrix) => matrix.money[1] },
    ],
    family_gifts: [
      { key: "F", label: DR.sectionRoles.family_gifts["F"].label[L], question: DR.sectionRoles.family_gifts["F"].question[L], position: "father_line", value: (matrix) => matrix.father_line },
      { key: "G", label: DR.sectionRoles.family_gifts["G"].label[L], question: DR.sectionRoles.family_gifts["G"].question[L], position: "mother_line", value: (matrix) => matrix.mother_line },
      { key: "total_m", label: DR.sectionRoles.family_gifts["total_m"].label[L], question: DR.sectionRoles.family_gifts["total_m"].question[L], position: "family_gifts", variant: "family_male_gift", value: (matrix) => matrix.social_male[2] },
      { key: "total_f", label: DR.sectionRoles.family_gifts["total_f"].label[L], question: DR.sectionRoles.family_gifts["total_f"].question[L], position: "family_gifts", variant: "family_female_gift", pairedWith: "total_m", value: (matrix) => matrix.social_female[2] },
    ],
    soul_tasks: [
      { key: "B", label: DR.sectionRoles.soul_tasks["B"].label[L], question: DR.sectionRoles.soul_tasks["B"].question[L], position: "month", value: (matrix) => matrix.month },
      { key: "D", label: DR.sectionRoles.soul_tasks["D"].label[L], question: DR.sectionRoles.soul_tasks["D"].question[L], position: "mission", value: (matrix) => matrix.mission },
      { key: "sky_total", label: DR.sectionRoles.soul_tasks["sky_total"].label[L], question: DR.sectionRoles.soul_tasks["sky_total"].question[L], position: "soul_tasks", variant: "sky_total", value: (matrix) => matrix.sky[2] },
    ],
    purpose: [
      { key: "personal", label: DR.sectionRoles.purpose["personal"].label[L], question: DR.sectionRoles.purpose["personal"].question[L], position: "purpose_personal", value: (matrix) => matrix.purpose_personal },
      { key: "social", label: DR.sectionRoles.purpose["social"].label[L], question: DR.sectionRoles.purpose["social"].question[L], position: "purpose_social", value: (matrix) => matrix.purpose_social },
      { key: "spiritual", label: DR.sectionRoles.purpose["spiritual"].label[L], question: DR.sectionRoles.purpose["spiritual"].question[L], position: "harmony", value: (matrix) => matrix.harmony },
      { key: "planetary", label: DR.sectionRoles.purpose["planetary"].label[L], question: DR.sectionRoles.purpose["planetary"].question[L], position: "planetary", value: (matrix) => matrix.planetary },
    ],
    money: [
      { key: "L", label: DR.sectionRoles.money["L"].label[L], question: DR.sectionRoles.money["L"].question[L], position: "comfort_east", value: (matrix) => matrix.comfort_east },
      { key: "R2", label: DR.sectionRoles.money["R2"].label[L], question: DR.sectionRoles.money["R2"].question[L], position: "resources", variant: "resource_direction", value: (matrix) => matrix.money[1] },
      { key: "R", label: DR.sectionRoles.money["R"].label[L], question: DR.sectionRoles.money["R"].question[L], position: "money", variant: "money_choice", value: (matrix) => matrix.money[2] },
      { key: "ground_total", label: DR.sectionRoles.money["ground_total"].label[L], question: DR.sectionRoles.money["ground_total"].question[L], position: "money", variant: "ground_total", pairedWith: "R", value: (matrix) => matrix.ground[2] },
    ],
    money40: [
      { key: "R2", label: DR.sectionRoles.money40["R2"].label[L], question: DR.sectionRoles.money40["R2"].question[L], position: "money40", variant: "money_mature", value: (matrix) => matrix.money[1] },
      { key: "L", label: DR.sectionRoles.money40["L"].label[L], question: DR.sectionRoles.money40["L"].question[L], position: "comfort_east", variant: "money_entry_mature", value: (matrix) => matrix.comfort_east },
    ],
    relations: [
      { key: "M", label: DR.sectionRoles.relations["M"].label[L], question: DR.sectionRoles.relations["M"].question[L], position: "comfort_south", value: (matrix) => matrix.comfort_south },
      { key: "R1", label: DR.sectionRoles.relations["R1"].label[L], question: DR.sectionRoles.relations["R1"].question[L], position: "relations", variant: "relation_knot", value: (matrix) => matrix.love[1] },
      { key: "R", label: DR.sectionRoles.relations["R"].label[L], question: DR.sectionRoles.relations["R"].question[L], position: "relations", variant: "relation_form", pairedWith: "R1", value: (matrix) => matrix.love[2] },
      { key: "K", label: DR.sectionRoles.relations["K"].label[L], question: DR.sectionRoles.relations["K"].question[L], position: "comfort_north", value: (matrix) => matrix.comfort_north },
    ],
    parents_children: [
      { key: "F", label: DR.sectionRoles.parents_children["F"].label[L], question: DR.sectionRoles.parents_children["F"].question[L], position: "father_line", value: (matrix) => matrix.father_line },
      { key: "G", label: DR.sectionRoles.parents_children["G"].label[L], question: DR.sectionRoles.parents_children["G"].question[L], position: "mother_line", value: (matrix) => matrix.mother_line },
      { key: "H", label: DR.sectionRoles.parents_children["H"].label[L], question: DR.sectionRoles.parents_children["H"].question[L], position: "descendants", value: (matrix) => matrix.descendants },
    ],
    ancestry: [
      { key: "I", label: DR.sectionRoles.ancestry["I"].label[L], question: DR.sectionRoles.ancestry["I"].question[L], position: "inheritance", value: (matrix) => matrix.inheritance },
      { key: "task_m", label: DR.sectionRoles.ancestry["task_m"].label[L], question: DR.sectionRoles.ancestry["task_m"].question[L], position: "ancestry", variant: "ancestry_male_task", value: (matrix) => matrix.social_male[2] },
      { key: "task_f", label: DR.sectionRoles.ancestry["task_f"].label[L], question: DR.sectionRoles.ancestry["task_f"].question[L], position: "ancestry", variant: "ancestry_female_task", pairedWith: "task_m", value: (matrix) => matrix.social_female[2] },
      { key: "planetary", label: DR.sectionRoles.ancestry["planetary"].label[L], question: DR.sectionRoles.ancestry["planetary"].question[L], position: "planetary", value: (matrix) => matrix.planetary },
    ],
    body_resource: [
      { key: "C", label: DR.sectionRoles.body_resource["C"].label[L], question: DR.sectionRoles.body_resource["C"].question[L], position: "year", value: (matrix) => matrix.year },
      { key: "D", label: DR.sectionRoles.body_resource["D"].label[L], question: DR.sectionRoles.body_resource["D"].question[L], position: "mission", value: (matrix) => matrix.mission },
      { key: "total", label: DR.sectionRoles.body_resource["total"].label[L], question: DR.sectionRoles.body_resource["total"].question[L], position: "body_resource", variant: "body_total", value: (matrix) => matrix.chakras[6].emotions },
    ],
    chakras: [
      ...([0, 1, 2, 3, 4, 5, 6] as const).map((index) => ({
        key: DR.sectionSummaries.chakraLevelKey[L](index + 1),
        label: DR.sectionSummaries.chakraLevelLabel[L](index + 1),
        question: DR.sectionSummaries.chakraLevelQuestion[L],
        position: "chakras",
        variant: "chakra_physics",
        value: (matrix: Matrix) => matrix.chakras[index].physics,
      })),
      { key: "physics_total", label: DR.sectionRoles.chakras["physics_total"].label[L], question: DR.sectionRoles.chakras["physics_total"].question[L], position: "chakras", variant: "chakra_physics_total", value: (matrix) => matrix.chakra_totals.physics },
      { key: "energy_total", label: DR.sectionRoles.chakras["energy_total"].label[L], question: DR.sectionRoles.chakras["energy_total"].question[L], position: "chakras", variant: "chakra_energy_total", value: (matrix) => matrix.chakra_totals.energy },
      { key: "emotions_total", label: DR.sectionRoles.chakras["emotions_total"].label[L], question: DR.sectionRoles.chakras["emotions_total"].question[L], position: "chakras", variant: "chakra_emotions_total", value: (matrix) => matrix.chakra_totals.emotions },
    ],
    rest: [
      { key: "joy", label: DR.sectionRoles.rest["joy"].label[L], question: DR.sectionRoles.rest["joy"].question[L], position: "rest", variant: "rest_result", value: (matrix) => matrix.chakras[5].emotions },
      { key: "E", label: DR.sectionRoles.rest["E"].label[L], question: DR.sectionRoles.rest["E"].question[L], position: "center", value: (matrix) => matrix.center },
    ],
    loops: [
      { key: "D", label: DR.sectionRoles.loops["D"].label[L], question: DR.sectionRoles.loops["D"].question[L], position: "mission", variant: "loop_root", value: (matrix) => matrix.mission },
      { key: "E", label: DR.sectionRoles.loops["E"].label[L], question: DR.sectionRoles.loops["E"].question[L], position: "center", variant: "loop_autopilot", value: (matrix) => matrix.center },
      { key: "spiritual", label: DR.sectionRoles.loops["spiritual"].label[L], question: DR.sectionRoles.loops["spiritual"].question[L], position: "harmony", value: (matrix) => matrix.harmony },
    ],
    years: ([0, 1, 2, 3, 4, 5, 6, 7] as const).map((index) => ({
      key: `${index * 10}–${index * 10 + 10}`,
      label: DR.sectionSummaries.decadeLabel[L](index * 10, index * 10 + 10),
      question: DR.sectionSummaries.decadeQuestion[L],
      position: "years",
      variant: "decade",
      value: (matrix: Matrix) => matrix.age_scale[index].arcanum,
    })),
  };

  function sectionRoleMeta(section: PersonalSectionKey, position: string) {
    const role = SECTION_ROLES[section].find((item) => item.position === position);
    return role ? { key: role.key, label: role.label, question: role.question } : null;
  }

  /**
   * Итог «Предназначения» должен называть, какой уровень уже проживается и где разрыв, а не
   * поручать это читателю. Из четырёх арканов выводимо ровно два факта, и оба предметные:
   * повтор аркана на двух уровнях значит, что тема уже несётся через масштаб, а соседняя пара
   * с разными арканами, ни один из которых больше нигде не встречается, — место разрыва.
   */
  function purposeReading(items: ReadingRole[]): { carried: ReadingRole[]; gap: [ReadingRole, ReadingRole] | null } {
    const counts = new Map<number, number>();
    for (const item of items) counts.set(item.arcanum, (counts.get(item.arcanum) ?? 0) + 1);
    const carried = items.filter((item) => (counts.get(item.arcanum) ?? 0) > 1);
    // Разрыв называется только относительно темы, которая реально несётся через уровни: без такой
    // темы «первая пара с разными арканами» — это любая пара, и текст выходил бы одинаковым на
    // 37 результатах из 42.
    const gap = carried.length
      ? items.slice(0, -1).reduce<[ReadingRole, ReadingRole] | null>((found, item, index) => {
        if (found) return found;
        const next = items[index + 1];
        const outside = (counts.get(item.arcanum) ?? 0) === 1 && (counts.get(next.arcanum) ?? 0) === 1;
        return outside ? [item, next] : null;
      }, null)
      : null;
    return { carried, gap };
  }

  function buildSectionConclusion(
    section: PersonalSectionKey,
    items: ReadingRole[],
  ): ReadingConclusion {
    const [first, middle] = items;
    const last = items.filter((item) => !item.sameAs).at(-1) ?? items.at(-1);
    if (!first || !middle || !last) throw new Error(`[section-reading] для ${section} нужны хотя бы две роли`);
    const repeated = repeatedSummary(items);
    if (section === "comfort") {
      return buildComfortConclusion(items);
    }
    if (section === "profession") return {
      summary: withRepeat(
        DR.professionLine.summary[L](
          first.arcanum, middle.arcanum, last.arcanum, first.title, middle.title, last.title,
        ),
        repeated,
      ),
      strength:
        DR.professionLine.strength[L](
          cubeClause(first.strength), middle.strength, cubeClause(last.strength),
        ),
      tension:
        DR.professionLine.tension[L](
          cubeClause(first.risk), cubeClause(middle.risk), cubeClause(last.risk),
        ),
      practice:
        DR.professionLine.practice[L](middle.action),
    };

    // Роль-повтор (`sameAs`) читает ту же позицию и тот же аркан, что названная выше: в итоге
    // она давала вторую дословную копию — «дар мужской ветви: X; дар женской ветви: X».
    const unique = items.filter((item) => !item.sameAs);
    if (section === "purpose") {
      const { carried, gap } = purposeReading(items);
      const ladder = items.map((item) => `${item.label.toLowerCase()} — ${item.title}`).join(", ");
      return {
        summary: withRepeat(
          DR.purposeLadder.summary[L](ladder),
          repeated,
        ),
        strength: carried.length
          ? DR.purposeLadder.carried[L](
            carried[0].title,
            carried.map((item) => D.common.quoted[L](item.label.toLowerCase())).join(` ${D.encArcanum.and[L]} `),
          )
          : DR.purposeLadder.noCarried[L](items[0].label.toLowerCase(), items[0].title),
        tension: gap
          ? DR.purposeLadder.gap[L](
            gap[0].label.toLowerCase(), gap[1].label.toLowerCase(), gap[0].title, gap[1].title,
          )
          : carried.length
            ? DR.purposeLadder.noGap[L]
            : DR.purposeLadder.eachLevel[L](
              items.map((item) => `${item.label.toLowerCase()} — ${item.title}`).join(", "),
            ),
        practice: gap
          ? DR.purposeLadder.practiceGap[L](
            gap[0].label.toLowerCase(), gap[1].label.toLowerCase(), last.action,
          )
          : DR.purposeLadder.practicePlain[L](last.action),
      };
    }

    const labels = items.map((item) => `${readingRoleReference(item)} — ${item.title}`).join(", ");
    const strength = unique.map((item) => `${item.label.toLowerCase()} — ${cubeClause(item.strength)}`).join("; ");
    const risks = unique.map((item) => `${item.label.toLowerCase()} — ${cubeClause(item.risk)}`).join("; ");
    const summaries: Partial<Record<PersonalSectionKey, (labels: string) => string>> = {
      realisation: DR.sectionSummaries.summary.realisation[L],
      karma40: DR.sectionSummaries.summary.karma40[L],
      resources: DR.sectionSummaries.summary.resources[L],
      family_gifts: DR.sectionSummaries.summary.family_gifts[L],
      soul_tasks: DR.sectionSummaries.summary.soul_tasks[L],
      purpose: DR.sectionSummaries.summary.purpose[L],
      money: DR.sectionSummaries.summary.money[L],
      money40: DR.sectionSummaries.summary.money40[L],
      relations: DR.sectionSummaries.summary.relations[L],
      parents_children: DR.sectionSummaries.summary.parents_children[L],
      ancestry: DR.sectionSummaries.summary.ancestry[L],
      body_resource: DR.sectionSummaries.summary.body_resource[L],
      rest: DR.sectionSummaries.summary.rest[L],
      loops: DR.sectionSummaries.summary.loops[L],
    };
    const practices: Partial<Record<PersonalSectionKey, (action: string) => string>> = {
      realisation: DR.sectionSummaries.practice.realisation[L],
      karma40: DR.sectionSummaries.practice.karma40[L],
      resources: DR.sectionSummaries.practice.resources[L],
      family_gifts: DR.sectionSummaries.practice.family_gifts[L],
      soul_tasks: DR.sectionSummaries.practice.soul_tasks[L],
      purpose: DR.sectionSummaries.practice.purpose[L],
      money: DR.sectionSummaries.practice.money[L],
      money40: DR.sectionSummaries.practice.money40[L],
      relations: DR.sectionSummaries.practice.relations[L],
      parents_children: DR.sectionSummaries.practice.parents_children[L],
      ancestry: DR.sectionSummaries.practice.ancestry[L],
      body_resource: DR.sectionSummaries.practice.body_resource[L],
      rest: DR.sectionSummaries.practice.rest[L],
      loops: DR.sectionSummaries.practice.loops[L],
    };
    return {
      summary: withRepeat(
        (summaries[section] ?? DR.sectionSummaries.summary.fallback[L])(labels),
        repeated,
      ),
      strength: DR.sectionSummaries.strengthLine[L](strength),
      tension: DR.sectionSummaries.tensionLine[L](risks),
      practice: (practices[section] ?? DR.sectionSummaries.practice.fallback[L])(last.action),
    };
  }

  function sectionReadingSlug(section: PersonalSectionKey, matrix: Matrix): string {
    if (section === "chakras") {
      return [
        ...matrix.chakras.flatMap((row) => [row.physics, row.energy, row.emotions]),
        matrix.chakra_totals.physics,
        matrix.chakra_totals.energy,
        matrix.chakra_totals.emotions,
      ].join("-");
    }
    return SECTION_ROLES[section].map((role) => role.value(matrix)).join("-");
  }

  function sectionReadingHref(section: PersonalSectionKey, matrix: Matrix): string {
    if (section === "comfort") return comfortHref(matrix);
    const path = `/encyclopedia/${section}/${sectionReadingSlug(section, matrix)}`;
    if (section === "years") return `${path}?birth=${matrix.birth}`;
    return path;
  }
  return { PERSONAL_SECTION_KEYS, SECTION_ROLES, sectionRoleMeta, buildSectionConclusion, sectionReadingSlug, sectionReadingHref };
});

// Compatibility for callers that explicitly use the deployment default.
export const { SECTION_ROLES, sectionRoleMeta, buildSectionConclusion, sectionReadingSlug, sectionReadingHref } = forLocale(defaultLocale);
