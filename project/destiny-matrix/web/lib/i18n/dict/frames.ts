import type { Phrase } from "./index";

/** Рамки ролей: что делает аркан в этой позиции. Ключи общие, слова у каждого языка свои. */
export const frames = {
  resource_direction: {
    essence: { ru: "В денежном направлении этот аркан задаёт условие движения и удержания ресурса", en: "In the money direction this arcanum sets the condition for moving and holding a resource" } satisfies Phrase,
    strength: { ru: "Ресурс сохраняется, когда человек", en: "The resource is kept when a person" } satisfies Phrase,
    risk: { ru: "Движение теряет устойчивость, когда человек", en: "The movement loses its footing when a person" } satisfies Phrase,
  },
  growth_personal: {
    essence: { ru: "Как личный рост этот аркан показывает качество, которое важно вырастить прежде всего для себя", en: "As personal growth this arcanum shows the quality worth growing first of all for yourself" } satisfies Phrase,
    strength: { ru: "Личный рост идёт, когда человек", en: "Personal growth happens when a person" } satisfies Phrase,
    risk: { ru: "Рост подменяется движением по кругу, когда человек", en: "Growth is replaced by going in circles when a person" } satisfies Phrase,
  },
  growth_social: {
    essence: { ru: "Как польза для других этот аркан показывает, чем личный опыт становится полезен за пределами своей истории", en: "As usefulness to others this arcanum shows how personal experience becomes useful beyond your own story" } satisfies Phrase,
    strength: { ru: "Опыт превращается в пользу, когда человек", en: "Experience turns into usefulness when a person" } satisfies Phrase,
    risk: { ru: "Польза остаётся заявленной, а не сделанной, когда человек", en: "The usefulness stays talked about rather than delivered when a person" } satisfies Phrase,
  },
  loop_root: {
    essence: { ru: "Как корень сценария этот аркан показывает возвращающийся вопрос, с которого начинается знакомый круг", en: "As the root of the scenario this arcanum shows the returning question that starts the familiar circle" } satisfies Phrase,
    strength: { ru: "Круг размыкается, когда человек", en: "The circle opens when a person" } satisfies Phrase,
    risk: { ru: "Круг замыкается снова, когда человек", en: "The circle closes again when a person" } satisfies Phrase,
  },
  loop_autopilot: {
    essence: { ru: "Как состояние автопилота этот аркан описывает привычную опору, которая включается без выбора", en: "As the state of autopilot this arcanum describes the habitual support that switches on without a choice" } satisfies Phrase,
    strength: { ru: "Автоматизм остаётся полезной привычкой, когда человек", en: "The automatism stays a useful habit when a person" } satisfies Phrase,
    risk: { ru: "Опора превращается в автопилот, когда человек", en: "The support turns into autopilot when a person" } satisfies Phrase,
  },
  money_entry_mature: {
    essence: { ru: "Как вход денежной линии этот аркан показывает привычный способ начинать движение — тот, который к зрелому возрасту уже проверен делом", en: "As the entry of the money line this arcanum shows the habitual way of starting to move — the one already proven by deeds by mature age" } satisfies Phrase,
    strength: { ru: "Привычный вход продолжает работать, когда человек", en: "The habitual entry keeps working when a person" } satisfies Phrase,
    risk: { ru: "Привычный вход перестаёт кормить, когда человек", en: "The habitual entry stops bringing money in when a person" } satisfies Phrase,
  },
  money_mature: {
    essence: { ru: "В зрелом денежном направлении этот аркан показывает, что начинает работать лучше через накопленный опыт", en: "In the mature money direction this arcanum shows what starts to work better through accumulated experience" } satisfies Phrase,
    strength: { ru: "Опыт превращается в цену работы, когда человек", en: "Experience turns into the price of the work when a person" } satisfies Phrase,
    risk: { ru: "Зрелый ракурс не срабатывает сам собой, когда человек", en: "The mature angle does not work by itself when a person" } satisfies Phrase,
  },
  family_male_gift: {
    essence: { ru: "Как итог мужской ветви этот аркан показывает дар, который можно превратить в собственную опору", en: "As the total of the male branch this arcanum shows the gift that can be turned into your own support" } satisfies Phrase,
    strength: { ru: "Поддержка мужской ветви проявляется конструктивно, когда человек", en: "The support of the male branch shows constructively when a person" } satisfies Phrase,
    risk: { ru: "Дар превращается в семейную обязанность, когда человек", en: "The gift turns into a family duty when a person" } satisfies Phrase,
  },
  family_female_gift: {
    essence: { ru: "Как итог женской ветви этот аркан показывает дар, который помогает поддерживать жизнь и связи", en: "As the total of the female branch this arcanum shows the gift that helps to keep life and connections going" } satisfies Phrase,
    strength: { ru: "Поддержка женской ветви проявляется конструктивно, когда человек", en: "The support of the female branch shows constructively when a person" } satisfies Phrase,
    risk: { ru: "Поддержка женской ветви становится семейной обязанностью, когда человек", en: "The support of the female branch becomes a family duty when a person" } satisfies Phrase,
  },
  sky_total: {
    essence: { ru: "В итоге неба этот аркан соединяет две исходные духовные задачи в один проверяемый урок", en: "In the total of the sky this arcanum joins the two original spiritual tasks into one lesson that can be checked" } satisfies Phrase,
    strength: { ru: "Общий урок проживается зрело, когда человек", en: "The shared lesson is lived through with maturity when a person" } satisfies Phrase,
    risk: { ru: "Итог повторяет исходные задачи вместо их соединения, когда человек", en: "The total repeats the original tasks instead of joining them when a person" } satisfies Phrase,
  },
  money_choice: {
    essence: { ru: "В точке R этот аркан показывает личный выбор на пересечении денег, договорённостей и отношений", en: "At point R this arcanum shows a personal choice at the crossing of money, agreements and relationships" } satisfies Phrase,
    strength: { ru: "Выбор поддерживает денежное движение, когда человек", en: "The choice supports the movement of money when a person" } satisfies Phrase,
    risk: { ru: "Денежный и партнёрский сценарии спутываются, когда человек", en: "The money and partner scenarios get tangled when a person" } satisfies Phrase,
  },
  ground_total: {
    essence: { ru: "В итоге земли этот аркан показывает, во что складываются материальные решения и насколько результат устойчив", en: "In the total of the earth this arcanum shows what material decisions add up to and how stable the result is" } satisfies Phrase,
    strength: { ru: "Материальная опора становится надёжной, когда человек", en: "The material footing becomes reliable when a person" } satisfies Phrase,
    risk: { ru: "Результат остаётся неустойчивым, когда человек", en: "The result stays unstable when a person" } satisfies Phrase,
  },
  relation_knot: {
    essence: { ru: "В партнёрской точке R1 этот аркан показывает главный внутренний узел близости", en: "At the partner point R1 this arcanum shows the main inner knot of closeness" } satisfies Phrase,
    strength: { ru: "Узел становится местом честного выбора, когда человек", en: "The knot becomes a place of honest choice when a person" } satisfies Phrase,
    risk: { ru: "Привычный сценарий близости усиливается, когда человек", en: "The habitual scenario of closeness gets stronger when a person" } satisfies Phrase,
  },
  relation_form: {
    essence: { ru: "В точке R этот аркан показывает форму союза, договорённостей и совместных решений", en: "At point R this arcanum shows the shape of the union, the agreements and the shared decisions" } satisfies Phrase,
    strength: { ru: "Форма отношений остаётся живой, когда человек", en: "The shape of the relationship stays alive when a person" } satisfies Phrase,
    risk: { ru: "Договорённость подменяет близость или разрушает её, когда человек", en: "An agreement replaces closeness or destroys it when a person" } satisfies Phrase,
  },
  ancestry_male_task: {
    essence: { ru: "Как итог задач мужской ветви этот аркан показывает сценарий, которому требуется новое продолжение", en: "As the total of the tasks of the male branch this arcanum shows a scenario that needs a new continuation" } satisfies Phrase,
    strength: { ru: "Сценарий меняется без отрицания рода, когда человек", en: "The scenario changes without denying the family when a person" } satisfies Phrase,
    risk: { ru: "Старое правило мужской ветви воспроизводится автоматически, когда человек", en: "The old rule of the male branch is reproduced automatically when a person" } satisfies Phrase,
  },
  ancestry_female_task: {
    essence: { ru: "Как итог задач женской ветви этот аркан показывает сценарий, которому требуется новое продолжение", en: "As the total of the tasks of the female branch this arcanum shows a scenario that needs a new continuation" } satisfies Phrase,
    strength: { ru: "Женская ветвь получает новое продолжение, когда человек", en: "The female branch gets a new continuation when a person" } satisfies Phrase,
    risk: { ru: "Старое правило женской ветви воспроизводится автоматически, когда человек", en: "The old rule of the female branch is reproduced automatically when a person" } satisfies Phrase,
  },
  body_total: {
    essence: { ru: "В итоге опоры этот аркан описывает бытовой режим, в котором проще возвращать устойчивость", en: "In the total of support this arcanum describes the everyday routine in which stability comes back more easily" } satisfies Phrase,
    strength: { ru: "Запас поддерживается, когда человек", en: "The reserve is kept up when a person" } satisfies Phrase,
    risk: { ru: "Бытовой ресурс расходуется быстрее, когда человек", en: "The everyday resource is spent faster when a person" } satisfies Phrase,
  },
  rest_result: {
    essence: { ru: "Как результат радости этот аркан показывает способ переключения, который способен вернуть живой интерес", en: "As the result of joy this arcanum shows the way of switching that can bring live interest back" } satisfies Phrase,
    strength: { ru: "Отдых действительно восстанавливает, когда человек", en: "Rest really restores when a person" } satisfies Phrase,
    risk: { ru: "Имитация отдыха оставляет прежнюю перегрузку, когда человек", en: "An imitation of rest leaves the same overload when a person" } satisfies Phrase,
  },
  decade: {
    essence: { ru: "В роли десятилетия этот аркан задаёт тему этапа и вопрос, который постепенно становится главным", en: "In the role of a decade this arcanum sets the theme of the stage and the question that gradually becomes the main one" } satisfies Phrase,
    strength: { ru: "Сильное прохождение периода заметно, когда человек", en: "A strong passage through the period is visible when a person" } satisfies Phrase,
    risk: { ru: "Риск десятилетия усиливается, когда человек", en: "The risk of the decade grows when a person" } satisfies Phrase,
  },
  chakra_physics: {
    essence: { ru: "В физической колонке этот аркан описывает материальный ритм уровня, а не состояние организма", en: "In the physics column this arcanum describes the material rhythm of the level, not the state of the body" } satisfies Phrase,
    strength: { ru: "Ритм уровня согласован, когда человек", en: "The rhythm of the level is in tune when a person" } satisfies Phrase,
    risk: { ru: "Перегрузка материального ритма заметна, когда человек", en: "An overload of the material rhythm is visible when a person" } satisfies Phrase,
  },
  chakra_physics_total: {
    essence: { ru: "В итоге физики этот аркан собирает общий материальный ритм семи уровней без медицинских выводов", en: "In the total of physics this arcanum gathers the shared material rhythm of the seven levels, with no medical conclusions" } satisfies Phrase,
    strength: { ru: "Колонка работает согласованно, когда человек", en: "The column works in tune when a person" } satisfies Phrase,
    risk: { ru: "Общий ритм становится односторонним, когда человек", en: "The shared rhythm becomes one-sided when a person" } satisfies Phrase,
  },
  chakra_energy_total: {
    essence: { ru: "В итоге энергии этот аркан собирает способ распределять усилие между семью уровнями", en: "In the total of energy this arcanum gathers the way effort is distributed between the seven levels" } satisfies Phrase,
    strength: { ru: "Усилие распределяется устойчиво, когда человек", en: "Effort is distributed steadily when a person" } satisfies Phrase,
    risk: { ru: "Энергетический ритм становится односторонним, когда человек", en: "The rhythm of energy becomes one-sided when a person" } satisfies Phrase,
  },
  chakra_emotions_total: {
    essence: { ru: "В итоге эмоций этот аркан собирает характер отклика семи уровней", en: "In the total of emotions this arcanum gathers the character of the response of the seven levels" } satisfies Phrase,
    strength: { ru: "Эмоциональный отклик остаётся гибким, когда человек", en: "The emotional response stays flexible when a person" } satisfies Phrase,
    risk: { ru: "Отклик закрепляется в одном способе, когда человек", en: "The response settles into one way when a person" } satisfies Phrase,
  },
};

