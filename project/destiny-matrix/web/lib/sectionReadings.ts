import {
  forLocale as localizedCombinationReading,
  type CombinationContextKey
} from "./combinationReading";
import {
  forLocale as localizedContent,
  type ArcanumContent,
  type MatrixItem
} from "./content";
import { D, DR } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedMatrix, type Matrix } from "./matrix";
import { forLocale as localizedPublicSpec } from "./publicSpec";
import { readingRoleReference } from "./readingRoleLabel";
import type {
  LongformReading,
  ReadingInteraction,
  ReadingRole,
  ReadingRoleTemplate,
} from "./readingTypes";
import { forLocale as localizedRoleContent } from "./roleContent";
import {
  forLocale as localizedSectionReadingShared,
  forLocale as localizedSectionReadingSharedView,
  type PersonalSectionKey,
  type SectionRoleDefinition
} from "./sectionReadingShared";
import { forLocale as localizedText } from "./text";

export {
  buildSectionConclusion,
  sectionReadingHref,
  sectionReadingSlug,
  sectionRoleMeta
} from "./sectionReadingShared";

export type { PersonalSectionKey } from "./sectionReadingShared";

interface EdgeDefinition {
  left: string;
  right: string;
  title: string;
  question: string;
  context?: CombinationContextKey;
  /** Связь печатается только когда добавляет смысл: см. `D↔социальное` в «Пути самореализации». */
  when?: (roles: ReadingRole[]) => boolean;
}

interface SynthesisDefinition {
  sources: string[];
  target: string;
  title: string;
  question: string;
}

interface ReadingDefinition {
  title: string;
  lead: string;
  rolesTitle: string;
  rolesLead: string;
  interactionsTitle: string;
  interactionsLead: string;
  roles: SectionRoleDefinition[];
  edges: EdgeDefinition[];
  syntheses?: SynthesisDefinition[];
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { arcanumContent, chakraContent, combinationContent, matrixItem, matrixSlugs, positionContent } = localizedContent(L);
  const { buildCombinationContext } = localizedCombinationReading(L);
  const { birthLabel, calculate } = localizedMatrix(L);
  const { ageFrameText, positionRoleTemplate, variantRoleTemplate } = localizedRoleContent(L);
  const { positionHref } = localizedPublicSpec(L);
  const { cubeClause, pairCubes, sentence } = localizedText(L);
  const { SECTION_ROLES, buildSectionConclusion, sectionReadingSlug, sectionReadingHref } = localizedSectionReadingShared(L);
  const { sectionRoleMeta } = localizedSectionReadingSharedView(L);

