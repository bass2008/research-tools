import type { Phrase } from "./index";

/** Каркас персональных разборов: заголовки, вводки и подписи связей каждого раздела. */
export const sectionDefs = {
  comfort: {
    title: { ru: "Центр и внутренние точки", en: "The centre and the inner points" } satisfies Phrase,
    lead: { ru: "Персональный разбор центра E, автоматической реакции M и таланта K, который помогает вернуть управление.", en: "A personal reading of the centre E, the automatic reaction M and the talent K that helps you take control back." } satisfies Phrase,
    rolesTitle: { ru: "Три внутренних ориентира", en: "Three inner landmarks" } satisfies Phrase,
    rolesLead: { ru: "E показывает базовое состояние, M — первую реакцию без подготовки, K — качество, через которое проще вернуться к себе. Точки отвечают на разные вопросы и читаются вместе.", en: "E shows the basic state, M the first reaction without preparation, K the quality that makes it easier to come back to yourself. The points answer different questions and are read together." } satisfies Phrase,
    interactionsTitle: { ru: "Как внутренние точки влияют друг на друга", en: "How the inner points affect each other" } satisfies Phrase,
    interactionsLead: { ru: "Сначала читаются роли E, M и K, затем три связи между ними. Повтор одного аркана усиливает общую тему, но не превращает разные точки в одну.", en: "First the roles E, M and K are read, then the three links between them. A repeated arcanum strengthens the shared theme but does not turn different points into one." } satisfies Phrase,
    edges: {
      "E|M": {
        title: { ru: "Опора и автоматическая реакция", en: "Footing and automatic reaction" } satisfies Phrase,
        question: { ru: "Эта связь показывает, сохраняется ли внутренний центр в момент первой реакции.", en: "This link shows whether the inner centre survives the moment of the first reaction." } satisfies Phrase,
      },
      "E|K": {
        title: { ru: "Опора и возвращающий талант", en: "Footing and the talent that gives control back" } satisfies Phrase,
        question: { ru: "Эта связь показывает, какое врождённое качество поддерживает базовое состояние.", en: "This link shows which inborn quality supports the basic state." } satisfies Phrase,
      },
      "M|K": {
        title: { ru: "От реакции к управлению", en: "From reaction to control" } satisfies Phrase,
        question: { ru: "Эта связь показывает, как превратить автоматическую реакцию в осознанное действие.", en: "This link shows how to turn an automatic reaction into a conscious action." } satisfies Phrase,
      },
    },
  },
  profession: {
    title: { ru: "Профессия и дело по душе", en: "Profession and work you love" } satisfies Phrase,
    lead: { ru: "Персональный разбор линии таланта B–P–K: исходный дар, подходящая форма работы и внутренний результат реализации.", en: "A personal reading of the talent line B–P–K: the original gift, the suitable shape of work and the inner result of realisation." } satisfies Phrase,
    rolesTitle: { ru: "Три звена профессиональной реализации", en: "Three links of professional realisation" } satisfies Phrase,
    rolesLead: { ru: "B показывает исходное качество, P — задачи и формат труда, K — состояние, к которому приводит зрелая реализация. Линия описывает способ работать, а не назначает единственную профессию.", en: "B shows the original quality, P the tasks and format of work, K the state that mature realisation leads to. The line describes a way of working; it does not assign one single profession." } satisfies Phrase,
    interactionsTitle: { ru: "Как талант превращается в дело", en: "How talent turns into work" } satisfies Phrase,
    interactionsLead: { ru: "Линия читается в порядке B→P→K, а затем проверяется прямая связь B↔K. Повторы усиливают одну тему; разные арканы показывают, где нужен перевод из качества в рабочее действие.", en: "The line is read in the order B→P→K, and then the direct link B↔K is checked. Repetitions strengthen one theme; different arcana show where a quality has to be translated into a working action." } satisfies Phrase,
    edges: {
      "B|P": {
        title: { ru: "От дара к рабочей задаче", en: "From the gift to the work task" } satisfies Phrase,
        question: { ru: "Эта связь показывает, как естественное качество становится конкретным способом работать.", en: "This link shows how a natural quality becomes a concrete way of working." } satisfies Phrase,
      },
      "P|K": {
        title: { ru: "От работы к внутреннему результату", en: "From work to the inner result" } satisfies Phrase,
        question: { ru: "Эта связь показывает, даёт ли выбранный формат труда ощущение собственной реализации.", en: "This link shows whether the chosen format of work gives a sense of your own realisation." } satisfies Phrase,
      },
      "B|K": {
        title: { ru: "Дар и итог реализации", en: "The gift and the result of realisation" } satisfies Phrase,
        question: { ru: "Эта связь проверяет, сохранилось ли исходное качество в конечном результате.", en: "This link checks whether the original quality survived into the final result." } satisfies Phrase,
      },
    },
  },
  realisation: {
    title: { ru: "Путь самореализации", en: "The path of self-realisation" } satisfies Phrase,
    lead: { ru: "Персональный путь от возвращающейся задачи D через личный рост к пользе для других.", en: "A personal path from the returning task D through personal growth to usefulness for others." } satisfies Phrase,
    rolesTitle: { ru: "Три уровня пути", en: "Three levels of the path" } satisfies Phrase,
    rolesLead: { ru: "D показывает корневой повтор, личное предназначение — внутреннее изменение, социальное — форму пользы. Это последовательность, а не три конкурирующие миссии.", en: "D shows the root repetition, the personal purpose the inner change, the social one the shape of usefulness. This is a sequence, not three competing missions." } satisfies Phrase,
    interactionsTitle: { ru: "Как задача становится реализацией", en: "How a task becomes realisation" } satisfies Phrase,
    interactionsLead: { ru: "Основной ход читается D→личное→социальное; прямая связь D↔социальное нужна как проверка, не потерян ли исходный опыт на большем масштабе.", en: "The main move reads D→personal→social; the direct link D↔social is needed as a check that the original experience is not lost at the larger scale." } satisfies Phrase,
    edges: {
      "D|personal": {
        title: { ru: "От повтора к личному росту", en: "From repetition to personal growth" } satisfies Phrase,
        question: { ru: "Как новый ответ на корневую задачу меняет самого человека.", en: "How a new answer to the root task changes the person." } satisfies Phrase,
      },
      "personal|social": {
        title: { ru: "От личного роста к пользе", en: "From personal growth to usefulness" } satisfies Phrase,
        question: { ru: "Как внутреннее изменение становится полезным другим.", en: "How an inner change becomes useful to others." } satisfies Phrase,
      },
      "D|social": {
        title: { ru: "Корень и социальный масштаб", en: "The root and the social scale" } satisfies Phrase,
        question: { ru: "Сохраняется ли смысл исходной задачи на большем масштабе.", en: "Whether the meaning of the original task survives at the larger scale." } satisfies Phrase,
      },
    },
  },
  karma40: {
    title: { ru: "Кармическая задача до 40 лет", en: "Karmic task before 40" } satisfies Phrase,
    lead: { ru: "Персональный возрастной ракурс I–J без обещания автоматического события или перелома ровно в сорок лет.", en: "A personal age angle on I–J, with no promise of an automatic event or a turning point exactly at forty." } satisfies Phrase,
    rolesTitle: { ru: "Наследство и способ защиты", en: "Inheritance and the way of defending" } satisfies Phrase,
    rolesLead: { ru: "I показывает семейное наследство в повседневных решениях, J — привычный способ согласовать внешний образ с внутренней опорой.", en: "I shows the family inheritance in everyday decisions, J the habitual way of bringing the outer image into line with the inner footing." } satisfies Phrase,
    interactionsTitle: { ru: "Как наследство становится задачей первой части пути", en: "How inheritance becomes the task of the first half of the path" } satisfies Phrase,
    interactionsLead: { ru: "Связь I↔J показывает, какое правило человек защищает автоматически и как сохранить его ресурс без прежнего перекоса.", en: "The link I↔J shows which rule a person defends automatically and how to keep its resource without the old imbalance." } satisfies Phrase,
    edges: {
      "I|J": {
        title: { ru: "Наследство и автоматическая защита", en: "Inheritance and automatic defence" } satisfies Phrase,
        question: { ru: "Как семейное правило влияет на привычный способ восстанавливать контроль.", en: "How a family rule affects the habitual way of taking control back." } satisfies Phrase,
      },
    },
  },
  resources: {
    title: { ru: "Что открывает вам блага и ресурс", en: "What opens wealth and resource for you" } satisfies Phrase,
    lead: { ru: "Персональная связка L→R2: вход в ресурс, условие его удержания, возможная блокировка и практический шаг.", en: "A personal link L→R2: the entry into a resource, the condition for keeping it, a possible blockage and a practical step." } satisfies Phrase,
    rolesTitle: { ru: "Два звена ресурсного канала", en: "Two links of the resource channel" } satisfies Phrase,
    rolesLead: { ru: "L показывает первый способ включиться в движение, R2 — направление, которое помогает превратить импульс в устойчивый результат.", en: "L shows the first way of joining the movement, R2 the direction that helps turn an impulse into a stable result." } satisfies Phrase,
    interactionsTitle: { ru: "От входа к удержанию", en: "From entry to keeping" } satisfies Phrase,
    interactionsLead: { ru: "Пара читается по направлению L→R2. Она описывает способ действовать и не является обещанием богатства.", en: "The pair is read in the direction L→R2. It describes a way of acting and is not a promise of wealth." } satisfies Phrase,
    edges: {
      "L|R2": {
        title: { ru: "Вход и условие удержания", en: "Entry and the condition for keeping" } satisfies Phrase,
        question: { ru: "Что помогает первому импульсу стать устойчивым движением.", en: "What helps the first impulse become steady movement." } satisfies Phrase,
      },
    },
  },
  family_gifts: {
    title: { ru: "Поддержка и дары вашего рода", en: "Support and gifts of your family line" } satisfies Phrase,
    lead: { ru: "Персональный разбор двух родовых ветвей и двух разных итогов их поддержки без оценки семьи и поиска виноватых.", en: "A personal reading of the two family branches and the two different totals of their support, without judging the family or looking for someone to blame." } satisfies Phrase,
    rolesTitle: { ru: "Две ветви и два дара", en: "Two branches and two gifts" } satisfies Phrase,
    rolesLead: { ru: "F и G называют исходные принципы ветвей, а два итога показывают, во что их поддержка складывается в собственной жизни человека.", en: "F and G name the original principles of the branches, and the two totals show what their support adds up to in a person's own life." } satisfies Phrase,
    interactionsTitle: { ru: "Как взаимодействуют ветви и итоги", en: "How the branches and the totals interact" } satisfies Phrase,
    interactionsLead: { ru: "Читаются четыре значимые связи вместо механического перебора всех шести пар: каждая ветвь со своим итогом, связь исходных правил и связь двух даров.", en: "Four meaningful links are read instead of mechanically going through all six pairs: each branch with its own total, the link between the original rules and the link between the two gifts." } satisfies Phrase,
    edges: {
      "F|total_m": {
        title: { ru: "Мужская ветвь и её дар", en: "The male branch and its gift" } satisfies Phrase,
        question: { ru: "Как принцип мужской ветви становится доступной силой.", en: "How the principle of the male branch becomes available strength." } satisfies Phrase,
      },
      "G|total_f": {
        title: { ru: "Женская ветвь и её дар", en: "The female branch and its gift" } satisfies Phrase,
        question: { ru: "Как принцип женской ветви становится доступной силой.", en: "How the principle of the female branch becomes available strength." } satisfies Phrase,
      },
      "F|G": {
        title: { ru: "Два исходных правила", en: "Two original rules" } satisfies Phrase,
        question: { ru: "Где принципы ветвей поддерживают или уточняют друг друга.", en: "Where the principles of the branches support or refine each other." } satisfies Phrase,
      },
      "total_m|total_f": {
        title: { ru: "Взаимодействие двух даров", en: "How the two gifts interact" } satisfies Phrase,
        question: { ru: "Как две формы поддержки могут работать вместе.", en: "How two forms of support can work together." } satisfies Phrase,
      },
    },
  },
  soul_tasks: {
    title: { ru: "Духовные задачи и уроки души", en: "Spiritual tasks and lessons of the soul" } satisfies Phrase,
    lead: { ru: "Персональный разбор двух исходных задач B и D и итога неба, который соединяет их в один урок.", en: "A personal reading of the two original tasks B and D and of the total of the sky that joins them into one lesson." } satisfies Phrase,
    rolesTitle: { ru: "Две задачи и общий итог", en: "Two tasks and a shared total" } satisfies Phrase,
    rolesLead: { ru: "B и D отвечают на разные исходные вопросы, а итог неба показывает способ удержать обе задачи вместе. Даже при совпадении номера итог остаётся отдельной ролью и не дублирует исходную точку дословно.", en: "B and D answer different original questions, and the total of the sky shows a way to hold both tasks together. Even when the numbers coincide, the total stays a separate role and does not repeat the original point word for word." } satisfies Phrase,
    interactionsTitle: { ru: "Как две задачи образуют общий урок", en: "How two tasks form a shared lesson" } satisfies Phrase,
    interactionsLead: { ru: "Сначала сравниваются B и D, затем их связь переводится в итог неба. Повтор аркана усиливает тему, но не отменяет разницу ролей.", en: "First B and D are compared, then their link is translated into the total of the sky. A repeated arcanum strengthens the theme but does not cancel the difference between the roles." } satisfies Phrase,
    syntheses: {
      "B, D|sky_total": {
        title: { ru: "От пары к общему уроку", en: "From the pair to the shared lesson" } satisfies Phrase,
        question: { ru: "Как две исходные задачи вместе образуют итог неба и проверяются действием.", en: "How the two original tasks together form the total of the sky and are tested by an action." } satisfies Phrase,
      },
    },
    edges: {
      "B|D": {
        title: { ru: "Две исходные задачи", en: "Two original tasks" } satisfies Phrase,
        question: { ru: "Как врождённый вопрос встречается с возвращающимся жизненным сюжетом.", en: "How an inborn question meets a returning storyline of life." } satisfies Phrase,
      },
    },
  },
  purpose: {
    title: { ru: "Ваше предназначение", en: "Your purpose" } satisfies Phrase,
    lead: { ru: "Персональная траектория четырёх уровней: личного, социального, духовного и планетарного.", en: "A personal trajectory of four levels: personal, social, spiritual and planetary." } satisfies Phrase,
    rolesTitle: { ru: "Четыре масштаба одной темы", en: "Four scales of one theme" } satisfies Phrase,
    rolesLead: { ru: "Уровни не назначают четыре разных дела. Каждый следующий показывает, как уже прожитое качество расширяет масштаб влияния.", en: "The levels do not assign four different occupations. Each next one shows how a quality you already live widens the scale of its influence." } satisfies Phrase,
    interactionsTitle: { ru: "Как соединяются уровни предназначения", en: "How the levels of purpose join together" } satisfies Phrase,
    interactionsLead: { ru: "Граф читается личное→социальное, затем оба уровня соединяются в духовном, а духовный переводится в планетарный масштаб.", en: "The graph reads personal→social, then both levels join in the spiritual one, and the spiritual is translated into the planetary scale." } satisfies Phrase,
    syntheses: {
      "personal, social|spiritual": {
        title: { ru: "Личное и социальное образуют духовный уровень", en: "The personal and the social form the spiritual level" } satisfies Phrase,
        question: { ru: "Как верность себе и подтверждённая польза другим вместе создают общее направление.", en: "How being true to yourself and confirmed usefulness to others together create one shared direction." } satisfies Phrase,
      },
    },
    edges: {
      "personal|social": {
        title: { ru: "От себя к пользе другим", en: "From yourself to usefulness to others" } satisfies Phrase,
        question: { ru: "Как личное качество становится социальной ролью.", en: "How a personal quality becomes a social role." } satisfies Phrase,
      },
      "spiritual|planetary": {
        title: { ru: "От смысла к большему масштабу", en: "From meaning to a wider scale" } satisfies Phrase,
        question: { ru: "Как направление выходит за рамки личной биографии.", en: "How a direction reaches beyond a personal biography." } satisfies Phrase,
      },
    },
  },
  money: {
    title: { ru: "Деньги в матрице судьбы", en: "Money in the destiny matrix" } satisfies Phrase,
    lead: { ru: "Персональная денежная линия L→R2→R→земля: вход, направление, личный выбор и устойчивость результата.", en: "A personal money line L→R2→R→earth: the entry, the direction, the personal choice and the stability of the result." } satisfies Phrase,
    rolesTitle: { ru: "Четыре звена денежного движения", en: "Four links of the movement of money" } satisfies Phrase,
    rolesLead: { ru: "Линия показывает логику решений, а не прогноз суммы: L запускает движение, R2 удерживает направление, R добавляет выбор, итог земли проверяет устойчивость.", en: "The line shows the logic of decisions, not a forecast of an amount: L starts the movement, R2 holds the direction, R adds the choice, and the total of the earth tests the stability." } satisfies Phrase,
    interactionsTitle: { ru: "Как деньги проходят по линии", en: "How money moves along the line" } satisfies Phrase,
    interactionsLead: { ru: "Основные переходы читаются последовательно. Связь входа с итогом используется только в общем выводе, чтобы не дублировать три промежуточных шага.", en: "The main transitions are read one after another. The link between the entry and the total is used only in the general conclusion, so that the three intermediate steps are not repeated." } satisfies Phrase,
    edges: {
      "L|R2": {
        title: { ru: "От входа к направлению", en: "From entry to direction" } satisfies Phrase,
        question: { ru: "Как первый импульс становится повторяемым способом действия.", en: "How the first impulse becomes a repeatable way of acting." } satisfies Phrase,
      },
      "R2|R": {
        title: { ru: "От направления к личному выбору", en: "From direction to personal choice" } satisfies Phrase,
        question: { ru: "Где правило движения встречается с договорённостями и решениями.", en: "Where the rule of movement meets agreements and decisions." } satisfies Phrase,
      },
      "R|ground_total": {
        title: { ru: "От выбора к устойчивому результату", en: "From choice to a stable result" } satisfies Phrase,
        question: { ru: "Как решение закрепляется в материальной опоре.", en: "How a decision settles into a material footing." } satisfies Phrase,
      },
    },
  },
  money40: {
    title: { ru: "Как меняются деньги после 40 лет", en: "How money changes after 40" } satisfies Phrase,
    lead: { ru: "Персональный зрелый ракурс R2–L: накопленный опыт, новая опора и проверяемый денежный эксперимент.", en: "A personal mature angle on R2–L: accumulated experience, a new footing and a money experiment you can check." } satisfies Phrase,
    rolesTitle: { ru: "Направление и вход в зрелом ракурсе", en: "Direction and entry in the mature angle" } satisfies Phrase,
    rolesLead: { ru: "Арканы не меняются автоматически по возрасту. Меняется порядок вопроса: сначала рассматривается накопленное направление R2, затем привычный вход L.", en: "The arcana do not change automatically with age. What changes is the order of the question: first the accumulated direction R2, then the habitual entry L." } satisfies Phrase,
    interactionsTitle: { ru: "Что перестаёт работать по-старому", en: "What stops working the old way" } satisfies Phrase,
    interactionsLead: { ru: "Связь R2↔L читается отдельно от раздела ресурсов: здесь важен опыт, который позволяет пересобрать способ начинать денежное движение.", en: "The link R2↔L is read separately from the resources section: here what matters is the experience that lets you rebuild the way you start the movement of money." } satisfies Phrase,
    edges: {
      "R2|L": {
        title: { ru: "Зрелое направление и новая опора", en: "Mature direction and a new footing" } satisfies Phrase,
        question: { ru: "Как накопленный опыт меняет привычный денежный вход без резкого возрастного перелома.", en: "How accumulated experience changes the habitual money entry without a sharp turn with age." } satisfies Phrase,
      },
    },
  },
  relations: {
    title: { ru: "Отношения в матрице судьбы", en: "Relationships in the destiny matrix" } satisfies Phrase,
    lead: { ru: "Персональный сценарий близости M→R1→R с внутренним ресурсом K — без подмены совместимостью двух дат.", en: "A personal scenario of closeness M→R1→R with the inner resource K — without replacing it by the compatibility of two dates." } satisfies Phrase,
    rolesTitle: { ru: "Четыре роли личного сценария близости", en: "Four roles of a personal scenario of closeness" } satisfies Phrase,
    rolesLead: { ru: "M показывает вход, R1 — главный узел, R — форму договорённостей, K — качество, которое помогает сохранять себя.", en: "M shows the entry, R1 the main knot, R the shape of agreements, K the quality that helps you keep yourself." } satisfies Phrase,
    interactionsTitle: { ru: "Как складывается сценарий отношений", en: "How the scenario of relationships takes shape" } satisfies Phrase,
    interactionsLead: { ru: "Три последовательные связи показывают развитие сценария; прямая M↔K остаётся частью вывода и не дублирует уже прочитанные переходы.", en: "Three consecutive links show how the scenario develops; the direct M↔K stays part of the conclusion and does not repeat the transitions already read." } satisfies Phrase,
    edges: {
      "M|R1": {
        title: { ru: "От входа к главному узлу", en: "From entry to the main knot" } satisfies Phrase,
        question: { ru: "Как первая реакция создаёт основной вопрос близости.", en: "How the first reaction creates the main question of closeness." } satisfies Phrase,
      },
      "R1|R": {
        title: { ru: "От узла к форме союза", en: "From the knot to the shape of the union" } satisfies Phrase,
        question: { ru: "Как внутренний вопрос становится договорённостью или повтором.", en: "How an inner question becomes an agreement or a repetition." } satisfies Phrase,
      },
      "R|K": {
        title: { ru: "Форма союза и внутренний ресурс", en: "The shape of the union and the inner resource" } satisfies Phrase,
        question: { ru: "Как сохранять себя внутри совместных решений.", en: "How to keep yourself inside shared decisions." } satisfies Phrase,
      },
    },
  },
  parents_children: {
    title: { ru: "Карма отношений с родителями и детьми", en: "Karma of relationships with parents and children" } satisfies Phrase,
    lead: { ru: "Персональный разбор двух полученных семейных правил и того, как они продолжаются в собственном поведении.", en: "A personal reading of two family rules you received and of how they continue in your own behaviour." } satisfies Phrase,
    rolesTitle: { ru: "Полученные правила и их продолжение", en: "The rules you received and their continuation" } satisfies Phrase,
    rolesLead: { ru: "F и G показывают принципы двух ветвей, H — не прогноз детей, а способ, которым человек передаёт эти правила дальше в любых близких и зависимых отношениях.", en: "F and G show the principles of the two branches; H is not a forecast about children but the way a person passes these rules on in any close or dependent relationship." } satisfies Phrase,
    interactionsTitle: { ru: "Как семейные правила влияют друг на друга", en: "How family rules affect each other" } satisfies Phrase,
    interactionsLead: { ru: "Три связи помогают отделить ценность каждого правила от автоматического повторения и подходят пользователю независимо от наличия детей.", en: "Three links help to separate the value of each rule from its automatic repetition, and they work for a reader whether or not they have children." } satisfies Phrase,
    edges: {
      "F|G": {
        title: { ru: "Два полученных правила", en: "Two rules received" } satisfies Phrase,
        question: { ru: "Где принципы ветвей поддерживают или оспаривают друг друга.", en: "Where the principles of the branches support or contradict each other." } satisfies Phrase,
      },
      "F|H": {
        title: { ru: "Мужская ветвь и продолжение", en: "The male branch and its continuation" } satisfies Phrase,
        question: { ru: "Как правило мужской ветви становится собственным поведением.", en: "How the rule of the male branch becomes your own behaviour." } satisfies Phrase,
      },
      "G|H": {
        title: { ru: "Женская ветвь и продолжение", en: "The female branch and its continuation" } satisfies Phrase,
        question: { ru: "Как правило женской ветви становится собственным поведением.", en: "How the rule of the female branch becomes your own behaviour." } satisfies Phrase,
      },
    },
  },
  ancestry: {
    title: { ru: "Родовые задачи до седьмого колена", en: "Family tasks down to the seventh generation" } satisfies Phrase,
    lead: { ru: "Персональный широкий родовой ракурс: наследство I, итоги задач двух ветвей и масштаб изменения.", en: "A personal wide family angle: the inheritance I, the totals of the tasks of the two branches and the scale of the change." } satisfies Phrase,
    rolesTitle: { ru: "Наследство, две ветви и масштаб", en: "Inheritance, two branches and the scale" } satisfies Phrase,
    rolesLead: { ru: "Формула не рассчитывает семь отдельных поколений. Она соединяет текущее наследство, два разных итога задач ветвей и планетарный уровень.", en: "The formula does not calculate seven separate generations. It joins the current inheritance, the two different totals of the branch tasks and the planetary level." } satisfies Phrase,
    interactionsTitle: { ru: "Как повторяющийся сценарий меняет продолжение", en: "How a repeating scenario changes its continuation" } satisfies Phrase,
    interactionsLead: { ru: "Связи читаются от I к каждой ветви, между двумя итогами и от их общего смысла к более широкому масштабу — без языка родовых проклятий.", en: "The links are read from I to each branch, between the two totals and from their shared meaning to a wider scale — with no language of family curses." } satisfies Phrase,
    syntheses: {
      "task_m, task_f|planetary": {
        title: { ru: "От общего итога ветвей к масштабу", en: "From the shared total of the branches to the scale" } satisfies Phrase,
        question: { ru: "Как совместный смысл двух ветвей переводит личное изменение на более широкий уровень.", en: "How the joint meaning of the two branches carries a personal change to a wider level." } satisfies Phrase,
      },
    },
    edges: {
      "I|task_m": {
        title: { ru: "Наследство и задача мужской ветви", en: "Inheritance and the task of the male branch" } satisfies Phrase,
        question: { ru: "Как общее наследство проявляется в сценарии мужской ветви.", en: "How the shared inheritance shows in the scenario of the male branch." } satisfies Phrase,
      },
      "I|task_f": {
        title: { ru: "Наследство и задача женской ветви", en: "Inheritance and the task of the female branch" } satisfies Phrase,
        question: { ru: "Как общее наследство проявляется в сценарии женской ветви.", en: "How the shared inheritance shows in the scenario of the female branch." } satisfies Phrase,
      },
      "task_m|task_f": {
        title: { ru: "Два итога задач", en: "Two totals of the tasks" } satisfies Phrase,
        question: { ru: "Где ветви усиливают или уравновешивают повтор.", en: "Where the branches reinforce or balance the repetition." } satisfies Phrase,
      },
    },
  },
  body_resource: {
    title: { ru: "Ресурс тела и восстановление", en: "Body resource and recovery" } satisfies Phrase,
    lead: { ru: "Персональная бытовая схема C–D–итог опоры: устойчивость, расход запаса и наблюдаемый способ восстановления.", en: "A personal everyday scheme C–D–total of support: stability, the spending of the reserve and an observable way of recovering." } satisfies Phrase,
    rolesTitle: { ru: "Три элемента бытовой устойчивости", en: "Three elements of everyday stability" } satisfies Phrase,
    rolesLead: { ru: "Раздел описывает режим и поведение. Он не оценивает состояние организма и не заменяет рекомендации профильного специалиста.", en: "The section describes routine and behaviour. It does not judge the state of the body and does not replace the advice of a specialist." } satisfies Phrase,
    interactionsTitle: { ru: "Как опора переходит в восстановление", en: "How support turns into recovery" } satisfies Phrase,
    interactionsLead: { ru: "Сначала сравниваются C и D, затем их сумма сворачивается в итог опоры. Повтор усиливает тему, но не является медицинским признаком.", en: "First C and D are compared, then their sum is reduced into the total of support. A repetition strengthens the theme but is not a medical sign." } satisfies Phrase,
    syntheses: {
      "C, D|total": {
        title: { ru: "От суммы C и D к итогу восстановления", en: "From the sum of C and D to the total of recovery" } satisfies Phrase,
        question: { ru: "Как бытовая опора и способ расходовать силы вместе образуют итог восстановления.", en: "How everyday footing and the way you spend strength together form the total of recovery." } satisfies Phrase,
      },
    },
    edges: {
      "C|D": {
        title: { ru: "Опора и расход запаса", en: "Footing and the spending of the reserve" } satisfies Phrase,
        question: { ru: "Как материальная организация встречается с возвращающимся способом действия.", en: "How a material arrangement meets a returning way of acting." } satisfies Phrase,
      },
    },
  },
  chakras: {
    title: { ru: "Карта энергий: толкование семи уровней", en: "Energy map: reading the seven levels" } satisfies Phrase,
    lead: { ru: "Персональная карта семи уровней в трёх колонках с итогами, повторами и практическим наблюдением без медицинских выводов.", en: "A personal map of seven levels in three columns with totals, repetitions and a practical observation, with no medical conclusions." } satisfies Phrase,
    rolesTitle: { ru: "Семь уровней и три итога", en: "Seven levels and three totals" } satisfies Phrase,
    rolesLead: { ru: "Каждая строка отвечает за свой жизненный уровень, а физика, энергия и эмоции показывают три разных способа проявления одной темы.", en: "Each row stands for its own level of life, while physics, energy and emotions show three different ways one theme appears." } satisfies Phrase,
    interactionsTitle: { ru: "Ведущие темы и согласование карты", en: "Leading themes and the balance of the map" } satisfies Phrase,
    interactionsLead: { ru: "Итог учитывает максимум и минимум, согласованность колонок, повтор арканов и заметные разрывы между значениями.", en: "The conclusion takes into account the maximum and the minimum, how well the columns agree, repeated arcana and visible gaps between values." } satisfies Phrase,
  },
  rest: {
    title: { ru: "Ваш идеальный формат отдыха", en: "Your ideal way to rest" } satisfies Phrase,
    lead: { ru: "Персональная пара результата радости и центра E: способ переключения и критерий, по которому видно реальное восстановление.", en: "A personal pair of the result of joy and the centre E: a way of switching and the criterion that shows real recovery." } satisfies Phrase,
    rolesTitle: { ru: "Формат отдыха и критерий результата", en: "The format of rest and the criterion of the result" } satisfies Phrase,
    rolesLead: { ru: "Первая роль предлагает способ переключения, E помогает проверить его по состоянию после отдыха, а не по универсальному списку полезных занятий.", en: "The first role suggests a way of switching, E helps to check it by the state after the rest rather than by a universal list of useful activities." } satisfies Phrase,
    interactionsTitle: { ru: "Как понять, что отдых сработал", en: "How to tell that rest has worked" } satisfies Phrase,
    interactionsLead: { ru: "Связь показывает, какой эксперимент стоит провести и какой наблюдаемый признак отличает восстановление от его имитации.", en: "The link shows which experiment is worth running and which observable sign separates recovery from its imitation." } satisfies Phrase,
    edges: {
      "joy|E": {
        title: { ru: "Переключение и внутренний критерий", en: "Switching and the inner criterion" } satisfies Phrase,
        question: { ru: "Как выбранный формат отдыха возвращает состояние, из которого снова можно действовать.", en: "How the chosen format of rest brings back the state you can act from again." } satisfies Phrase,
      },
    },
  },
  loops: {
    title: { ru: "Программы: что повторяется по кругу", en: "Programs: what repeats in circles" } satisfies Phrase,
    lead: { ru: "Персональный разбор D–E–духовное: корень сюжета, состояние автопилота и проверяемая точка выхода.", en: "A personal reading of D–E–spiritual: the root of the storyline, the state of autopilot and a point of exit you can test." } satisfies Phrase,
    rolesTitle: { ru: "Корень, автопилот и выход", en: "Root, autopilot and exit" } satisfies Phrase,
    rolesLead: { ru: "Тройка читается как программа только внутри рассчитанного раздела. Произвольные три числа не получают такого названия автоматически.", en: "The triple reads as a program only inside a calculated section. Three arbitrary numbers do not get that name automatically." } satisfies Phrase,
    interactionsTitle: { ru: "Как замыкается и разрывается круг", en: "How the circle closes and opens" } satisfies Phrase,
    interactionsLead: { ru: "Связи D↔E, E↔духовное и D↔духовное показывают запуск, переход к автоматизму и возможность нового действия.", en: "The links D↔E, E↔spiritual and D↔spiritual show the start, the move into automatism and the possibility of a new action." } satisfies Phrase,
    edges: {
      "D|E": {
        title: { ru: "От корня к автопилоту", en: "From the root to autopilot" } satisfies Phrase,
        question: { ru: "Как возвращающийся сюжет захватывает привычную внутреннюю опору.", en: "How a returning storyline captures the habitual inner footing." } satisfies Phrase,
      },
      "E|spiritual": {
        title: { ru: "От автопилота к точке выхода", en: "From autopilot to the point of exit" } satisfies Phrase,
        question: { ru: "Как осознанное качество возвращает возможность выбрать действие.", en: "How a conscious quality brings back the possibility to choose an action." } satisfies Phrase,
      },
      "D|spiritual": {
        title: { ru: "Корень и новый ответ", en: "The root and a new answer" } satisfies Phrase,
        question: { ru: "Как точка выхода отвечает именно на исходный повтор, а не отвлекает от него.", en: "How the point of exit answers the original repetition instead of distracting from it." } satisfies Phrase,
      },
    },
  },
  years: {
    title: { ru: "Разбор по десятилетиям до 80 лет", en: "Reading by decades up to 80" } satisfies Phrase,
    lead: { ru: "Персональная возрастная линия из восьми этапов с текущим и следующим периодом без гарантированных предсказаний.", en: "A personal age line of eight stages with the current and the next period, with no promised predictions." } satisfies Phrase,
    rolesTitle: { ru: "Восемь десятилетий", en: "Eight decades" } satisfies Phrase,
    rolesLead: { ru: "Каждый аркан задаёт тему периода, сильный способ прохождения, риск и переход. Граница десятилетия меняет ракурс, но не обещает событие в конкретный день.", en: "Each arcanum sets the theme of a period, a strong way of going through it, a risk and a transition. The boundary of a decade changes the angle but does not promise an event on a particular day." } satisfies Phrase,
    interactionsTitle: { ru: "Переходы, повторы и возвращения", en: "Transitions, repetitions and returns" } satisfies Phrase,
    interactionsLead: { ru: "Шкала учитывает соседние переходы, соседний повтор, возвращение аркана через несколько этапов и резкую смену темы.", en: "The scale takes into account neighbouring transitions, a neighbouring repetition, an arcanum returning after several stages and an abrupt change of theme." } satisfies Phrase,
  },
};