/** Возрастные рамки: восемь десятилетий внешнего круга. */
export const decades: Phrase[] = [
  {
    ru: "Рамка 0–10 лет описывает знакомство с базовыми правилами мира и первые способы просить "
      + "поддержку; вывод для взрослого читается как история усвоенного ответа, а не "
      + "характеристика ребёнка задним числом.",
    en: "The 0–10 frame describes the first acquaintance with the basic rules of the world and the "
      + "first ways of asking for support; for an adult it reads as the story of a learned answer, "
      + "not as a verdict on a child in hindsight.",
  },
  {
    ru: "Рамка 10–20 лет рассматривает отделение от готовых правил и первые самостоятельные "
      + "выборы; смысл периода проверяется по тому, какой способ пробовать и ошибаться человек "
      + "перенёс во взрослую жизнь.",
    en: "The 10–20 frame looks at separating from ready-made rules and at the first independent "
      + "choices; the meaning of the period is checked by which way of trying and failing the "
      + "person carried into adult life.",
  },
  {
    ru: "Рамка 20–30 лет задаёт вопрос практического самоопределения: как идеи проверялись делом, "
      + "отношениями и ответственностью за последствия без требования успеть к определённому возрасту.",
    en: "The 20–30 frame asks the question of practical self-definition: how ideas were tested by "
      + "work, by relationships and by responsibility for consequences, without demanding that "
      + "anything be achieved by a certain age.",
  },
  {
    ru: "Рамка 30–40 лет показывает отношение к уже выбранному направлению: что стало устойчивым, "
      + "что держится только по привычке и какой опыт позволяет пересобрать способ действия без "
      + "возрастного кризиса по расписанию.",
    en: "The 30–40 frame shows the attitude to a direction already chosen: what has become stable, "
      + "what is held only by habit, and what experience allows the way of acting to be rebuilt "
      + "without a midlife crisis on schedule.",
  },
  {
    ru: "Рамка 40–50 лет читает аркан через ревизию накопленного опыта и свободу выбирать "
      + "повторно; она не означает автоматической смены работы, отношений или жизненного уклада в "
      + "сорок лет.",
    en: "The 40–50 frame reads the arcanum through a review of accumulated experience and the "
      + "freedom to choose again; it does not mean an automatic change of work, relationships or "
      + "way of life at forty.",
  },
  {
    ru: "Рамка 50–60 лет рассматривает переход от личного опыта к его отбору и передаче: что "
      + "действительно работает, чему можно научить другого и от каких прежних доказательств уже "
      + "допустимо отказаться.",
    en: "The 50–60 frame looks at the move from personal experience to selecting and passing it "
      + "on: what really works, what can be taught to someone else, and which old proofs may now "
      + "be let go.",
  },
  {
    ru: "Рамка 60–70 лет задаёт вопрос избирательности: на какие связи, задачи и формы участия "
      + "стоит направлять внимание, чтобы вклад оставался добровольным и соразмерным текущим "
      + "возможностям.",
    en: "The 60–70 frame asks about selectivity: which connections, tasks and forms of taking part "
      + "deserve attention so that the contribution stays voluntary and matches current strength.",
  },
  {
    ru: "Рамка 70–80 лет помогает соединить пройденные этапы в целую историю, увидеть "
      + "повторяющиеся способы выбора и оставить открытым новый ответ; она не оценивает качество "
      + "или продолжительность жизни.",
    en: "The 70–80 frame helps to join the stages already passed into one story, to see the "
      + "repeating ways of choosing and to leave a new answer open; it judges neither the quality "
      + "nor the length of a life.",
  },
];