  const DEFINITIONS: Record<PersonalSectionKey, ReadingDefinition> = {

    comfort: {

      title: DR.sectionDefs.comfort.title[L],
      lead: DR.sectionDefs.comfort.lead[L],
      rolesTitle: DR.sectionDefs.comfort.rolesTitle[L],
      rolesLead: DR.sectionDefs.comfort.rolesLead[L],
      interactionsTitle: DR.sectionDefs.comfort.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.comfort.interactionsLead[L],
      roles: SECTION_ROLES.comfort,
      edges: [
        {
          left: "E",
          right: "M",
          title: DR.sectionDefs.comfort.edges["E|M"].title[L],
          question: DR.sectionDefs.comfort.edges["E|M"].question[L],
          context: "E-M",
        },
        {
          left: "E",
          right: "K",
          title: DR.sectionDefs.comfort.edges["E|K"].title[L],
          question: DR.sectionDefs.comfort.edges["E|K"].question[L],
          context: "E-K",
        },
        {
          left: "M",
          right: "K",
          title: DR.sectionDefs.comfort.edges["M|K"].title[L],
          question: DR.sectionDefs.comfort.edges["M|K"].question[L],
          context: "M-K",
        },
      ],
    },

    profession: {

      title: DR.sectionDefs.profession.title[L],
      lead: DR.sectionDefs.profession.lead[L],
      rolesTitle: DR.sectionDefs.profession.rolesTitle[L],
      rolesLead: DR.sectionDefs.profession.rolesLead[L],
      interactionsTitle: DR.sectionDefs.profession.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.profession.interactionsLead[L],
      roles: SECTION_ROLES.profession,
      edges: [
        {
          left: "B",
          right: "P",
          title: DR.sectionDefs.profession.edges["B|P"].title[L],
          question: DR.sectionDefs.profession.edges["B|P"].question[L],
          context: "B-P",
        },
        {
          left: "P",
          right: "K",
          title: DR.sectionDefs.profession.edges["P|K"].title[L],
          question: DR.sectionDefs.profession.edges["P|K"].question[L],
          context: "P-K",
        },
        {
          left: "B",
          right: "K",
          title: DR.sectionDefs.profession.edges["B|K"].title[L],
          question: DR.sectionDefs.profession.edges["B|K"].question[L],
          context: "B-K",
        },
      ],
    },

    realisation: {

      title: DR.sectionDefs.realisation.title[L],
      lead: DR.sectionDefs.realisation.lead[L],
      rolesTitle: DR.sectionDefs.realisation.rolesTitle[L],
      rolesLead: DR.sectionDefs.realisation.rolesLead[L],
      interactionsTitle: DR.sectionDefs.realisation.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.realisation.interactionsLead[L],
      roles: SECTION_ROLES.realisation,
      edges: [
        { left: "D", right: "personal", title: DR.sectionDefs.realisation.edges["D|personal"].title[L], question: DR.sectionDefs.realisation.edges["D|personal"].question[L] },
        { left: "personal", right: "social", title: DR.sectionDefs.realisation.edges["personal|social"].title[L], question: DR.sectionDefs.realisation.edges["personal|social"].question[L] },
        {
          left: "D",
          right: "social",
          title: DR.sectionDefs.realisation.edges["D|social"].title[L],
          question: DR.sectionDefs.realisation.edges["D|social"].question[L],
          // Проверка «не потерян ли исходный опыт» осмысленна, только если средний уровень не
          // повторяет ни один из краёв: иначе цепочка D→личное→социальное уже её содержит.
          when: (roles) => new Set(roles.map((role) => role.arcanum)).size === roles.length,
        },
      ],
    },

    karma40: {

      title: DR.sectionDefs.karma40.title[L],
      lead: DR.sectionDefs.karma40.lead[L],
      rolesTitle: DR.sectionDefs.karma40.rolesTitle[L],
      rolesLead: DR.sectionDefs.karma40.rolesLead[L],
      interactionsTitle: DR.sectionDefs.karma40.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.karma40.interactionsLead[L],
      roles: SECTION_ROLES.karma40,
      edges: [{ left: "I", right: "J", title: DR.sectionDefs.karma40.edges["I|J"].title[L], question: DR.sectionDefs.karma40.edges["I|J"].question[L] }],
    },

    resources: {

      // Название берётся из spec/sections.json: там «вам», и по нему построены крошка над статьёй
      // и заголовок раздела в отчёте. Расхождение было видно на одной странице сразу дважды.
      title: DR.sectionDefs.resources.title[L],
      lead: DR.sectionDefs.resources.lead[L],
      rolesTitle: DR.sectionDefs.resources.rolesTitle[L],
      rolesLead: DR.sectionDefs.resources.rolesLead[L],
      interactionsTitle: DR.sectionDefs.resources.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.resources.interactionsLead[L],
      roles: SECTION_ROLES.resources,
      edges: [{ left: "L", right: "R2", title: DR.sectionDefs.resources.edges["L|R2"].title[L], question: DR.sectionDefs.resources.edges["L|R2"].question[L] }],
    },

    family_gifts: {

      title: DR.sectionDefs.family_gifts.title[L],
      lead: DR.sectionDefs.family_gifts.lead[L],
      rolesTitle: DR.sectionDefs.family_gifts.rolesTitle[L],
      rolesLead: DR.sectionDefs.family_gifts.rolesLead[L],
      interactionsTitle: DR.sectionDefs.family_gifts.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.family_gifts.interactionsLead[L],
      roles: SECTION_ROLES.family_gifts,
      edges: [
        { left: "F", right: "total_m", title: DR.sectionDefs.family_gifts.edges["F|total_m"].title[L], question: DR.sectionDefs.family_gifts.edges["F|total_m"].question[L] },
        { left: "G", right: "total_f", title: DR.sectionDefs.family_gifts.edges["G|total_f"].title[L], question: DR.sectionDefs.family_gifts.edges["G|total_f"].question[L] },
        { left: "F", right: "G", title: DR.sectionDefs.family_gifts.edges["F|G"].title[L], question: DR.sectionDefs.family_gifts.edges["F|G"].question[L] },
        { left: "total_m", right: "total_f", title: DR.sectionDefs.family_gifts.edges["total_m|total_f"].title[L], question: DR.sectionDefs.family_gifts.edges["total_m|total_f"].question[L] },
      ],
    },

    soul_tasks: {

      title: DR.sectionDefs.soul_tasks.title[L],
      lead: DR.sectionDefs.soul_tasks.lead[L],
      rolesTitle: DR.sectionDefs.soul_tasks.rolesTitle[L],
      rolesLead: DR.sectionDefs.soul_tasks.rolesLead[L],
      interactionsTitle: DR.sectionDefs.soul_tasks.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.soul_tasks.interactionsLead[L],
      roles: SECTION_ROLES.soul_tasks,
      edges: [
        { left: "B", right: "D", title: DR.sectionDefs.soul_tasks.edges["B|D"].title[L], question: DR.sectionDefs.soul_tasks.edges["B|D"].question[L] },
      ],
      syntheses: [{
        sources: ["B", "D"],
        target: "sky_total",
        title: DR.sectionDefs.soul_tasks.syntheses["B, D|sky_total"].title[L],
        question: DR.sectionDefs.soul_tasks.syntheses["B, D|sky_total"].question[L],
      }],
    },

    purpose: {

      title: DR.sectionDefs.purpose.title[L],
      lead: DR.sectionDefs.purpose.lead[L],
      rolesTitle: DR.sectionDefs.purpose.rolesTitle[L],
      rolesLead: DR.sectionDefs.purpose.rolesLead[L],
      interactionsTitle: DR.sectionDefs.purpose.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.purpose.interactionsLead[L],
      roles: SECTION_ROLES.purpose,
      edges: [
        { left: "personal", right: "social", title: DR.sectionDefs.purpose.edges["personal|social"].title[L], question: DR.sectionDefs.purpose.edges["personal|social"].question[L] },
        { left: "spiritual", right: "planetary", title: DR.sectionDefs.purpose.edges["spiritual|planetary"].title[L], question: DR.sectionDefs.purpose.edges["spiritual|planetary"].question[L] },
      ],
      syntheses: [{
        sources: ["personal", "social"],
        target: "spiritual",
        title: DR.sectionDefs.purpose.syntheses["personal, social|spiritual"].title[L],
        question: DR.sectionDefs.purpose.syntheses["personal, social|spiritual"].question[L],
      }],
    },

    money: {

      title: DR.sectionDefs.money.title[L],
      lead: DR.sectionDefs.money.lead[L],
      rolesTitle: DR.sectionDefs.money.rolesTitle[L],
      rolesLead: DR.sectionDefs.money.rolesLead[L],
      interactionsTitle: DR.sectionDefs.money.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.money.interactionsLead[L],
      roles: SECTION_ROLES.money,
      edges: [
        { left: "L", right: "R2", title: DR.sectionDefs.money.edges["L|R2"].title[L], question: DR.sectionDefs.money.edges["L|R2"].question[L] },
        { left: "R2", right: "R", title: DR.sectionDefs.money.edges["R2|R"].title[L], question: DR.sectionDefs.money.edges["R2|R"].question[L] },
        { left: "R", right: "ground_total", title: DR.sectionDefs.money.edges["R|ground_total"].title[L], question: DR.sectionDefs.money.edges["R|ground_total"].question[L] },
      ],
    },

    money40: {

      title: DR.sectionDefs.money40.title[L],
      lead: DR.sectionDefs.money40.lead[L],
      rolesTitle: DR.sectionDefs.money40.rolesTitle[L],
      rolesLead: DR.sectionDefs.money40.rolesLead[L],
      interactionsTitle: DR.sectionDefs.money40.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.money40.interactionsLead[L],
      roles: SECTION_ROLES.money40,
      edges: [{ left: "R2", right: "L", title: DR.sectionDefs.money40.edges["R2|L"].title[L], question: DR.sectionDefs.money40.edges["R2|L"].question[L] }],
    },

    relations: {

      title: DR.sectionDefs.relations.title[L],
      lead: DR.sectionDefs.relations.lead[L],
      rolesTitle: DR.sectionDefs.relations.rolesTitle[L],
      rolesLead: DR.sectionDefs.relations.rolesLead[L],
      interactionsTitle: DR.sectionDefs.relations.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.relations.interactionsLead[L],
      roles: SECTION_ROLES.relations,
      edges: [
        { left: "M", right: "R1", title: DR.sectionDefs.relations.edges["M|R1"].title[L], question: DR.sectionDefs.relations.edges["M|R1"].question[L] },
        { left: "R1", right: "R", title: DR.sectionDefs.relations.edges["R1|R"].title[L], question: DR.sectionDefs.relations.edges["R1|R"].question[L] },
        { left: "R", right: "K", title: DR.sectionDefs.relations.edges["R|K"].title[L], question: DR.sectionDefs.relations.edges["R|K"].question[L] },
      ],
    },

    parents_children: {

      title: DR.sectionDefs.parents_children.title[L],
      lead: DR.sectionDefs.parents_children.lead[L],
      rolesTitle: DR.sectionDefs.parents_children.rolesTitle[L],
      rolesLead: DR.sectionDefs.parents_children.rolesLead[L],
      interactionsTitle: DR.sectionDefs.parents_children.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.parents_children.interactionsLead[L],
      roles: SECTION_ROLES.parents_children,
      edges: [
        { left: "F", right: "G", title: DR.sectionDefs.parents_children.edges["F|G"].title[L], question: DR.sectionDefs.parents_children.edges["F|G"].question[L] },
        { left: "F", right: "H", title: DR.sectionDefs.parents_children.edges["F|H"].title[L], question: DR.sectionDefs.parents_children.edges["F|H"].question[L] },
        { left: "G", right: "H", title: DR.sectionDefs.parents_children.edges["G|H"].title[L], question: DR.sectionDefs.parents_children.edges["G|H"].question[L] },
      ],
    },

    ancestry: {

      title: DR.sectionDefs.ancestry.title[L],
      lead: DR.sectionDefs.ancestry.lead[L],
      rolesTitle: DR.sectionDefs.ancestry.rolesTitle[L],
      rolesLead: DR.sectionDefs.ancestry.rolesLead[L],
      interactionsTitle: DR.sectionDefs.ancestry.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.ancestry.interactionsLead[L],
      roles: SECTION_ROLES.ancestry,
      edges: [
        { left: "I", right: "task_m", title: DR.sectionDefs.ancestry.edges["I|task_m"].title[L], question: DR.sectionDefs.ancestry.edges["I|task_m"].question[L] },
        { left: "I", right: "task_f", title: DR.sectionDefs.ancestry.edges["I|task_f"].title[L], question: DR.sectionDefs.ancestry.edges["I|task_f"].question[L] },
        { left: "task_m", right: "task_f", title: DR.sectionDefs.ancestry.edges["task_m|task_f"].title[L], question: DR.sectionDefs.ancestry.edges["task_m|task_f"].question[L] },
      ],
      syntheses: [{
        sources: ["task_m", "task_f"],
        target: "planetary",
        title: DR.sectionDefs.ancestry.syntheses["task_m, task_f|planetary"].title[L],
        question: DR.sectionDefs.ancestry.syntheses["task_m, task_f|planetary"].question[L],
      }],
    },

    body_resource: {

      title: DR.sectionDefs.body_resource.title[L],
      lead: DR.sectionDefs.body_resource.lead[L],
      rolesTitle: DR.sectionDefs.body_resource.rolesTitle[L],
      rolesLead: DR.sectionDefs.body_resource.rolesLead[L],
      interactionsTitle: DR.sectionDefs.body_resource.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.body_resource.interactionsLead[L],
      roles: SECTION_ROLES.body_resource,
      edges: [
        { left: "C", right: "D", title: DR.sectionDefs.body_resource.edges["C|D"].title[L], question: DR.sectionDefs.body_resource.edges["C|D"].question[L] },
      ],
      syntheses: [{
        sources: ["C", "D"],
        target: "total",
        title: DR.sectionDefs.body_resource.syntheses["C, D|total"].title[L],
        question: DR.sectionDefs.body_resource.syntheses["C, D|total"].question[L],
      }],
    },

    chakras: {

      title: DR.sectionDefs.chakras.title[L],
      lead: DR.sectionDefs.chakras.lead[L],
      rolesTitle: DR.sectionDefs.chakras.rolesTitle[L],
      rolesLead: DR.sectionDefs.chakras.rolesLead[L],
      interactionsTitle: DR.sectionDefs.chakras.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.chakras.interactionsLead[L],
      roles: SECTION_ROLES.chakras,
      edges: [],
    },

    rest: {

      title: DR.sectionDefs.rest.title[L],
      lead: DR.sectionDefs.rest.lead[L],
      rolesTitle: DR.sectionDefs.rest.rolesTitle[L],
      rolesLead: DR.sectionDefs.rest.rolesLead[L],
      interactionsTitle: DR.sectionDefs.rest.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.rest.interactionsLead[L],
      roles: SECTION_ROLES.rest,
      edges: [{ left: "joy", right: "E", title: DR.sectionDefs.rest.edges["joy|E"].title[L], question: DR.sectionDefs.rest.edges["joy|E"].question[L] }],
    },

    loops: {

      title: DR.sectionDefs.loops.title[L],
      lead: DR.sectionDefs.loops.lead[L],
      rolesTitle: DR.sectionDefs.loops.rolesTitle[L],
      rolesLead: DR.sectionDefs.loops.rolesLead[L],
      interactionsTitle: DR.sectionDefs.loops.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.loops.interactionsLead[L],
      roles: SECTION_ROLES.loops,
      edges: [
        { left: "D", right: "E", title: DR.sectionDefs.loops.edges["D|E"].title[L], question: DR.sectionDefs.loops.edges["D|E"].question[L] },
        { left: "E", right: "spiritual", title: DR.sectionDefs.loops.edges["E|spiritual"].title[L], question: DR.sectionDefs.loops.edges["E|spiritual"].question[L] },
        { left: "D", right: "spiritual", title: DR.sectionDefs.loops.edges["D|spiritual"].title[L], question: DR.sectionDefs.loops.edges["D|spiritual"].question[L] },
      ],
    },

    years: {

      title: DR.sectionDefs.years.title[L],
      lead: DR.sectionDefs.years.lead[L],
      rolesTitle: DR.sectionDefs.years.rolesTitle[L],
      rolesLead: DR.sectionDefs.years.rolesLead[L],
      interactionsTitle: DR.sectionDefs.years.interactionsTitle[L],
      interactionsLead: DR.sectionDefs.years.interactionsLead[L],
      roles: SECTION_ROLES.years,
      edges: [
        ...([0, 1, 2, 3, 4, 5, 6] as const).map((index) => ({
          left: `${index * 10}–${index * 10 + 10}`,
          right: `${index * 10 + 10}–${index * 10 + 20}`,
          title: DR.readingBody.decadeEdgeTitle[L](index * 10 + 10),
          question: DR.readingBody.decadeEdgeQuestion[L],
        })),
      ],
    },
  };

