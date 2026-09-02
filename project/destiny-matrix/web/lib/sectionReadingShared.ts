import type { Matrix } from "./matrix";
import type { ReadingConclusion, ReadingRole } from "./readingTypes";
import { buildComfortConclusion, comfortHref, repeatedSummary, COMFORT_ROLE_META } from "./comfortReading";
import { cubeClause, withRepeat } from "./text";

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

/** Безопасные для браузера метаданные ролей; полный корпус трактовок сюда не импортируется. */
export const SECTION_ROLES: Record<PersonalSectionKey, SectionRoleDefinition[]> = {
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
      label: "Исходный дар",
      question: "Какое качество включается естественно и часто не воспринимается человеком как особый талант",
      position: "month",
      value: (matrix) => matrix.talent[0],
    },
    {
      key: "P",
      label: "Форма профессиональной реализации",
      question: "В каких задачах и рабочем формате исходный дар становится полезным результатом",
      position: "profession",
      value: (matrix) => matrix.talent[1],
    },
    {
      key: "K",
      label: "Внутренний результат",
      question: "Как человек понимает, что реализует талант своим способом, а не только выполняет функцию",
      position: "comfort_north",
      value: (matrix) => matrix.talent[2],
    },
  ],
  realisation: [
    { key: "D", label: "Корневая задача", question: "Какой сюжет возвращается и требует нового ответа", position: "mission", value: (matrix) => matrix.mission },
    { key: "личное", label: "Личный рост", question: "Какое качество важно вырастить прежде всего для себя", position: "purpose_personal", variant: "growth_personal", value: (matrix) => matrix.purpose_personal },
    { key: "социальное", label: "Польза для других", question: "Как личный опыт становится устойчивой пользой за пределами своей истории", position: "purpose_social", variant: "growth_social", value: (matrix) => matrix.purpose_social },
  ],
  karma40: [
    { key: "I", label: "Наследство ветви", question: "Какое семейное правило входит в повседневные решения", position: "inheritance", value: (matrix) => matrix.inheritance },
    { key: "J", label: "Автоматическая защита", question: "Как человек привычно восстанавливает контроль в первой части пути", position: "comfort_west", value: (matrix) => matrix.comfort_west },
  ],
  resources: [
    { key: "L", label: "Вход ресурса", question: "Через какое действие открывается движение к благам", position: "comfort_east", value: (matrix) => matrix.comfort_east },
    { key: "R2", label: "Условие удержания ресурса", question: "Какое направление помогает не только получить, но и удержать результат", position: "resources", variant: "resource_direction", value: (matrix) => matrix.money[1] },
  ],
  family_gifts: [
    { key: "F", label: "Принцип мужской ветви", question: "Какой духовный ресурс передаёт мужская ветвь рода", position: "father_line", value: (matrix) => matrix.father_line },
    { key: "G", label: "Принцип женской ветви", question: "Какой духовный ресурс передаёт женская ветвь рода", position: "mother_line", value: (matrix) => matrix.mother_line },
    { key: "итог М", label: "Дар мужской ветви", question: "Во что складывается поддержка мужской ветви в реальных делах", position: "family_gifts", variant: "family_male_gift", value: (matrix) => matrix.social_male[2] },
    { key: "итог Ж", label: "Дар женской ветви", question: "Во что складывается поддержка женской ветви в реальных делах", position: "family_gifts", variant: "family_female_gift", pairedWith: "итог М", value: (matrix) => matrix.social_female[2] },
  ],
  soul_tasks: [
    { key: "B", label: "Первая задача неба", question: "Какой врождённый внутренний вопрос требует внимания", position: "month", value: (matrix) => matrix.month },
    { key: "D", label: "Вторая задача неба", question: "Какой возвращающийся сюжет проверяет первую задачу на практике", position: "mission", value: (matrix) => matrix.mission },
    { key: "итог неба", label: "Общий урок", question: "Какой общий урок возникает из двух исходных задач", position: "soul_tasks", variant: "sky_total", value: (matrix) => matrix.sky[2] },
  ],
  purpose: [
    { key: "личное", label: "Личное предназначение", question: "Что важно прожить и вырастить для себя", position: "purpose_personal", value: (matrix) => matrix.purpose_personal },
    { key: "социальное", label: "Социальное предназначение", question: "Как личный опыт становится полезным другим", position: "purpose_social", value: (matrix) => matrix.purpose_social },
    { key: "духовное", label: "Духовное предназначение", question: "Что соединяет личный и социальный уровни", position: "harmony", value: (matrix) => matrix.harmony },
    { key: "планетарное", label: "Планетарное предназначение", question: "Как тема выходит за рамки личной биографии", position: "planetary", value: (matrix) => matrix.planetary },
  ],
  money: [
    { key: "L", label: "Вход денег", question: "Через какое действие начинается денежное движение", position: "comfort_east", value: (matrix) => matrix.comfort_east },
    { key: "R2", label: "Денежное направление", question: "Какое условие поддерживает движение денег", position: "resources", variant: "resource_direction", value: (matrix) => matrix.money[1] },
    { key: "R", label: "Личный выбор", question: "Где денежный сценарий встречается с решениями и отношениями", position: "money", variant: "money_choice", value: (matrix) => matrix.money[2] },
    { key: "земля", label: "Устойчивость результата", question: "Во что складывается материальная опора линии", position: "money", variant: "ground_total", pairedWith: "R", value: (matrix) => matrix.ground[2] },
  ],
  money40: [
    { key: "R2", label: "Зрелое денежное направление", question: "Что начинает работать лучше через накопленный опыт", position: "money40", variant: "money_mature", value: (matrix) => matrix.money[1] },
    { key: "L", label: "Новая опора входа", question: "Как перечитать привычный способ начинать денежное движение", position: "comfort_east", variant: "money_entry_mature", value: (matrix) => matrix.comfort_east },
  ],
  relations: [
    { key: "M", label: "Вход в близость", question: "Какая первая реакция включается в значимых отношениях", position: "comfort_south", value: (matrix) => matrix.comfort_south },
    { key: "R1", label: "Главный узел", question: "Какой вопрос партнёрства требует осознанного выбора", position: "relations", variant: "relation_knot", value: (matrix) => matrix.love[1] },
    { key: "R", label: "Форма союза", question: "Как личный сценарий проявляется в договорённостях и совместных делах", position: "relations", variant: "relation_form", pairedWith: "R1", value: (matrix) => matrix.love[2] },
    { key: "K", label: "Внутренний ресурс", question: "Какое качество помогает не терять себя в близости", position: "comfort_north", value: (matrix) => matrix.comfort_north },
  ],
  parents_children: [
    { key: "F", label: "Правило мужской ветви", question: "Какой семейный принцип получен по мужской ветви", position: "father_line", value: (matrix) => matrix.father_line },
    { key: "G", label: "Правило женской ветви", question: "Какой семейный принцип получен по женской ветви", position: "mother_line", value: (matrix) => matrix.mother_line },
    { key: "H", label: "Что передаётся дальше", question: "Как полученные правила становятся собственным поведением", position: "descendants", value: (matrix) => matrix.descendants },
  ],
  ancestry: [
    { key: "I", label: "Повторяющееся наследство", question: "Какой родовой принцип входит в повседневные решения", position: "inheritance", value: (matrix) => matrix.inheritance },
    { key: "задача М", label: "Итог задач мужской ветви", question: "Какой сценарий мужской ветви требует нового продолжения", position: "ancestry", variant: "ancestry_male_task", value: (matrix) => matrix.social_male[2] },
    { key: "задача Ж", label: "Итог задач женской ветви", question: "Какой сценарий женской ветви требует нового продолжения", position: "ancestry", variant: "ancestry_female_task", pairedWith: "задача М", value: (matrix) => matrix.social_female[2] },
    { key: "планетарное", label: "Масштаб изменения", question: "Как личная работа со сценарием влияет на более широкий круг", position: "planetary", value: (matrix) => matrix.planetary },
  ],
  body_resource: [
    { key: "C", label: "Бытовая опора", question: "Какая материальная организация помогает сохранять запас", position: "year", value: (matrix) => matrix.year },
    { key: "D", label: "Расход энергии", question: "Какой возвращающийся способ действия расходует или собирает силы", position: "mission", value: (matrix) => matrix.mission },
    { key: "итог", label: "Итог восстановления", question: "Какой наблюдаемый режим помогает возвращать устойчивость", position: "body_resource", variant: "body_total", value: (matrix) => matrix.chakras[6].emotions },
  ],
  chakras: [
    ...([0, 1, 2, 3, 4, 5, 6] as const).map((index) => ({
      key: `физика ${index + 1}`,
      label: `Физика уровня ${index + 1}`,
      question: "Как аркан проявляется в материальном ритме уровня",
      position: "chakras",
      variant: "chakra_physics",
      value: (matrix: Matrix) => matrix.chakras[index].physics,
    })),
    { key: "итог физики", label: "Итог физики", question: "Как складывается материальный ритм карты", position: "chakras", variant: "chakra_physics_total", value: (matrix) => matrix.chakra_totals.physics },
    { key: "итог энергии", label: "Итог энергии", question: "Как складывается способ распределять усилие", position: "chakras", variant: "chakra_energy_total", value: (matrix) => matrix.chakra_totals.energy },
    { key: "итог эмоций", label: "Итог эмоций", question: "Как складывается эмоциональный отклик", position: "chakras", variant: "chakra_emotions_total", value: (matrix) => matrix.chakra_totals.emotions },
  ],
  rest: [
    { key: "радость", label: "Результат радости", question: "Какой способ переключения действительно возвращает живой интерес", position: "rest", variant: "rest_result", value: (matrix) => matrix.chakras[5].emotions },
    { key: "E", label: "Критерий восстановления", question: "Как понять по внутреннему состоянию, что отдых сработал", position: "center", value: (matrix) => matrix.center },
  ],
  loops: [
    { key: "D", label: "Корень сценария", question: "Какой возвращающийся вопрос запускает знакомый круг", position: "mission", variant: "loop_root", value: (matrix) => matrix.mission },
    { key: "E", label: "Состояние автопилота", question: "Как привычная внутренняя опора превращается в автоматизм", position: "center", variant: "loop_autopilot", value: (matrix) => matrix.center },
    { key: "духовное", label: "Точка выхода", question: "Какое качество соединяет опыт с новым действием", position: "harmony", value: (matrix) => matrix.harmony },
  ],
  years: ([0, 1, 2, 3, 4, 5, 6, 7] as const).map((index) => ({
    key: `${index * 10}–${index * 10 + 10}`,
    label: `${index * 10}–${index * 10 + 10} лет`,
    question: "Какая тема задаёт фон десятилетия и готовит переход к следующему этапу",
    position: "years",
    variant: "decade",
    value: (matrix: Matrix) => matrix.age_scale[index].arcanum,
  })),
};

