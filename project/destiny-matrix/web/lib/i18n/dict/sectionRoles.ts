import type { Phrase } from "./index";

/** Подписи ролей разделов: ключ раздела и ключ роли — контракт, слова — перевод. */
export const sectionRoles: Record<string, Record<string, { label: Phrase; question: Phrase }>> = {
  realisation: {
    "D": {
      label: { ru: "Корневая задача", en: "Root task" },
      question: { ru: "Какой сюжет возвращается и требует нового ответа", en: "Which storyline keeps coming back and asks for a new answer" },
    },
    "personal": {
      label: { ru: "Личный рост", en: "Personal growth" },
      question: { ru: "Какое качество важно вырастить прежде всего для себя", en: "Which quality is worth growing first of all for yourself" },
    },
    "social": {
      label: { ru: "Польза для других", en: "Usefulness to others" },
      question: { ru: "Как личный опыт становится устойчивой пользой за пределами своей истории", en: "How personal experience becomes lasting usefulness beyond your own story" },
    },
  },
  karma40: {
    "I": {
      label: { ru: "Наследство ветви", en: "Inheritance of the branch" },
      question: { ru: "Какое семейное правило входит в повседневные решения", en: "Which family rule enters your everyday decisions" },
    },
    "J": {
      label: { ru: "Автоматическая защита", en: "Automatic defence" },
      question: { ru: "Как человек привычно восстанавливает контроль в первой части пути", en: "How a person habitually takes control back in the first half of the path" },
    },
  },
  resources: {
    "L": {
      label: { ru: "Вход ресурса", en: "Entry of the resource" },
      question: { ru: "Через какое действие открывается движение к благам", en: "Through which action the movement towards abundance opens" },
    },
    "R2": {
      label: { ru: "Условие удержания ресурса", en: "Condition for keeping the resource" },
      question: { ru: "Какое направление помогает не только получить, но и удержать результат", en: "Which direction helps not only to receive but also to keep the result" },
    },
  },
  family_gifts: {
    "F": {
      label: { ru: "Принцип мужской ветви", en: "Principle of the male branch" },
      question: { ru: "Какой духовный ресурс передаёт мужская ветвь рода", en: "Which spiritual resource the male branch of the family passes on" },
    },
    "G": {
      label: { ru: "Принцип женской ветви", en: "Principle of the female branch" },
      question: { ru: "Какой духовный ресурс передаёт женская ветвь рода", en: "Which spiritual resource the female branch of the family passes on" },
    },
    "total_m": {
      label: { ru: "Дар мужской ветви", en: "Gift of the male branch" },
      question: { ru: "Во что складывается поддержка мужской ветви в реальных делах", en: "What the support of the male branch adds up to in real deeds" },
    },
    "total_f": {
      label: { ru: "Дар женской ветви", en: "Gift of the female branch" },
      question: { ru: "Во что складывается поддержка женской ветви в реальных делах", en: "What the support of the female branch adds up to in real deeds" },
    },
  },
  soul_tasks: {
    "B": {
      label: { ru: "Первая задача неба", en: "First task of the sky" },
      question: { ru: "Какой врождённый внутренний вопрос требует внимания", en: "Which inborn inner question asks for attention" },
    },
    "D": {
      label: { ru: "Вторая задача неба", en: "Second task of the sky" },
      question: { ru: "Какой возвращающийся сюжет проверяет первую задачу на практике", en: "Which returning storyline tests the first task in practice" },
    },
    "sky_total": {
      label: { ru: "Общий урок", en: "The shared lesson" },
      question: { ru: "Какой общий урок возникает из двух исходных задач", en: "Which shared lesson grows out of the two original tasks" },
    },
  },
  purpose: {
    "personal": {
      label: { ru: "Личное предназначение", en: "Personal purpose" },
      question: { ru: "Что важно прожить и вырастить для себя", en: "What is worth living through and growing for yourself" },
    },
    "social": {
      label: { ru: "Социальное предназначение", en: "Social purpose" },
      question: { ru: "Как личный опыт становится полезным другим", en: "How personal experience becomes useful to others" },
    },
    "spiritual": {
      label: { ru: "Духовное предназначение", en: "Spiritual purpose" },
      question: { ru: "Что соединяет личный и социальный уровни", en: "What joins the personal and the social levels" },
    },
    "planetary": {
      label: { ru: "Планетарное предназначение", en: "Planetary purpose" },
      question: { ru: "Как тема выходит за рамки личной биографии", en: "How the theme reaches beyond a personal biography" },
    },
  },
  money: {
    "L": {
      label: { ru: "Вход денег", en: "Entry of money" },
      question: { ru: "Через какое действие начинается денежное движение", en: "Through which action the movement of money begins" },
    },
    "R2": {
      label: { ru: "Денежное направление", en: "Money direction" },
      question: { ru: "Какое условие поддерживает движение денег", en: "Which condition supports the movement of money" },
    },
    "R": {
      label: { ru: "Личный выбор", en: "Personal choice" },
      question: { ru: "Где денежный сценарий встречается с решениями и отношениями", en: "Where the money storyline meets decisions and relationships" },
    },
    "ground_total": {
      label: { ru: "Устойчивость результата", en: "Stability of the result" },
      question: { ru: "Во что складывается материальная опора линии", en: "What the material footing of the line adds up to" },
    },
  },
  money40: {
    "R2": {
      label: { ru: "Зрелое денежное направление", en: "Mature money direction" },
      question: { ru: "Что начинает работать лучше через накопленный опыт", en: "What starts to work better through accumulated experience" },
    },
    "L": {
      label: { ru: "Новая опора входа", en: "A new footing for the entry" },
      question: { ru: "Как перечитать привычный способ начинать денежное движение", en: "How to re-read the habitual way of starting the movement of money" },
    },
  },
  relations: {
    "M": {
      label: { ru: "Вход в близость", en: "Entry into closeness" },
      question: { ru: "Какая первая реакция включается в значимых отношениях", en: "Which first reaction switches on in significant relationships" },
    },
    "R1": {
      label: { ru: "Главный узел", en: "The main knot" },
      question: { ru: "Какой вопрос партнёрства требует осознанного выбора", en: "Which question of partnership asks for a conscious choice" },
    },
    "R": {
      label: { ru: "Форма союза", en: "The shape of the union" },
      question: { ru: "Как личный сценарий проявляется в договорённостях и совместных делах", en: "How a personal storyline shows in agreements and shared affairs" },
    },
    "K": {
      label: { ru: "Внутренний ресурс", en: "Inner resource" },
      question: { ru: "Какое качество помогает не терять себя в близости", en: "Which quality helps you not to lose yourself in closeness" },
    },
  },
  parents_children: {
    "F": {
      label: { ru: "Правило мужской ветви", en: "Rule of the male branch" },
      question: { ru: "Какой семейный принцип получен по мужской ветви", en: "Which family principle came through the male branch" },
    },
    "G": {
      label: { ru: "Правило женской ветви", en: "Rule of the female branch" },
      question: { ru: "Какой семейный принцип получен по женской ветви", en: "Which family principle came through the female branch" },
    },
    "H": {
      label: { ru: "Что передаётся дальше", en: "What is passed on" },
      question: { ru: "Как полученные правила становятся собственным поведением", en: "How the rules you received become your own behaviour" },
    },
  },
  ancestry: {
    "I": {
      label: { ru: "Повторяющееся наследство", en: "Repeating inheritance" },
      question: { ru: "Какой родовой принцип входит в повседневные решения", en: "Which family principle enters your everyday decisions" },
    },
    "task_m": {
      label: { ru: "Итог задач мужской ветви", en: "Total of the tasks of the male branch" },
      question: { ru: "Какой сценарий мужской ветви требует нового продолжения", en: "Which scenario of the male branch needs a new continuation" },
    },
    "task_f": {
      label: { ru: "Итог задач женской ветви", en: "Total of the tasks of the female branch" },
      question: { ru: "Какой сценарий женской ветви требует нового продолжения", en: "Which scenario of the female branch needs a new continuation" },
    },
    "planetary": {
      label: { ru: "Масштаб изменения", en: "The scale of the change" },
      question: { ru: "Как личная работа со сценарием влияет на более широкий круг", en: "How personal work with the scenario affects a wider circle" },
    },
  },
  body_resource: {
    "C": {
      label: { ru: "Бытовая опора", en: "Everyday footing" },
      question: { ru: "Какая материальная организация помогает сохранять запас", en: "Which material arrangement helps to keep a reserve" },
    },
    "D": {
      label: { ru: "Расход энергии", en: "Spending of energy" },
      question: { ru: "Какой возвращающийся способ действия расходует или собирает силы", en: "Which returning way of acting spends or gathers strength" },
    },
    "total": {
      label: { ru: "Итог восстановления", en: "Total of recovery" },
      question: { ru: "Какой наблюдаемый режим помогает возвращать устойчивость", en: "Which observable routine helps to bring stability back" },
    },
  },
  chakras: {
    "physics_total": {
      label: { ru: "Итог физики", en: "Total of physics" },
      question: { ru: "Как складывается материальный ритм карты", en: "How the material rhythm of the chart adds up" },
    },
    "energy_total": {
      label: { ru: "Итог энергии", en: "Total of energy" },
      question: { ru: "Как складывается способ распределять усилие", en: "How the way of distributing effort adds up" },
    },
    "emotions_total": {
      label: { ru: "Итог эмоций", en: "Total of emotions" },
      question: { ru: "Как складывается эмоциональный отклик", en: "How the emotional response adds up" },
    },
  },
  rest: {
    "joy": {
      label: { ru: "Результат радости", en: "The result of joy" },
      question: { ru: "Какой способ переключения действительно возвращает живой интерес", en: "Which way of switching really brings live interest back" },
    },
    "E": {
      label: { ru: "Критерий восстановления", en: "Criterion of recovery" },
      question: { ru: "Как понять по внутреннему состоянию, что отдых сработал", en: "How to tell from your inner state that rest has worked" },
    },
  },
  loops: {
    "D": {
      label: { ru: "Корень сценария", en: "Root of the scenario" },
      question: { ru: "Какой возвращающийся вопрос запускает знакомый круг", en: "Which returning question starts the familiar circle" },
    },
    "E": {
      label: { ru: "Состояние автопилота", en: "The state of autopilot" },
      question: { ru: "Как привычная внутренняя опора превращается в автоматизм", en: "How a habitual inner support turns into an automatism" },
    },
    "spiritual": {
      label: { ru: "Точка выхода", en: "The point of exit" },
      question: { ru: "Какое качество соединяет опыт с новым действием", en: "Which quality joins experience with a new action" },
    },
  },
  profession: {
    "B": {
      label: { ru: "Исходный дар", en: "The original gift" },
      question: { ru: "Какое качество включается естественно и часто не воспринимается человеком как особый талант", en: "Which quality switches on naturally and is often not seen as a special talent" },
    },
    "P": {
      label: { ru: "Форма профессиональной реализации", en: "The shape of professional realisation" },
      question: { ru: "В каких задачах и рабочем формате исходный дар становится полезным результатом", en: "In which tasks and work format the original gift becomes a useful result" },
    },
    "K": {
      label: { ru: "Внутренний результат", en: "Inner result" },
      question: { ru: "Как человек понимает, что реализует талант своим способом, а не только выполняет функцию", en: "How a person knows they realise the talent in their own way and do not merely perform a function" },
    },
  },
};