  const ARCANA = new Map<number, ArcanumContent>();

  function arcanum(number: number): ArcanumContent {
    const cached = ARCANA.get(number);
    if (cached) return cached;
    const value = arcanumContent(number);
    if (!value) throw new Error(`[section-reading] нет аркана ${number}`);
    ARCANA.set(number, value);
    return value;
  }

  /** Один позиционный источник превращается в четыре кубика без второго корпуса трактовок. */
  function sectionRoleTemplate(
    section: PersonalSectionKey,
    number: number,
    position: string,
    roleKey?: string,
  ): ReadingRoleTemplate {
    const definition = DEFINITIONS[section].roles.find(
      (role) => role.position === position && (!roleKey || role.key === roleKey),
    );
    if (!definition) throw new Error(`[section-reading] позиция ${position} не входит в ${section}`);
    if (definition.variant) return variantRoleTemplate(number, position, definition.variant);
    return positionRoleTemplate(number, position);
  }

  function roles(section: PersonalSectionKey, matrix: Matrix): ReadingRole[] {
    // Копия печатается один раз: роль с `pairedWith` читает ту же позицию корпуса, что и названная
    // в нём, и при совпадении аркана даёт дословно те же четыре кубика.
    const byKey = new Map<string, { label: string; arcanum: number }>();
    return DEFINITIONS[section].roles.map((definition, index) => {
      const arcanumNumber = definition.value(matrix);
      const template = sectionRoleTemplate(section, arcanumNumber, definition.position, definition.key);
      const twin = definition.pairedWith ? byKey.get(definition.pairedWith) : undefined;
      const first = twin && twin.arcanum === arcanumNumber
        ? { key: definition.pairedWith!, label: twin.label }
        : undefined;
      byKey.set(definition.key, { label: definition.label, arcanum: arcanumNumber });
      return {
        key: definition.key,
        label: definition.label,
        question: definition.question,
        arcanum: arcanumNumber,
        ...template,
        ...(section === "years"
          ? { essence: `${ageFrameText(index)} ${template.essence}` }
          : {}),
        ...(first ? { sameAs: first } : {}),
      };
    });
  }