export function sectionRoleMeta(section: PersonalSectionKey, position: string) {
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

export function buildSectionConclusion(
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
      `Линия ${first.arcanum}–${middle.arcanum}–${last.arcanum} читается как путь B→P→K: ${first.title} задаёт исходный дар, ${middle.title} — подходящие задачи и формат труда, а ${last.title} — внутренний результат зрелой реализации. Это не список обязательных профессий, а способ проверить выбранную работу.`,
      repeated,
    ),
    strength:
      `Линия работает согласованно так: в исходном даре ${cubeClause(first.strength)}; ` +
      `в рабочих задачах держится принцип «${middle.strength}»; в результате ${cubeClause(last.strength)}.`,
    tension:
      `Разрыв начинается, когда исходный дар искажается: ${cubeClause(first.risk)}. ` +
      `Неподходящая форма работы заметна по риску: ${cubeClause(middle.risk)}. В итоге ${cubeClause(last.risk)}. ` +
      `Это повод проверить формат задач, а не объявлять всю профессию ошибочной.`,
    practice:
      `Выберите одну рабочую задачу и разложите её по линии: какое качество B вы реально применили, какой формат P помог получить результат и что изменилось во внутреннем состоянии K. ` +
      `Следующий эксперимент берите из действия позиции P: ${middle.action}`,
  };

  // Роль-повтор (`sameAs`) читает ту же позицию и тот же аркан, что названная выше: в итоге
  // она давала вторую дословную копию — «дар мужской ветви: X; дар женской ветви: X».
  const unique = items.filter((item) => !item.sameAs);
  if (section === "purpose") {
    const { carried, gap } = purposeReading(items);
    const ladder = items.map((item) => `${item.label.toLowerCase()} — ${item.title}`).join(", ");
    return {
      summary: withRepeat(
        `Траектория ${ladder} показывает четыре масштаба одной темы: от верности себе до вклада за пределами личной истории.`,
        repeated,
      ),
      strength: carried.length
        ? `Уровень, который уже проживается, виден по повтору: ${carried[0].title} стоит сразу в ролях «${carried.map((item) => item.label.toLowerCase()).join("» и «")}». Значит тема уже переносится через масштаб, а не начинается заново на каждом уровне.`
        : `Ни один аркан не повторяется на двух уровнях, поэтому опорой служит нижний: ${items[0].label.toLowerCase()} — ${items[0].title}. Это единственный масштаб, который можно подтвердить поступком без чужого участия; остальные три расширяют его.`,
      tension: gap
        ? `Разрыв проходит между ролями «${gap[0].label.toLowerCase()}» и «${gap[1].label.toLowerCase()}»: ${gap[0].title} и ${gap[1].title} остаются вне повторяющейся темы, поэтому переход от первого ко второму приходится делать сознательно.`
        : carried.length
          ? `Явного разрыва нет: повторяющаяся тема проходит по всей траектории, и риск здесь другой — принять привычное за уже пройденное.`
          : `Каждый уровень просит своего качества: ${items.map((item) => `${item.label.toLowerCase()} — ${item.title}`).join(", ")}. Одна тема не переносится с уровня на уровень сама, и каждый переход приходится делать отдельным решением.`,
      practice: gap
        ? `Возьмите одно решение последнего месяца и проверьте его на границе «${gap[0].label.toLowerCase()} → ${gap[1].label.toLowerCase()}»: что вы сделали для себя и что из этого стало полезно другим. Подсказка: ${last.action}`
        : `Возьмите одно решение последнего месяца и проверьте, на каком из четырёх уровней оно подтверждено поступком, а на каком осталось намерением. Подсказка: ${last.action}`,
    };
  }

  const labels = items.map((item) => `${item.key} — ${item.title}`).join(", ");
  const strength = unique.map((item) => `${item.label.toLowerCase()} — ${cubeClause(item.strength)}`).join("; ");
  const risks = unique.map((item) => `${item.label.toLowerCase()} — ${cubeClause(item.risk)}`).join("; ");
  const summaries: Partial<Record<PersonalSectionKey, string>> = {
    realisation: `Путь ${labels} связывает корневую задачу, личный рост и пользу для других: следующий уровень не отменяет предыдущий, а переводит его в более широкий масштаб.`,
    karma40: `Пара ${labels} описывает наследуемое правило и привычный способ защищать внутреннюю опору в первой части пути. Возрастная граница здесь задаёт ракурс чтения, а не обещает событие в день сорокалетия.`,
    resources: `Связка ${labels} показывает вход в ресурс и условие, при котором результат удаётся удерживать. Она не обещает богатства и проверяется только через реальные решения.`,
    family_gifts: `Четыре роли ${labels} показывают поддержку обеих ветвей и два разных способа превратить её в собственную силу, не оценивая семью и не назначая виноватых.`,
    soul_tasks: `Три роли ${labels} соединяют две исходные внутренние задачи с общим уроком, который можно проверить по повторяющимся решениям.`,
    purpose: `Траектория ${labels} показывает четыре масштаба одной темы: от верности себе до вклада за пределами личной истории.`,
    money: `Линия ${labels} описывает вход, направление, личный выбор и устойчивость денежного результата, но не прогнозирует сумму или дату дохода.`,
    money40: `Зрелый ракурс ${labels} показывает, как накопленный опыт меняет привычный денежный вход; формула не переключается автоматически в день сорокалетия.`,
    relations: `Сценарий ${labels} описывает способ входить в близость, проходить главный узел, строить договорённости и сохранять внутренний ресурс. Это не совместимость двух дат и не прогноз брака.`,
    parents_children: `Связка ${labels} показывает два полученных семейных правила и то, как они продолжаются в собственном поведении — независимо от того, есть ли у человека дети.`,
    ancestry: `Четыре роли ${labels} показывают повторяющийся родовой сценарий и масштаб его изменения; формула не считает семь отдельных поколений и не говорит о «проклятиях».`,
    body_resource: `Связка ${labels} описывает бытовую устойчивость, расход запаса и наблюдаемый способ восстановления. Это не заключение о состоянии организма и не профильная рекомендация.`,
    rest: `Пара ${labels} соединяет способ переключения с проверяемым признаком восстановления: после подходящего отдыха возвращаются ясность и способность действовать.`,
    loops: `Связка ${labels} показывает корень повторяющегося сюжета, состояние автопилота и точку выхода. Тройка становится «программой» только как часть рассчитанного раздела, а не сама по себе.`,
  };
  const practices: Partial<Record<PersonalSectionKey, string>> = {
    realisation: `Возьмите один повторяющийся сюжет D и запишите: какой новый личный ответ возможен, кому он станет полезен и какое действие можно выполнить за неделю. Начните с подсказки последней роли: ${last.action}`,
    karma40: `Найдите одно семейное правило, которое включилось автоматически, и проверьте его на нынешней ситуации. Сохраните полезную часть I, а для нового ответа используйте действие J: ${last.action}`,
    resources: `Выберите один небольшой результат и проверьте оба звена: что открыло вход L и какое действие R2 поможет удержать движение без обещаний быстрого достатка. Подсказка: ${last.action}`,
    family_gifts: `Назовите по одному реально полученному ресурсу каждой ветви и выберите один способ применить их без долга и обвинений. Начните с действия последней роли: ${last.action}`,
    soul_tasks: `В одной ситуации разделите две исходные задачи и общий урок: что требовала B, что возвращала D и какое действие проверит итог неба. Подсказка: ${last.action}`,
    purpose: `Отметьте, какой из четырёх уровней уже подтверждён поступками, где возникает разрыв и какой один шаг соединит личное решение с пользой для других. Подсказка: ${last.action}`,
    money: `Разберите один денежный эпизод по четырём звеньям и выберите эксперимент, который можно измерить не суммой обещанного дохода, а выполненным действием. Подсказка: ${last.action}`,
    money40: `Сравните один привычный денежный способ с тем, что теперь даёт накопленный опыт, и проведите небольшой эксперимент без ожидания резкого возрастного перелома. Подсказка: ${last.action}`,
    relations: `Возьмите один реальный разговор и отметьте первую реакцию, главный узел, форму договорённости и способ сохранить себя. Начните с действия K: ${last.action}`,
    parents_children: `Вспомните одно семейное правило, которое повторяется в общении с близкими, и сформулируйте способ передать его ценность без автоматической жёсткости. Подсказка: ${last.action}`,
    ancestry: `Выберите один подтверждённый семейный сценарий, разделите вклады двух ветвей и определите действие, которое меняет продолжение сейчас. Подсказка: ${last.action}`,
    body_resource: `В течение недели отмечайте режим, после которого возвращается бытовая устойчивость, не превращая наблюдение в медицинский вывод. Начните с действия итога: ${last.action}`,
    rest: `Проведите недельный эксперимент с одним форматом отдыха и оцените его по ясному признаку E: стало ли проще возвращаться к своим делам. Подсказка: ${last.action}`,
    loops: `Запишите один полный круг «триггер → автопилот → последствия» и заранее выберите действие точки выхода. Подсказка: ${last.action}`,
  };
  return {
    summary: withRepeat(
      summaries[section] ?? `Последовательность ${labels} читается как единый раздел с разными ролями.`,
      repeated,
    ),
    strength: `Согласованный вариант заметен так: ${strength}.`,
    tension: `Разрыв между ролями можно проверить по признакам: ${risks}. Это рабочие гипотезы для наблюдения, а не неизменные свойства человека.`,
    practice: practices[section] ?? `Проверьте последовательность на одной реальной ситуации и начните с действия последней роли: ${last.action}`,
  };
}

export function sectionReadingSlug(section: PersonalSectionKey, matrix: Matrix): string {
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

export function sectionReadingHref(section: PersonalSectionKey, matrix: Matrix): string {
  if (section === "comfort") return comfortHref(matrix);
  const path = `/encyclopedia/${section}/${sectionReadingSlug(section, matrix)}`;
  if (section === "years") return `${path}?birth=${matrix.birth}`;
  return path;
}
