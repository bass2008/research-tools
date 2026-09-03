import {
  arcanumContent,
  chakraContent,
  combinationContent,
  matrixItem,
  matrixSlugs,
  positionContent,
  type ArcanumContent,
  type MatrixItem,
} from "./content";
import {
  buildCombinationContext,
  type CombinationContextKey,
} from "./combinationReading";
import { birthLabel, calculate, type Matrix } from "./matrix";
import type {
  LongformReading,
  ReadingInteraction,
  ReadingRole,
  ReadingRoleTemplate,
} from "./readingTypes";
import { ageFrameText, positionRoleTemplate, variantRoleTemplate } from "./roleContent";
import { positionHref } from "./publicSpec";
import { cubeClause, pairCubes, sentence } from "./text";
import {
  SECTION_ROLES,
  buildSectionConclusion,
  sectionReadingSlug,
  type PersonalSectionKey,
  sectionReadingHref,
  type SectionRoleDefinition,
} from "./sectionReadingShared";
export {
  buildSectionConclusion,
  sectionReadingHref,
  sectionReadingSlug,
  sectionRoleMeta,
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

const DEFINITIONS: Record<PersonalSectionKey, ReadingDefinition> = {
  comfort: {
    title: "Центр и внутренние точки",
    lead:
      "Персональный разбор центра E, автоматической реакции M и таланта K, который помогает вернуть управление.",
    rolesTitle: "Три внутренних ориентира",
    rolesLead:
      "E показывает базовое состояние, M — первую реакцию без подготовки, K — качество, через которое проще вернуться к себе. Точки отвечают на разные вопросы и читаются вместе.",
    interactionsTitle: "Как внутренние точки влияют друг на друга",
    interactionsLead:
      "Сначала читаются роли E, M и K, затем три связи между ними. Повтор одного аркана усиливает общую тему, но не превращает разные точки в одну.",
    roles: SECTION_ROLES.comfort,
    edges: [
      {
        left: "E",
        right: "M",
        title: "Опора и автоматическая реакция",
        question: "Эта связь показывает, сохраняется ли внутренний центр в момент первой реакции.",
        context: "E-M",
      },
      {
        left: "E",
        right: "K",
        title: "Опора и возвращающий талант",
        question: "Эта связь показывает, какое врождённое качество поддерживает базовое состояние.",
        context: "E-K",
      },
      {
        left: "M",
        right: "K",
        title: "От реакции к управлению",
        question: "Эта связь показывает, как превратить автоматическую реакцию в осознанное действие.",
        context: "M-K",
      },
    ],
  },
  profession: {
    title: "Профессия и дело по душе",
    lead:
      "Персональный разбор линии таланта B–P–K: исходный дар, подходящая форма работы и внутренний результат реализации.",
    rolesTitle: "Три звена профессиональной реализации",
    rolesLead:
      "B показывает исходное качество, P — задачи и формат труда, K — состояние, к которому приводит зрелая реализация. Линия описывает способ работать, а не назначает единственную профессию.",
    interactionsTitle: "Как талант превращается в дело",
    interactionsLead:
      "Линия читается в порядке B→P→K, а затем проверяется прямая связь B↔K. Повторы усиливают одну тему; разные арканы показывают, где нужен перевод из качества в рабочее действие.",
    roles: SECTION_ROLES.profession,
    edges: [
      {
        left: "B",
        right: "P",
        title: "От дара к рабочей задаче",
        question: "Эта связь показывает, как естественное качество становится конкретным способом работать.",
        context: "B-P",
      },
      {
        left: "P",
        right: "K",
        title: "От работы к внутреннему результату",
        question: "Эта связь показывает, даёт ли выбранный формат труда ощущение собственной реализации.",
        context: "P-K",
      },
      {
        left: "B",
        right: "K",
        title: "Дар и итог реализации",
        question: "Эта связь проверяет, сохранилось ли исходное качество в конечном результате.",
        context: "B-K",
      },
    ],
  },
  realisation: {
    title: "Путь самореализации",
    lead: "Персональный путь от возвращающейся задачи D через личный рост к пользе для других.",
    rolesTitle: "Три уровня пути",
    rolesLead: "D показывает корневой повтор, личное предназначение — внутреннее изменение, социальное — форму пользы. Это последовательность, а не три конкурирующие миссии.",
    interactionsTitle: "Как задача становится реализацией",
    interactionsLead: "Основной ход читается D→личное→социальное; прямая связь D↔социальное нужна как проверка, не потерян ли исходный опыт на большем масштабе.",
    roles: SECTION_ROLES.realisation,
    edges: [
      { left: "D", right: "личное", title: "От повтора к личному росту", question: "Как новый ответ на корневую задачу меняет самого человека." },
      { left: "личное", right: "социальное", title: "От личного роста к пользе", question: "Как внутреннее изменение становится полезным другим." },
      {
        left: "D",
        right: "социальное",
        title: "Корень и социальный масштаб",
        question: "Сохраняется ли смысл исходной задачи на большем масштабе.",
        // Проверка «не потерян ли исходный опыт» осмысленна, только если средний уровень не
        // повторяет ни один из краёв: иначе цепочка D→личное→социальное уже её содержит.
        when: (roles) => new Set(roles.map((role) => role.arcanum)).size === roles.length,
      },
    ],
  },
  karma40: {
    title: "Кармическая задача до 40 лет",
    lead: "Персональный возрастной ракурс I–J без обещания автоматического события или перелома ровно в сорок лет.",
    rolesTitle: "Наследство и способ защиты",
    rolesLead: "I показывает семейное наследство в повседневных решениях, J — привычный способ согласовать внешний образ с внутренней опорой.",
    interactionsTitle: "Как наследство становится задачей первой части пути",
    interactionsLead: "Связь I↔J показывает, какое правило человек защищает автоматически и как сохранить его ресурс без прежнего перекоса.",
    roles: SECTION_ROLES.karma40,
    edges: [{ left: "I", right: "J", title: "Наследство и автоматическая защита", question: "Как семейное правило влияет на привычный способ восстанавливать контроль." }],
  },
  resources: {
    // Название берётся из spec/sections.json: там «вам», и по нему построены крошка над статьёй
    // и заголовок раздела в отчёте. Расхождение было видно на одной странице сразу дважды.
    title: "Что открывает вам блага и ресурс",
    lead: "Персональная связка L→R2: вход в ресурс, условие его удержания, возможная блокировка и практический шаг.",
    rolesTitle: "Два звена ресурсного канала",
    rolesLead: "L показывает первый способ включиться в движение, R2 — направление, которое помогает превратить импульс в устойчивый результат.",
    interactionsTitle: "От входа к удержанию",
    interactionsLead: "Пара читается по направлению L→R2. Она описывает способ действовать и не является обещанием богатства.",
    roles: SECTION_ROLES.resources,
    edges: [{ left: "L", right: "R2", title: "Вход и условие удержания", question: "Что помогает первому импульсу стать устойчивым движением." }],
  },
  family_gifts: {
    title: "Поддержка и дары вашего рода",
    lead: "Персональный разбор двух родовых ветвей и двух разных итогов их поддержки без оценки семьи и поиска виноватых.",
    rolesTitle: "Две ветви и два дара",
    rolesLead: "F и G называют исходные принципы ветвей, а два итога показывают, во что их поддержка складывается в собственной жизни человека.",
    interactionsTitle: "Как взаимодействуют ветви и итоги",
    interactionsLead: "Читаются четыре значимые связи вместо механического перебора всех шести пар: каждая ветвь со своим итогом, связь исходных правил и связь двух даров.",
    roles: SECTION_ROLES.family_gifts,
    edges: [
      { left: "F", right: "итог М", title: "Мужская ветвь и её дар", question: "Как принцип мужской ветви становится доступной силой." },
      { left: "G", right: "итог Ж", title: "Женская ветвь и её дар", question: "Как принцип женской ветви становится доступной силой." },
      { left: "F", right: "G", title: "Два исходных правила", question: "Где принципы ветвей поддерживают или уточняют друг друга." },
      { left: "итог М", right: "итог Ж", title: "Взаимодействие двух даров", question: "Как две формы поддержки могут работать вместе." },
    ],
  },
  soul_tasks: {
    title: "Духовные задачи и уроки души",
    lead: "Персональный разбор двух исходных задач B и D и итога неба, который соединяет их в один урок.",
    rolesTitle: "Две задачи и общий итог",
    rolesLead: "B и D отвечают на разные исходные вопросы, а итог неба показывает способ удержать обе задачи вместе. Даже при совпадении номера итог остаётся отдельной ролью и не дублирует исходную точку дословно.",
    interactionsTitle: "Как две задачи образуют общий урок",
    interactionsLead: "Сначала сравниваются B и D, затем их связь переводится в итог неба. Повтор аркана усиливает тему, но не отменяет разницу ролей.",
    roles: SECTION_ROLES.soul_tasks,
    edges: [
      { left: "B", right: "D", title: "Две исходные задачи", question: "Как врождённый вопрос встречается с возвращающимся жизненным сюжетом." },
    ],
    syntheses: [{
      sources: ["B", "D"],
      target: "итог неба",
      title: "От пары к общему уроку",
      question: "Как две исходные задачи вместе образуют итог неба и проверяются действием.",
    }],
  },
  purpose: {
    title: "Ваше предназначение",
    lead: "Персональная траектория четырёх уровней: личного, социального, духовного и планетарного.",
    rolesTitle: "Четыре масштаба одной темы",
    rolesLead: "Уровни не назначают четыре разных дела. Каждый следующий показывает, как уже прожитое качество расширяет масштаб влияния.",
    interactionsTitle: "Как соединяются уровни предназначения",
    interactionsLead: "Граф читается личное→социальное, затем оба уровня соединяются в духовном, а духовный переводится в планетарный масштаб.",
    roles: SECTION_ROLES.purpose,
    edges: [
      { left: "личное", right: "социальное", title: "От себя к пользе другим", question: "Как личное качество становится социальной ролью." },
      { left: "духовное", right: "планетарное", title: "От смысла к большему масштабу", question: "Как направление выходит за рамки личной биографии." },
    ],
    syntheses: [{
      sources: ["личное", "социальное"],
      target: "духовное",
      title: "Личное и социальное образуют духовный уровень",
      question: "Как верность себе и подтверждённая польза другим вместе создают общее направление.",
    }],
  },
  money: {
    title: "Деньги в матрице судьбы",
    lead: "Персональная денежная линия L→R2→R→земля: вход, направление, личный выбор и устойчивость результата.",
    rolesTitle: "Четыре звена денежного движения",
    rolesLead: "Линия показывает логику решений, а не прогноз суммы: L запускает движение, R2 удерживает направление, R добавляет выбор, итог земли проверяет устойчивость.",
    interactionsTitle: "Как деньги проходят по линии",
    interactionsLead: "Основные переходы читаются последовательно. Связь входа с итогом используется только в общем выводе, чтобы не дублировать три промежуточных шага.",
    roles: SECTION_ROLES.money,
    edges: [
      { left: "L", right: "R2", title: "От входа к направлению", question: "Как первый импульс становится повторяемым способом действия." },
      { left: "R2", right: "R", title: "От направления к личному выбору", question: "Где правило движения встречается с договорённостями и решениями." },
      { left: "R", right: "земля", title: "От выбора к устойчивому результату", question: "Как решение закрепляется в материальной опоре." },
    ],
  },
  money40: {
    title: "Как меняются деньги после 40 лет",
    lead: "Персональный зрелый ракурс R2–L: накопленный опыт, новая опора и проверяемый денежный эксперимент.",
    rolesTitle: "Направление и вход в зрелом ракурсе",
    rolesLead: "Арканы не меняются автоматически по возрасту. Меняется порядок вопроса: сначала рассматривается накопленное направление R2, затем привычный вход L.",
    interactionsTitle: "Что перестаёт работать по-старому",
    interactionsLead: "Связь R2↔L читается отдельно от раздела ресурсов: здесь важен опыт, который позволяет пересобрать способ начинать денежное движение.",
    roles: SECTION_ROLES.money40,
    edges: [{ left: "R2", right: "L", title: "Зрелое направление и новая опора", question: "Как накопленный опыт меняет привычный денежный вход без резкого возрастного перелома." }],
  },
  relations: {
    title: "Отношения в матрице судьбы",
    lead: "Персональный сценарий близости M→R1→R с внутренним ресурсом K — без подмены совместимостью двух дат.",
    rolesTitle: "Четыре роли личного сценария близости",
    rolesLead: "M показывает вход, R1 — главный узел, R — форму договорённостей, K — качество, которое помогает сохранять себя.",
    interactionsTitle: "Как складывается сценарий отношений",
    interactionsLead: "Три последовательные связи показывают развитие сценария; прямая M↔K остаётся частью вывода и не дублирует уже прочитанные переходы.",
    roles: SECTION_ROLES.relations,
    edges: [
      { left: "M", right: "R1", title: "От входа к главному узлу", question: "Как первая реакция создаёт основной вопрос близости." },
      { left: "R1", right: "R", title: "От узла к форме союза", question: "Как внутренний вопрос становится договорённостью или повтором." },
      { left: "R", right: "K", title: "Форма союза и внутренний ресурс", question: "Как сохранять себя внутри совместных решений." },
    ],
  },
  parents_children: {
    title: "Карма отношений с родителями и детьми",
    lead: "Персональный разбор двух полученных семейных правил и того, как они продолжаются в собственном поведении.",
    rolesTitle: "Полученные правила и их продолжение",
    rolesLead: "F и G показывают принципы двух ветвей, H — не прогноз детей, а способ, которым человек передаёт эти правила дальше в любых близких и зависимых отношениях.",
    interactionsTitle: "Как семейные правила влияют друг на друга",
    interactionsLead: "Три связи помогают отделить ценность каждого правила от автоматического повторения и подходят пользователю независимо от наличия детей.",
    roles: SECTION_ROLES.parents_children,
    edges: [
      { left: "F", right: "G", title: "Два полученных правила", question: "Где принципы ветвей поддерживают или оспаривают друг друга." },
      { left: "F", right: "H", title: "Мужская ветвь и продолжение", question: "Как правило мужской ветви становится собственным поведением." },
      { left: "G", right: "H", title: "Женская ветвь и продолжение", question: "Как правило женской ветви становится собственным поведением." },
    ],
  },
  ancestry: {
    title: "Родовые задачи до седьмого колена",
    lead: "Персональный широкий родовой ракурс: наследство I, итоги задач двух ветвей и масштаб изменения.",
    rolesTitle: "Наследство, две ветви и масштаб",
    rolesLead: "Формула не рассчитывает семь отдельных поколений. Она соединяет текущее наследство, два разных итога задач ветвей и планетарный уровень.",
    interactionsTitle: "Как повторяющийся сценарий меняет продолжение",
    interactionsLead: "Связи читаются от I к каждой ветви, между двумя итогами и от их общего смысла к более широкому масштабу — без языка родовых проклятий.",
    roles: SECTION_ROLES.ancestry,
    edges: [
      { left: "I", right: "задача М", title: "Наследство и задача мужской ветви", question: "Как общее наследство проявляется в сценарии мужской ветви." },
      { left: "I", right: "задача Ж", title: "Наследство и задача женской ветви", question: "Как общее наследство проявляется в сценарии женской ветви." },
      { left: "задача М", right: "задача Ж", title: "Два итога задач", question: "Где ветви усиливают или уравновешивают повтор." },
    ],
    syntheses: [{
      sources: ["задача М", "задача Ж"],
      target: "планетарное",
      title: "От общего итога ветвей к масштабу",
      question: "Как совместный смысл двух ветвей переводит личное изменение на более широкий уровень.",
    }],
  },
  body_resource: {
    title: "Ресурс тела и восстановление",
    lead: "Персональная бытовая схема C–D–итог опоры: устойчивость, расход запаса и наблюдаемый способ восстановления.",
    rolesTitle: "Три элемента бытовой устойчивости",
    rolesLead: "Раздел описывает режим и поведение. Он не оценивает состояние организма и не заменяет рекомендации профильного специалиста.",
    interactionsTitle: "Как опора переходит в восстановление",
    interactionsLead: "Сначала сравниваются C и D, затем их сумма сворачивается в итог опоры. Повтор усиливает тему, но не является медицинским признаком.",
    roles: SECTION_ROLES.body_resource,
    edges: [
      { left: "C", right: "D", title: "Опора и расход запаса", question: "Как материальная организация встречается с возвращающимся способом действия." },
    ],
    syntheses: [{
      sources: ["C", "D"],
      target: "итог",
      title: "От суммы C и D к итогу восстановления",
      question: "Как бытовая опора и способ расходовать силы вместе образуют итог восстановления.",
    }],
  },
  chakras: {
    title: "Карта энергий: толкование семи уровней",
    lead: "Персональная карта семи уровней в трёх колонках с итогами, повторами и практическим наблюдением без медицинских выводов.",
    rolesTitle: "Семь уровней и три итога",
    rolesLead: "Каждая строка отвечает за свой жизненный уровень, а физика, энергия и эмоции показывают три разных способа проявления одной темы.",
    interactionsTitle: "Ведущие темы и согласование карты",
    interactionsLead: "Итог учитывает максимум и минимум, согласованность колонок, повтор арканов и заметные разрывы между значениями.",
    roles: SECTION_ROLES.chakras,
    edges: [],
  },
  rest: {
    title: "Ваш идеальный формат отдыха",
    lead: "Персональная пара результата радости и центра E: способ переключения и критерий, по которому видно реальное восстановление.",
    rolesTitle: "Формат отдыха и критерий результата",
    rolesLead: "Первая роль предлагает способ переключения, E помогает проверить его по состоянию после отдыха, а не по универсальному списку полезных занятий.",
    interactionsTitle: "Как понять, что отдых сработал",
    interactionsLead: "Связь показывает, какой эксперимент стоит провести и какой наблюдаемый признак отличает восстановление от его имитации.",
    roles: SECTION_ROLES.rest,
    edges: [{ left: "радость", right: "E", title: "Переключение и внутренний критерий", question: "Как выбранный формат отдыха возвращает состояние, из которого снова можно действовать." }],
  },
  loops: {
    title: "Программы: что повторяется по кругу",
    lead: "Персональный разбор D–E–духовное: корень сюжета, состояние автопилота и проверяемая точка выхода.",
    rolesTitle: "Корень, автопилот и выход",
    rolesLead: "Тройка читается как программа только внутри рассчитанного раздела. Произвольные три числа не получают такого названия автоматически.",
    interactionsTitle: "Как замыкается и разрывается круг",
    interactionsLead: "Связи D↔E, E↔духовное и D↔духовное показывают запуск, переход к автоматизму и возможность нового действия.",
    roles: SECTION_ROLES.loops,
    edges: [
      { left: "D", right: "E", title: "От корня к автопилоту", question: "Как возвращающийся сюжет захватывает привычную внутреннюю опору." },
      { left: "E", right: "духовное", title: "От автопилота к точке выхода", question: "Как осознанное качество возвращает возможность выбрать действие." },
      { left: "D", right: "духовное", title: "Корень и новый ответ", question: "Как точка выхода отвечает именно на исходный повтор, а не отвлекает от него." },
    ],
  },
  years: {
    title: "Разбор по десятилетиям до 80 лет",
    lead: "Персональная возрастная линия из восьми этапов с текущим и следующим периодом без гарантированных предсказаний.",
    rolesTitle: "Восемь десятилетий",
    rolesLead: "Каждый аркан задаёт тему периода, сильный способ прохождения, риск и переход. Граница десятилетия меняет ракурс, но не обещает событие в конкретный день.",
    interactionsTitle: "Переходы, повторы и возвращения",
    interactionsLead: "Шкала учитывает соседние переходы, соседний повтор, возвращение аркана через несколько этапов и резкую смену темы.",
    roles: SECTION_ROLES.years,
    edges: [
      ...([0, 1, 2, 3, 4, 5, 6] as const).map((index) => ({
        left: `${index * 10}–${index * 10 + 10}`,
        right: `${index * 10 + 10}–${index * 10 + 20}`,
        title: `Переход ${index * 10 + 10} лет`,
        question: "Как тема одного десятилетия готовит следующий возрастной этап.",
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
export function sectionRoleTemplate(
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
    const questions = edges.map((edge) => edge.question);
    if (left.arcanum === right.arcanum) {
      const content = arcanum(left.arcanum);
      const allRoles = roleKeys.length === items.length;
      return {
        key,
        title: allRoles
          ? `${content.title} во всех ролях`
          : `${content.title} повторяется: позиции ${roleKeys.join(", ")}`,
        roles: roleKeys,
        paragraphs: [
          allRoles
            ? `Один и тот же ${left.arcanum} аркан проходит через весь раздел. Роли не сливаются: каждая отвечает на свой вопрос, но одна тема становится особенно заметной и в ресурсе, и в риске.`
            : `Один и тот же ${left.arcanum} аркан стоит в позициях ${roleKeys.join(", ")}. Это не два независимых сюжета, а усиленная тема, которая проявляется сразу в нескольких звеньях раздела.`,
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
        `${edge.question} В согласованном переходе «${edgeLeft.label} → ${edgeRight.label}» первое качество создаёт условие: ${leftStrength}; второе переводит его дальше: ${rightStrength}.`,
        `Напряжение заметно так: в позиции ${edgeLeft.key} — ${leftRisk}; в позиции ${edgeRight.key} — ${rightRisk}. Это не конфликт арканов, а место, где важно сменить способ действия.`,
        `Практический переход начинается не с попытки проявить оба аркана сразу. Сначала проверьте действие ${edgeLeft.key}: ${edgeLeft.action} Затем добавьте действие ${edgeRight.key}: ${edgeRight.action}`,
      ];
    });
    return {
      key,
      title: edges.length > 1
        ? `${left.title} и ${right.title} сразу в ${edges.length} связях`
        : first.title,
      roles: roleKeys,
      paragraphs: [
        ...(edges.length > 1
          ? [`Пара ${left.arcanum}–${right.arcanum} соединяет несколько ролей. Общий смысл читается один раз, а позиционные переходы показывают разные задачи этой связи.`]
          : []),
        ...contextual,
      ],
      ...(first.context
        ? {
            href: `/encyclopedia/combination/${key}`,
            linkLabel: `Подробнее про сочетание ${key.replace("-", " и ")} аркана в энциклопедии →`,
          }
        : {}),
    };
  });

  const synthesisInteractions = (definition.syntheses ?? []).map((synthesis) => {
    const sources = synthesis.sources.map((key) => byRole.get(key)!);
    const target = byRole.get(synthesis.target)!;
    const sourceLabels = sources.map((role) => `${role.key} — ${role.title}`).join("; ");
    const sourceStrengths = sources.map((role) => `${role.key} — ${cubeClause(role.strength)}`).join("; ");
    const sourceRisks = sources.map((role) => `${role.key} — ${cubeClause(role.risk)}`).join("; ");
    const sourceActions = sources.map((role) => `${role.key}: ${role.action}`).join(" ");
    return {
      key: `synthesis:${synthesis.sources.join("+")}=>${synthesis.target}`,
      title: synthesis.title,
      roles: [...synthesis.sources, synthesis.target],
      paragraphs: [
        `${synthesis.question} Исходные роли читаются вместе: ${sourceLabels}. Итог «${target.label}» не заменяет их, а показывает результат их совместной работы.`,
        `Согласованный переход начинается с двух условий — ${sourceStrengths}. В роли ${target.key} они складываются в качество: ${cubeClause(target.strength)}.`,
        `Разрыв возникает, если один из источников выпадает: ${sourceRisks}. Тогда итог проявляется через риск: ${cubeClause(target.risk)}.`,
        `Практическая проверка идёт в том же порядке. Сначала исходные роли: ${sourceActions} Затем действие итога ${target.key}: ${target.action}`,
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
  ["physics", "Физика"],
  ["energy", "Энергия"],
  ["emotions", "Эмоции"],
] as const;

// Семь пунктов — треть шкалы 1..22. Меньшую разницу описываем как рабочую вариативность,
// а не объявляем любой несовпадающий показатель «заметным дисбалансом».
const CHAKRA_NOTICEABLE_GAP = 7;

/** 22×3 модификатора собираются из аркана и роли колонки; отдельные 462 текста ячеек не нужны. */
export function chakraColumnModifier(
  number: number,
  column: (typeof CHAKRA_COLUMNS)[number][0],
): { modifier: string; action: string } {
  const content = arcanum(number);
  const frames = {
    physics: ["в материальном ритме", "в наблюдаемом распорядке"],
    energy: ["в распределении усилия", "в выборе, куда направлять внимание"],
    emotions: ["в эмоциональном отклике", "в способе замечать и выражать переживание"],
  } as const;
  const [where, actionWhere] = frames[column];
  return {
    modifier: `${content.title} ${where} проявляется через качество «${content.plus[0]}»; перегрузка заметна по тенденции «${content.minus[0]}».`,
    action: `Для наблюдения ${actionWhere} используйте шаг: ${positionRoleTemplate(number, "chakras").action}`,
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
  const names = { physics: "физики", energy: "энергии", emotions: "эмоций" } as const;
  return [
    {
      key: "levels",
      title: "Ведущий и ресурсный уровни",
      roles: [leading.row.title, quiet.row.title],
      caption: `Уровни ${leading.row.title}–${quiet.row.title}`,
      paragraphs: [
        `${leading.row.title} набирает самый заметный суммарный акцент (${leading.score}), поэтому его тема чаще других оказывается на переднем плане. ${quiet.row.title} имеет самый спокойный показатель (${quiet.score}) и может служить местом для бережного, небольшого эксперимента.`,
        "Максимум и минимум не означают «хорошую» и «плохую» чакру: это сравнительные акценты внутри одной карты, а не оценка состояния организма.",
      ],
    },
    {
      key: "imbalance",
      title: "Главный внутренний разрыв карты",
      roles: [mainGap.row.title, mainGap.high.column, mainGap.low.column],
      caption: `Уровень ${mainGap.row.title} · ${mainGap.high.title}–${mainGap.low.title}`,
      paragraphs: [
        `${mainGap.row.title} даёт наибольшую разницу внутри одного уровня: ${mainGap.high.title.toLowerCase()} — ${mainGap.high.value}, ${mainGap.low.title.toLowerCase()} — ${mainGap.low.value}, разрыв — ${mainGap.gap}. ${mainGap.gap >= CHAKRA_NOTICEABLE_GAP ? "По правилу карты это заметный разрыв: способы проявления уровня полезно согласовывать отдельно." : "Разница меньше порога заметного разрыва и описывает обычную вариативность способов проявления."}`,
        "Это сравнительный показатель внутри рассчитанной карты. Он не является медицинским выводом и описывает только различие способов проявления.",
      ],
    },
    {
      key: "columns",
      title: "Согласование трёх колонок",
      roles: [high[0], low[0]],
      caption: `Колонки ${CHAKRA_COLUMNS.find(([key]) => key === high[0])![1]}–${CHAKRA_COLUMNS.find(([key]) => key === low[0])![1]}`,
      paragraphs: [
        `Среди итогов сильнее выделяется колонка ${names[high[0]]} (${high[1]}), спокойнее — колонка ${names[low[0]]} (${low[1]}). Разница ${columnGap} ${columnGap >= CHAKRA_NOTICEABLE_GAP ? "достигает порога заметного разрыва" : "остаётся ниже порога заметного разрыва"} и показывает, насколько способы проявления требуют сознательного согласования.`,
        "Практически полезно найти одно действие, которое можно одновременно увидеть в распорядке, поддержать вниманием и проверить по эмоциональному отклику.",
      ],
    },
    {
      key: "repeats",
      title: "Повторы арканов в карте",
      roles: repeated.map(([number]) => String(number)),
      ...(repeated.length ? { caption: `Повторяющиеся арканы ${repeated.map(([number]) => number).join("–")}` } : {}),
      paragraphs: [
        repeated.length
          ? `Повторяются арканы ${repeated.map(([number, count]) => `${number} (${count} раза)`).join(", ")}. Один смысл проходит через разные уровни и колонки, но каждый раз отвечает на другой вопрос.`
          : "В двадцати одной ячейке нет повторяющихся арканов: связи лучше искать через уровни и итоги колонок, а не придумывать общий повтор.",
        "Повтор усиливает тему, но не создаёт отдельного значения и не является медицинским признаком.",
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

const DECADE_TURNING_THEMES = new Map<number, string>([
  [10, "смену курса"],
  [13, "завершение прежнего этапа"],
  [16, "перестройку неработающей конструкции"],
  [20, "подведение итогов и новый ответ"],
  [21, "завершение большого цикла"],
  [22, "начало нового цикла"],
]);

/** Одна точка матрицы входит в два раздела: «Личное предназначение» стоит и в `purpose`, и в
 *  `realisation`. Рамки роли различают формулировки, но предметный текст один, поэтому читателю,
 *  открывшему оба разбора, повтор объясняется прямо и уводится ссылкой. Замер до рамок и этой
 *  отсылки: `realisation` ~ `purpose` — 214 общих 8-грамм, 37–47 % меньшего разбора. */
const SHARED_ROLES: Partial<Record<PersonalSectionKey, { section: PersonalSectionKey; roles: string[] }>> = {
  realisation: { section: "purpose", roles: ["личное", "социальное"] },
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
    const lead = named
      ? `${labels.join(" и ")} — это ${places.join(" и ")}. Те же позиции читает раздел «${other}»: `
      : `${labels.join(" и ")} — те же позиции, что читает и раздел «${other}»: `;
    return {
      title: `Те же позиции в разделе «${other}»`,
      caption: "Одни и те же позиции карты, два разных вопроса",
      paragraphs: [
        `${lead}там они стоят в другом ряду и отвечают на другой вопрос, но значения арканов те же. ` +
        `Если вы открыли оба разбора, часть текста совпадёт: это не ошибка расчёта, а одни и те же позиции в двух рамках.`,
      ],
    };
  }
  const alias = aliases[0] && aliases[0].toLowerCase() !== places[0]?.toLowerCase()
    ? `там она названа «${aliases[0].toLowerCase()}», `
    : "там она ";
  const lead = named
    ? `${labels[0]} — это ${places[0]}. Ту же позицию читает раздел «${other}»: ${alias}`
    : `${labels[0]} — та же позиция, что читает и раздел «${other}»: ${alias}`;
  return {
    title: `Та же позиция в разделе «${other}»`,
    caption: "Одна позиция карты, два разных вопроса",
    paragraphs: [
      `${lead}стоит в другом ряду и отвечает на другой вопрос, но значение аркана то же. ` +
      `Если вы открыли оба разбора, часть текста совпадёт: это не ошибка расчёта, а одна позиция в двух рамках.`,
    ],
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
      label: `«${role.label.toLowerCase()}»`,
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
        linkLabel: `Открыть разбор «${other}» для этой матрицы →`,
      }
      : {
        // Свой разбор соседнего раздела по этому адресу не найти: одному слагу «Программ»
        // отвечают разные результаты отдыха. Уводим на общую статью — она верна всегда.
        href: positionHref(shared.section),
        linkLabel: `Как читается раздел «${other}» →`,
      }),
  }];
}

export function buildSectionReading(
  section: PersonalSectionKey,
  matrix: Matrix,
  now = new Date(),
): LongformReading {
  const definition = DEFINITIONS[section];
  const roleItems = roles(section, matrix);
  const slug = sectionReadingSlug(section, matrix);
  const title = section === "chakras"
    ? `${definition.title} для матрицы ${matrix.day}–${matrix.month}–${matrix.year}`
    : section === "years"
      ? (matrix.birth
        ? `${definition.title}: ${birthLabel(matrix.birth)}`
        : `${definition.title}: линия ${slug}`)
      : `${definition.title} ${slug}: ${roleItems.map((role) => role.title).join(", ")}`;
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
      caption: "Как читается персональная карта семи уровней",
      chakraRows: rows,
      interactions,
      summary: `Карта соединяет семь уровней и три колонки. Ведущий акцент — ${leading}; вывод строится по значениям всех ячеек, итогам колонок, повторам и разрывам, а не по одному максимальному числу.`,
      strength: "Ресурс карты проявляется, когда материальный ритм, распределение усилия и эмоциональный отклик проверяются вместе и ни одна колонка не объявляется главной навсегда.",
      tension: "Дисбаланс — это заметная разница способов проявления внутри карты, а не заключение о состоянии организма. Безопасный вывод описывает только наблюдаемое поведение.",
      practice: "Выберите один уровень и в течение недели наблюдайте три колонки: что происходит в распорядке, куда уходит усилие и какой отклик остаётся после действия. Меняйте только один небольшой элемент за раз.",
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
      .map(([number, indexes]) => `${number} аркан возвращается на этапах ${indexes.map((index) => `${index * 10}–${index * 10 + 10}`).join(" и ")}`);
    const sharpChangeText = periods.slice(0, -1).flatMap((period, index) => {
      const following = periods[index + 1];
      if (period.arcanum === following.arcanum) return [];
      const markers = [period, following].flatMap((item) => {
        const theme = DECADE_TURNING_THEMES.get(item.arcanum);
        return theme ? [`${item.arcanum} аркан обозначает ${theme}`] : [];
      });
      if (!markers.length) return [];
      return [`Переход ${period.from}–${period.to} → ${following.from}–${following.to} отмечен как резкая смена темы: ${markers.join(", а ")}. Это характеристика смены ракурса, а не обещание события на границе десятилетий.`];
    });
    return {
      ...base,
      layout: "years",
      caption: "Как читается персональная линия до 80 лет",
      agePeriods: periods,
      interactions: [
        ...base.interactions,
        ...(returnText.length ? [{ key: "returns", title: "Возвращение темы", roles: [], paragraphs: [returnText.join("; ") + ". Возврат не повторяет период буквально: прежняя тема встречается с новым опытом."] }] : []),
        ...(sharpChangeText.length ? [{ key: "sharp-changes", title: "Резкая смена темы", roles: [], paragraphs: sharpChangeText }] : []),
      ],
      summary: !known
        ? `Линия ${slug} описывает восемь десятилетий подряд. Текущий этап отмечается только в персональном разборе: откройте раздел из своего расчёта, чтобы линия показала возраст.`
        : currentAge < 80
        ? `Сейчас возраст ${currentAge} лет относится к этапу ${current.from}–${current.to} с ${current.arcanum} арканом ${current.title}. ${next ? `Следующий этап ${next.from}–${next.to} переводит линию к ${next.arcanum} аркану ${next.title}.` : "Это последний этап шкалы до 80 лет."}`
        : `Возраст ${currentAge} лет находится за пределами шкалы до 80. Восемь периодов читаются как пройденная линия опыта, а не как прогноз следующего десятилетия.`,
      strength: !known ? "Сильные стороны линии видны при сравнении десятилетий между собой: одна и та же тема на разных этапах проходит по-разному." : currentAge < 80 ? sentence(current.strength) : "Ресурс линии — возможность сопоставить повторяющиеся темы разных десятилетий с реальными событиями своей биографии.",
      tension: !known ? "Риск линии — читать восемь арканов как расписание событий. Возрастная рамка меняет вопрос этапа, а не обещает происшествие." : currentAge < 80 ? `${sentence(current.risk)} Возрастная рамка не обещает конкретных событий и не отменяет личный выбор.` : "После 80 лет раздел не продолжает формулу произвольными прогнозами.",
      practice: !known ? "Сопоставьте периоды с тем, что происходило на самом деле, и отметьте, какая тема возвращалась. Персональный возраст покажет разбор из вашего расчёта." : currentAge < 80 ? `Для текущего этапа используйте действие: ${current.action}${next ? ` Переход готовит вопрос следующего периода: ${next.essence}` : ""}` : "Отметьте, какие темы возвращались на разных этапах, и отделите подтверждённые факты от поздних объяснений.",
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
export function sectionExampleNote(section: PersonalSectionKey, matrix: Matrix): string {
  const lead = "Общая статья объясняет порядок и границы метода.";
  const code = sectionReadingSlug(section, matrix);
  if (section === "chakras") {
    return `${lead} Карта матрицы ${matrix.day}–${matrix.month}–${matrix.year} показывает все семь уровней в трёх колонках и общий итог каждой колонки.`;
  }
  if (section === "years") {
    return `${lead} Линия ${code} показывает восемь десятилетий подряд, переходы между ними и возвращение темы.`;
  }
  const roles = buildSectionReading(section, matrix).roles
    .filter((role) => !role.sameAs)
    .slice(0, 4)
    .map((role) => `${role.label.toLowerCase()} — ${role.title}`);
  return `${lead} На результате ${code} те же правила читают роли раздела: ${roles.join(", ")}.`;
}

export function sectionReadingSlugs(section: PersonalSectionKey): string[] {
  return [...reachable(section).keys()];
}

export function sectionReadingItem(
  section: PersonalSectionKey,
  slug: string,
): MatrixItem | null {
  if (!/^(?:[1-9]|1\d|2[0-2])(?:-(?:[1-9]|1\d|2[0-2])){1,23}$/.test(slug)) {
    return null;
  }
  return reachable(section).get(slug) ?? null;
}

export function sectionReadingMatrix(
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