  function pairKey(a: number, b: number): string {
    return `${Math.min(a, b)}-${Math.max(a, b)}`;
  }

  function interactions(
    section: PersonalSectionKey,
    items: ReadingRole[],
  ): ReadingInteraction[] {
    const definition = DEFINITIONS[section];
    const byRole = new Map(items.map((role) => [role.key, role]));
    const grouped = new Map<string, EdgeDefinition[]>();
    for (const edge of definition.edges) {
      if (edge.when && !edge.when(items)) continue;
      const left = byRole.get(edge.left)!;
      const right = byRole.get(edge.right)!;
      const key = pairKey(left.arcanum, right.arcanum);
      grouped.set(key, [...(grouped.get(key) ?? []), edge]);
    }

    const pairInteractions = [...grouped.entries()].map(([key, edges]) => {
      const first = edges[0];
      const left = byRole.get(first.left)!;
      const right = byRole.get(first.right)!;
      const roleKeys = [...new Set(edges.flatMap((edge) => [edge.left, edge.right]))];
      const roleLabels = roleKeys.map((key) => readingRoleReference(byRole.get(key)!)).join(", ");
      const questions = edges.map((edge) => edge.question);
      if (left.arcanum === right.arcanum) {
        const content = arcanum(left.arcanum);
        const allRoles = roleKeys.length === items.length;
        return {
          key,
          title: allRoles
            ? DR.readingBody.repeatAllTitle[L](content.title)
            : DR.readingBody.repeatSomeTitle[L](content.title, roleLabels),
          roles: roleKeys,
          paragraphs: [
            allRoles
              ? DR.readingBody.repeatAllText[L](left.arcanum)
              : DR.readingBody.repeatSomeText[L](left.arcanum, roleLabels),
            `${questions.join(" ")} ${content.repeat}`,
          ],
        };
      }

      const contextual = edges.flatMap((edge) => {
        const edgeLeft = byRole.get(edge.left)!;
        const edgeRight = byRole.get(edge.right)!;
        if (edge.context) {
          if (!combinationContent(key)) throw new Error(`[section-reading] нет сочетания ${key}`);
          return buildCombinationContext(edgeLeft.arcanum, edgeRight.arcanum, edge.context).paragraphs;
        }
        const [leftStrength, rightStrength] = pairCubes(edgeLeft.strength, edgeRight.strength);
        const [leftRisk, rightRisk] = pairCubes(edgeLeft.risk, edgeRight.risk);
        return [
          DR.readingBody.edgeAgreed[L](
            edge.question, edgeLeft.label, edgeRight.label, leftStrength, rightStrength,
          ),
          DR.readingBody.edgeTension[L](readingRoleReference(edgeLeft), leftRisk, readingRoleReference(edgeRight), rightRisk),
          DR.readingBody.edgePractice[L](
            readingRoleReference(edgeLeft), edgeLeft.action, readingRoleReference(edgeRight), edgeRight.action,
          ),
        ];
      });
      return {
        key,
        title: edges.length > 1
          ? DR.readingBody.pairManyTitle[L](left.title, right.title, edges.length)
          : first.title,
        roles: roleKeys,
        paragraphs: [
          ...(edges.length > 1
            ? [DR.readingBody.pairManyText[L](left.arcanum, right.arcanum)]
            : []),
          ...contextual,
        ],
        ...(first.context
          ? {
            href: `/encyclopedia/combination/${key}`,
            linkLabel: DR.readingBody.pairLink[L](key.replace("-", ` ${D.encArcanum.and[L]} `)),
          }
          : {}),
      };
    });

    const synthesisInteractions = (definition.syntheses ?? []).map((synthesis) => {
      const sources = synthesis.sources.map((key) => byRole.get(key)!);
      const target = byRole.get(synthesis.target)!;
      const sourceLabels = sources.map((role) => `${readingRoleReference(role)} — ${role.title}`).join("; ");
      const sourceStrengths = sources.map((role) => `${readingRoleReference(role)} — ${cubeClause(role.strength)}`).join("; ");
      const sourceRisks = sources.map((role) => `${readingRoleReference(role)} — ${cubeClause(role.risk)}`).join("; ");
      const sourceActions = sources.map((role) => `${readingRoleReference(role)}: ${role.action}`).join(" ");
      return {
        key: `synthesis:${synthesis.sources.join("+")}=>${synthesis.target}`,
        title: synthesis.title,
        roles: [...synthesis.sources, synthesis.target],
        paragraphs: [
          DR.readingBody.synthesisIntro[L](synthesis.question, sourceLabels, target.label),
          DR.readingBody.synthesisAgreed[L](
            sourceStrengths, readingRoleReference(target), cubeClause(target.strength),
          ),
          DR.readingBody.synthesisGap[L](sourceRisks, cubeClause(target.risk)),
          DR.readingBody.synthesisPractice[L](sourceActions, readingRoleReference(target), target.action),
        ],
      } satisfies ReadingInteraction;
    });

    // Синтез встаёт сразу после последней связи, которая касается его источников, а не в конец
    // списка: у `purpose` лид обещает «личное→социальное, затем оба соединяются в духовном, а
    // духовный переводится в планетарный», а рендер выдавал синтез последним. У остальных разделов
    // синтез и так шёл после единственной связи, поэтому порядок там не меняется.
    const ordered = [...pairInteractions];
    for (const synthesis of synthesisInteractions) {
      const sources = new Set(synthesis.roles.slice(0, -1));
      const lastSource = ordered.reduce(
        (found, item, index) => (item.roles.some((role) => sources.has(role)) ? index : found),
        -1,
      );
      ordered.splice(lastSource + 1, 0, synthesis);
    }
    return ordered;
  }

  const CHAKRA_COLUMNS = [
    ["physics", DR.chakraYears.columnPhysicsTitle[L]],
    ["energy", DR.chakraYears.columnEnergyTitle[L]],
    ["emotions", DR.chakraYears.columnEmotionsTitle[L]],
  ] as const;

  // Семь пунктов — треть шкалы 1..22. Меньшую разницу описываем как рабочую вариативность,
  // а не объявляем любой несовпадающий показатель «заметным дисбалансом».
  const CHAKRA_NOTICEABLE_GAP = 7;

  /** 22×3 модификатора собираются из аркана и роли колонки; отдельные 462 текста ячеек не нужны. */
  function chakraColumnModifier(
    number: number,
    column: (typeof CHAKRA_COLUMNS)[number][0],
  ): { modifier: string; action: string } {
    const content = arcanum(number);
    const frames = {
      physics: DR.readingBody.wherePhysics[L],
      energy: DR.readingBody.whereEnergy[L],
      emotions: DR.readingBody.whereEmotions[L],
    } as const;
    const [where, actionWhere] = frames[column];
    return {
      modifier: DR.readingBody.chakraModifier[L](content.title, where, content.plus[0], content.minus[0]),
      action: DR.readingBody.chakraAction[L](
        actionWhere, positionRoleTemplate(number, "chakras").action,
      ),
    };
  }

  function chakraPayload(matrix: Matrix) {
    return matrix.chakras.map((row) => {
      const level = chakraContent(row.key);
      if (!level) throw new Error(`[section-reading] нет уровня ${row.key}`);
      return {
        key: row.key,
        title: row.title,
        hint: row.hint,
        level: level.level.join(" "),
        cells: CHAKRA_COLUMNS.map(([column, title]) => {
          const arcanumNumber = row[column];
          const columnContext = level.columns.find((item) => item.key === column);
          if (!columnContext) throw new Error(`[section-reading] нет колонки ${row.key}:${column}`);
          return {
            column,
            title,
            arcanum: arcanumNumber,
            context: columnContext.text,
            ...chakraColumnModifier(arcanumNumber, column),
          };
        }),
      };
    });
  }

  function chakraInteractions(matrix: Matrix): ReadingInteraction[] {
    const scored = matrix.chakras.map((row) => ({ row, score: row.physics + row.energy + row.emotions }));
    const leading = scored.reduce((best, item) => item.score > best.score ? item : best);
    const quiet = scored.reduce((best, item) => item.score < best.score ? item : best);
    const totals = Object.entries(matrix.chakra_totals) as Array<["physics" | "energy" | "emotions", number]>;
    const high = totals.reduce((best, item) => item[1] > best[1] ? item : best);
    const low = totals.reduce((best, item) => item[1] < best[1] ? item : best);
    const columnGap = high[1] - low[1];
    const rowGaps = matrix.chakras.map((row) => {
      const values = CHAKRA_COLUMNS.map(([column, title]) => ({ column, title, value: row[column] }));
      const rowHigh = values.reduce((best, item) => item.value > best.value ? item : best);
      const rowLow = values.reduce((best, item) => item.value < best.value ? item : best);
      return { row, high: rowHigh, low: rowLow, gap: rowHigh.value - rowLow.value };
    });
    const mainGap = rowGaps.reduce((best, item) => item.gap > best.gap ? item : best);
    const repeats = new Map<number, number>();
    for (const row of matrix.chakras) {
      for (const [column] of CHAKRA_COLUMNS) repeats.set(row[column], (repeats.get(row[column]) ?? 0) + 1);
    }
    const repeated = [...repeats.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
    const names = {
      physics: DR.readingBody.columnPhysics[L],
      energy: DR.readingBody.columnEnergy[L],
      emotions: DR.readingBody.columnEmotions[L],
    } as const;
    return [
      {
        key: "levels",
        title: DR.readingBody.levelsTitle[L],
        roles: [leading.row.title, quiet.row.title],
        caption: DR.readingBody.levelsCaption[L](leading.row.title, quiet.row.title),
        paragraphs: [
          DR.readingBody.levelsText[L](leading.row.title, leading.score, quiet.row.title, quiet.score),
          DR.readingBody.levelsNote[L],
        ],
      },
      {
        key: "imbalance",
        title: DR.readingBody.imbalanceTitle[L],
        roles: [mainGap.row.title, mainGap.high.column, mainGap.low.column],
        caption: DR.readingBody.imbalanceCaption[L](
          mainGap.row.title, mainGap.high.title, mainGap.low.title,
        ),
        paragraphs: [
          DR.readingBody.imbalanceText[L](
            mainGap.row.title,
            mainGap.high.title.toLowerCase(), mainGap.high.value,
            mainGap.low.title.toLowerCase(), mainGap.low.value,
            mainGap.gap,
            mainGap.gap >= CHAKRA_NOTICEABLE_GAP
              ? DR.readingBody.imbalanceNoticeable[L]
              : DR.readingBody.imbalanceOrdinary[L],
          ),
          DR.readingBody.imbalanceNote[L],
        ],
      },
      {
        key: "columns",
        title: DR.readingBody.columnsTitle[L],
        roles: [high[0], low[0]],
        caption: DR.readingBody.columnsCaption[L](
          CHAKRA_COLUMNS.find(([key]) => key === high[0])![1],
          CHAKRA_COLUMNS.find(([key]) => key === low[0])![1],
        ),
        paragraphs: [
          DR.readingBody.columnsText[L](
            names[high[0]], high[1], names[low[0]], low[1], columnGap,
            columnGap >= CHAKRA_NOTICEABLE_GAP
              ? DR.readingBody.columnsReaches[L]
              : DR.readingBody.columnsBelow[L],
          ),
          DR.readingBody.columnsNote[L],
        ],
      },
      {
        key: "repeats",
        title: DR.readingBody.repeatsTitle[L],
        roles: repeated.map(([number]) => String(number)),
        ...(repeated.length
          ? { caption: DR.readingBody.repeatsCaption[L](repeated.map(([number]) => number).join("–")) }
          : {}),
        paragraphs: [
          repeated.length
            ? DR.readingBody.repeatsText[L](
              repeated
                .map(([number, count]) => DR.readingBody.repeatsCount[L](number, count))
                .join(", "),
            )
            : DR.readingBody.repeatsNone[L],
          DR.readingBody.repeatsNote[L],
        ],
      },
    ];
  }

  function age(matrix: Matrix, now = new Date()): number {
    const [year, month, day] = matrix.birth.split("-").map(Number);
    let value = now.getFullYear() - year;
    if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) value--;
    return Math.max(0, value);
  }

  const DECADE_TURNING_THEMES = new Map<number, string>(
    Object.entries(DR.sharedBlock.turning[L]).map(([key, value]) => [Number(key), value]),
  );

  /** Одна точка матрицы входит в два раздела: «Личное предназначение» стоит и в `purpose`, и в
   *  `realisation`. Рамки роли различают формулировки, но предметный текст один, поэтому читателю,
   *  открывшему оба разбора, повтор объясняется прямо и уводится ссылкой. Замер до рамок и этой
   *  отсылки: `realisation` ~ `purpose` — 214 общих 8-грамм, 37–47 % меньшего разбора. */
  const SHARED_ROLES: Partial<Record<PersonalSectionKey, { section: PersonalSectionKey; roles: string[] }>> = {
    realisation: { section: "purpose", roles: ["personal", "social"] },
    money40: { section: "resources", roles: ["L"] },
    loops: { section: "rest", roles: ["E"] },
  };

  /**
   * Ведёт ли слаг раздела к единственному слагу соседа. У `realisation → purpose` и
   * `money40 → resources` целевые точки выводятся из исходных, поэтому ссылка «для этой матрицы»
   * попадает точно. У `loops → rest` нет: слаг «Программ» (D–E–духовное) не определяет эмоции
   * свадхистханы, и ссылка вела на разбор чужой даты у 89,8 % матриц. Считаем один раз по
   * достижимым результатам, а не гадаем.
   */
  const STABLE_SHARED = new Map<string, boolean>();

  function sharedLinkIsExact(section: PersonalSectionKey, target: PersonalSectionKey): boolean {
    const key = `${section}->${target}`;
    const cached = STABLE_SHARED.get(key);
    if (cached !== undefined) return cached;
    const seen = new Map<string, string>();
    let exact = true;
    for (const slug of matrixSlugs()) {
      const item = matrixItem(slug);
      if (!item) continue;
      const from = sectionReadingSlug(section, item.matrix);
      const to = sectionReadingSlug(target, item.matrix);
      const known = seen.get(from);
      if (known === undefined) seen.set(from, to);
      else if (known !== to) { exact = false; break; }
    }
    STABLE_SHARED.set(key, exact);
    return exact;
  }

  function sourceRole(section: PersonalSectionKey, key: string): SectionRoleDefinition | undefined {
    return SECTION_ROLES[section].find((role) => role.key === key);
  }

  function aliasIn(section: PersonalSectionKey, key: string): string {
    return SECTION_ROLES[section].find((role) => role.key === key)?.label ?? "";
  }

  /**
   * Обе ветки написаны целыми предложениями, а не собираются из кусков по числу: подстановка
   * «точка/точки» внутри общей строки уже оставляла несогласованные «которые» и «отвечает».
   */
  function sharedWording(
    many: boolean,
    ctx: { other: string; labels: string[]; places: string[]; named: boolean; aliases: string[] },
  ): { title: string; caption: string; paragraphs: string[] } {
    const { other, labels, named, aliases } = ctx;
    const places = ctx.places.map((place) => place.charAt(0).toLowerCase() + place.slice(1));
    if (many) {
      const joined = labels.join(` ${D.encArcanum.and[L]} `);
      const lead = named
        ? DR.sharedBlock.manyLeadNamed[L](joined, places.join(` ${D.encArcanum.and[L]} `), other)
        : DR.sharedBlock.manyLeadPlain[L](joined, other);
      return {
        title: DR.sharedBlock.manyTitle[L](other),
        caption: DR.sharedBlock.manyCaption[L],
        paragraphs: [`${lead}${DR.sharedBlock.manyBody[L]}`],
      };
    }
    const alias = aliases[0] && aliases[0].toLowerCase() !== places[0]?.toLowerCase()
      ? DR.sharedBlock.aliasNamed[L](aliases[0].toLowerCase())
      : DR.sharedBlock.aliasPlain[L];
    const lead = named
      ? DR.sharedBlock.oneLeadNamed[L](labels[0], places[0], other, alias)
      : DR.sharedBlock.oneLeadPlain[L](labels[0], other, alias);
    return {
      title: DR.sharedBlock.oneTitle[L](other),
      caption: DR.sharedBlock.oneCaption[L],
      paragraphs: [`${lead}${DR.sharedBlock.oneBody[L]}`],
    };
  }

  function sharedInteraction(
    section: PersonalSectionKey,
    matrix: Matrix,
    items: ReadingRole[],
  ): ReadingInteraction[] {
    const shared = SHARED_ROLES[section];
    if (!shared) return [];
    const parts = items
      .filter((role) => shared.roles.includes(role.key))
      .map((role) => ({
        label: D.common.quoted[L](role.label.toLowerCase()),
        place: positionContent(sourceRole(section, role.key)?.position ?? "")?.title ?? "",
        alias: aliasIn(shared.section, role.key),
      }));
    if (!parts.length) return [];
    const other = DEFINITIONS[shared.section].title;
    const labels = parts.map((part) => part.label);
    const places = parts.map((part) => part.place).filter(Boolean);
    const named = places.length === parts.length;
    return [{
      key: `shared:${shared.section}`,
      ...sharedWording(parts.length > 1, { other, labels, places, named, aliases: parts.map((p) => p.alias) }),
      roles: shared.roles,
      ...(sharedLinkIsExact(section, shared.section)
        ? {
          href: sectionReadingHref(shared.section, matrix),
          linkLabel: DR.sharedBlock.openOther[L](other),
        }
        : {
          // Свой разбор соседнего раздела по этому адресу не найти: одному слагу «Программ»
          // отвечают разные результаты отдыха. Уводим на общую статью — она верна всегда.
          href: positionHref(shared.section),
          linkLabel: DR.sharedBlock.openGeneral[L](other),
        }),
    }];
  }

  function buildSectionReading(
    section: PersonalSectionKey,
    matrix: Matrix,
    now = new Date(),
  ): LongformReading {
    const definition = DEFINITIONS[section];
    const roleItems = roles(section, matrix);
    const slug = sectionReadingSlug(section, matrix);
    const date = `${matrix.day}–${matrix.month}–${matrix.year}`;
    const title = section === "chakras"
      ? DR.sectionReading.titleForMatrix[L](definition.title, date)
      : section === "years"
        ? (matrix.birth
          ? `${definition.title}: ${birthLabel(matrix.birth)}`
          : DR.sectionReading.titleLine[L](definition.title, slug))
        : DR.sectionReading.titleRoles[L](
          definition.title, slug, roleItems.map((role) => role.title).join(", "),
        );
    const base: LongformReading = {
      slug,
      title,
      lead: definition.lead,
      rolesTitle: definition.rolesTitle,
      rolesLead: definition.rolesLead,
      interactionsTitle: definition.interactionsTitle,
      interactionsLead: definition.interactionsLead,
      testId: `${section}-reading`,
      roles: roleItems,
      interactions: [...interactions(section, roleItems), ...sharedInteraction(section, matrix, roleItems)],
      ...buildSectionConclusion(section, roleItems),
    };
    if (section === "chakras") {
      const rows = chakraPayload(matrix);
      const interactions = chakraInteractions(matrix);
      const leading = interactions[0].roles[0];
      return {
        ...base,
        layout: "chakras",
        caption: DR.chakraYears.chakraCaption[L],
        chakraRows: rows,
        interactions,
        summary: DR.chakraYears.chakraSummary[L](leading),
        strength: DR.chakraYears.chakraStrength[L],
        tension: DR.chakraYears.chakraTension[L],
        practice: DR.chakraYears.chakraPractice[L],
      };
    }
    if (section === "years") {
      // Без даты рождения линия читается как последовательность десятилетий: текущий этап
      // неизвестен, и выдумывать его по чужой матрице нельзя.
      const known = Boolean(matrix.birth);
      const currentAge = known ? age(matrix, now) : -1;
      const currentIndex = Math.min(7, Math.floor(Math.max(currentAge, 0) / 10));
      const periods = roleItems.map((role, index) => ({
        from: index * 10,
        to: index * 10 + 10,
        arcanum: role.arcanum,
        title: role.title,
        essence: role.essence,
        strength: role.strength,
        risk: role.risk,
        action: role.action,
        current: known && index === currentIndex && currentAge < 80,
        next: known && index === currentIndex + 1 && currentAge < 70,
      }));
      const current = periods[currentIndex];
      const next = periods[currentIndex + 1];
      const returned = new Map<number, number[]>();
      periods.forEach((period, index) => returned.set(period.arcanum, [...(returned.get(period.arcanum) ?? []), index]));
      const returnText = [...returned.entries()]
        .filter(([, indexes]) => indexes.some((value, index) => index > 0 && value - indexes[index - 1] > 1))
        .map(([number, indexes]) => DR.chakraYears.returnsText[L](
          number,
          indexes.map((index) => `${index * 10}–${index * 10 + 10}`).join(` ${D.encArcanum.and[L]} `),
        ));
      const sharpChangeText = periods.slice(0, -1).flatMap((period, index) => {
        const following = periods[index + 1];
        if (period.arcanum === following.arcanum) return [];
        const markers = [period, following].flatMap((item) => {
          const theme = DECADE_TURNING_THEMES.get(item.arcanum);
          return theme ? [DR.chakraYears.sharpMarker[L](item.arcanum, theme)] : [];
        });
        if (!markers.length) return [];
        return [DR.chakraYears.sharpText[L](
          period.from, period.to, following.from, following.to,
          markers.join(DR.chakraYears.sharpJoin[L]),
        )];
      });
      return {
        ...base,
        layout: "years",
        caption: DR.chakraYears.yearsCaption[L],
        agePeriods: periods,
        interactions: [
          ...base.interactions,
          ...(returnText.length
            ? [{
              key: "returns",
              title: DR.chakraYears.returnsTitle[L],
              roles: [],
              paragraphs: [returnText.join("; ") + DR.chakraYears.returnsTail[L]],
            }]
            : []),
          ...(sharpChangeText.length
            ? [{
              key: "sharp-changes",
              title: DR.chakraYears.sharpTitle[L],
              roles: [],
              paragraphs: sharpChangeText,
            }]
            : []),
        ],
        summary: !known
          ? DR.chakraYears.yearsSummaryUnknown[L](slug)
          : currentAge < 80
            ? DR.chakraYears.yearsSummaryCurrent[L](
              currentAge, current.from, current.to, current.arcanum, current.title,
              next
                ? DR.chakraYears.yearsNext[L](next.from, next.to, next.arcanum, next.title)
                : DR.chakraYears.yearsLast[L],
            )
            : DR.chakraYears.yearsBeyond[L](currentAge),
        strength: !known
          ? DR.chakraYears.yearsStrengthUnknown[L]
          : currentAge < 80
            ? sentence(current.strength)
            : DR.chakraYears.yearsStrengthBeyond[L],
        tension: !known
          ? DR.chakraYears.yearsTensionUnknown[L]
          : currentAge < 80
            ? DR.chakraYears.yearsTensionCurrent[L](sentence(current.risk))
            : DR.chakraYears.yearsTensionBeyond[L],
        practice: !known
          ? DR.chakraYears.yearsPracticeUnknown[L]
          : currentAge < 80
            ? DR.chakraYears.yearsPracticeCurrent[L](
              current.action,
              next ? DR.chakraYears.yearsPracticeNext[L](next.essence) : "",
            )
            : DR.chakraYears.yearsPracticeBeyond[L],
      };
    }
    return base;
  }

  const REACHABLE = new Map<PersonalSectionKey, Map<string, MatrixItem>>();

  function reachable(section: PersonalSectionKey): Map<string, MatrixItem> {
    const cached = REACHABLE.get(section);
    if (cached) return cached;
    const result = new Map<string, MatrixItem>();
    for (const matrixSlug of matrixSlugs()) {
      const item = matrixItem(matrixSlug)!;
      const slug = sectionReadingSlug(section, item.matrix);
      if (!result.has(slug)) result.set(slug, item);
    }
    REACHABLE.set(section, result);
    return result;
  }

  /** Подпись к ссылке на персональный пример в общей статье раздела. Один и тот же абзац
   *  «те же правила к одному достижимому результату» стоял на 17 страницах — единственная
   *  реальная шаблонность на страницах разделов. */
  function sectionExampleNote(section: PersonalSectionKey, matrix: Matrix): string {
    const lead = DR.sectionReading.exampleLead[L];
    const code = sectionReadingSlug(section, matrix);
    if (section === "chakras") {
      return DR.sectionReading.exampleChakras[L](lead, `${matrix.day}–${matrix.month}–${matrix.year}`);
    }
    if (section === "years") {
      return DR.sectionReading.exampleYears[L](lead, code);
    }
    const roles = buildSectionReading(section, matrix).roles
      .filter((role) => !role.sameAs)
      .slice(0, 4)
      .map((role) => `${role.label.toLowerCase()} — ${role.title}`);
    return DR.sectionReading.exampleRoles[L](lead, code, roles.join(", "));
  }

  function sectionReadingSlugs(section: PersonalSectionKey): string[] {
    return [...reachable(section).keys()];
  }

  function sectionReadingItem(
    section: PersonalSectionKey,
    slug: string,
  ): MatrixItem | null {
    if (!/^(?:[1-9]|1\d|2[0-2])(?:-(?:[1-9]|1\d|2[0-2])){1,23}$/.test(slug)) {
      return null;
    }
    return reachable(section).get(slug) ?? null;
  }

  function sectionReadingMatrix(
    section: PersonalSectionKey,
    slug: string,
    query: { birth?: string } = {},
  ): Matrix | null {
    const fallback = sectionReadingItem(section, slug)?.matrix;
    if (!fallback) return null;
    if (section === "years") {
      if (!query.birth) {
        // Слаг из восьми арканов даёт одну и ту же линию многим датам. Без параметра показывать
        // чужую дату в заголовке нельзя: отдаём ту же линию, но без персонального возраста.
        return { ...fallback, birth: "" };
      }
      try {
        const matrix = calculate(query.birth, "f");
        return sectionReadingSlug(section, matrix) === slug ? matrix : null;
      } catch {
        return null;
      }
    }
    return fallback;
  }
  return { buildSectionConclusion, sectionReadingHref, sectionReadingSlug, sectionRoleMeta, sectionRoleTemplate, chakraColumnModifier, buildSectionReading, sectionExampleNote, sectionReadingSlugs, sectionReadingItem, sectionReadingMatrix };
});

// Compatibility for callers that explicitly use the deployment default.
export const { sectionRoleTemplate, chakraColumnModifier, buildSectionReading, sectionExampleNote, sectionReadingSlugs, sectionReadingItem, sectionReadingMatrix } = forLocale(defaultLocale);
