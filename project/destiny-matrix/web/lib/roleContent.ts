import { forLocale as localizedContent, type ArcanumContent } from "./content";
import { D, DR } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import type { ReadingRoleTemplate } from "./readingTypes";

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { arcanumContent } = localizedContent(L);

  const ARCANA = new Map<number, ArcanumContent>();

  function arcanum(number: number): ArcanumContent {
    const cached = ARCANA.get(number);
    if (cached) return cached;
    const value = arcanumContent(number);
    if (!value) throw new Error(`[role-content] нет аркана ${number}`);
    ARCANA.set(number, value);
    return value;
  }

  /**
   * Кубики `strength` и `risk` — придаточные: шаблоны связей и итогов подставляют их внутрь
   * предложения и ставят свой знак сами. Финальная точка в самом кубике давала «…не выгорает..»
   * на 15 194 персональных страницах, поэтому она снимается здесь, а не подчищается у потребителей.
   * `essence` и `action` остаются законченными предложениями: после них шаблон начинает новое.
   */
  function clause(text: string): string {
    return text.trim().replace(/[.;]+$/, "");
  }

  /**
   * Разбор позиционного текста на предложения. Ни одно предложение корпуса не должно пропадать:
   * прежняя версия брала только первое и последнее, из-за чего 588 из 1 820 написанных предложений
   * не доходили до страниц.
   *
   * Две формы корпуса (замер по 836 текстам): 143 написаны в четыре предложения — суть, сила, риск,
   * действие; 565 в три и 128 в два — там середина остаётся частью сути, а силу и риск даёт
   * канонический корпус аркана. Служебных маркеров вида «…; в риске …» в корпусе больше нет:
   * редактура их убрала, а проверка исходников запрещает возвращать одинаковый каркас.
   */
  function splitPosition(text: string): {
    essence: string;
    strength: string | null;
    risk: string | null;
    action: string;
  } {
    const parts = text.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
    if (!parts.length) throw new Error("[role-content] пустой позиционный текст");
    const head = parts[0].replace(D.clause.corpusPrefix[L], "");
    const action = parts.at(-1)!;
    // 14 текстов ролевых позиций написаны в два предложения: суть и действие, середины нет.
    if (parts.length < 3) return { essence: head, strength: null, risk: null, action };

    if (parts.length >= 4) {
      return {
        essence: [head, ...parts.slice(3, -1)].join(" "),
        strength: clause(parts[1]),
        risk: clause(parts[2]),
        action,
      };
    }

    return { essence: `${head} ${parts[1]}`, strength: null, risk: null, action };
  }

  /**
   * Единый разбор позиционного текста на четыре кубика.
   *
   * Сила и риск берутся из самого позиционного текста там, где они там написаны; канонические
   * plus/minus аркана остаются запасным вариантом для текстов, где отдельной формулировки нет.
   */
  function positionRoleTemplate(number: number, position: string): ReadingRoleTemplate {
    const content = arcanum(number);
    const text = content.inPositions[position];
    if (!text) throw new Error(`[role-content] нет текста ${position}:${number}`);
    if (text.trim().split(/(?<=[.!?…])\s+/).filter(Boolean).length < 3) {
      throw new Error(`[role-content] текст ${position}:${number} не делится на роль и действие`);
    }
    const parts = splitPosition(text);
    return {
      title: content.title,
      essence: parts.essence,
      strength: parts.strength ?? clause(content.plus[0]),
      risk: parts.risk ?? clause(content.minus[0]),
      action: parts.action,
    };
  }

  const VARIANT_FRAMES: Record<string, { essence: string; strength: string; risk: string }> = {
    resource_direction: {
      essence: DR.frames.resource_direction.essence[L],
      strength: DR.frames.resource_direction.strength[L],
      risk: DR.frames.resource_direction.risk[L],
    },
    growth_personal: {
      essence: DR.frames.growth_personal.essence[L],
      strength: DR.frames.growth_personal.strength[L],
      risk: DR.frames.growth_personal.risk[L],
    },
    growth_social: {
      essence: DR.frames.growth_social.essence[L],
      strength: DR.frames.growth_social.strength[L],
      risk: DR.frames.growth_social.risk[L],
    },
    loop_root: {
      essence: DR.frames.loop_root.essence[L],
      strength: DR.frames.loop_root.strength[L],
      risk: DR.frames.loop_root.risk[L],
    },
    loop_autopilot: {
      essence: DR.frames.loop_autopilot.essence[L],
      strength: DR.frames.loop_autopilot.strength[L],
      risk: DR.frames.loop_autopilot.risk[L],
    },
    money_entry_mature: {
      essence: DR.frames.money_entry_mature.essence[L],
      strength: DR.frames.money_entry_mature.strength[L],
      risk: DR.frames.money_entry_mature.risk[L],
    },
    money_mature: {
      essence: DR.frames.money_mature.essence[L],
      strength: DR.frames.money_mature.strength[L],
      risk: DR.frames.money_mature.risk[L],
    },
    family_male_gift: {
      essence: DR.frames.family_male_gift.essence[L],
      strength: DR.frames.family_male_gift.strength[L],
      risk: DR.frames.family_male_gift.risk[L],
    },
    family_female_gift: {
      essence: DR.frames.family_female_gift.essence[L],
      strength: DR.frames.family_female_gift.strength[L],
      risk: DR.frames.family_female_gift.risk[L],
    },
    sky_total: {
      essence: DR.frames.sky_total.essence[L],
      strength: DR.frames.sky_total.strength[L],
      risk: DR.frames.sky_total.risk[L],
    },
    money_choice: {
      essence: DR.frames.money_choice.essence[L],
      strength: DR.frames.money_choice.strength[L],
      risk: DR.frames.money_choice.risk[L],
    },
    ground_total: {
      essence: DR.frames.ground_total.essence[L],
      strength: DR.frames.ground_total.strength[L],
      risk: DR.frames.ground_total.risk[L],
    },
    relation_knot: {
      essence: DR.frames.relation_knot.essence[L],
      strength: DR.frames.relation_knot.strength[L],
      risk: DR.frames.relation_knot.risk[L],
    },
    relation_form: {
      essence: DR.frames.relation_form.essence[L],
      strength: DR.frames.relation_form.strength[L],
      risk: DR.frames.relation_form.risk[L],
    },
    ancestry_male_task: {
      essence: DR.frames.ancestry_male_task.essence[L],
      strength: DR.frames.ancestry_male_task.strength[L],
      risk: DR.frames.ancestry_male_task.risk[L],
    },
    ancestry_female_task: {
      essence: DR.frames.ancestry_female_task.essence[L],
      strength: DR.frames.ancestry_female_task.strength[L],
      risk: DR.frames.ancestry_female_task.risk[L],
    },
    body_total: {
      essence: DR.frames.body_total.essence[L],
      strength: DR.frames.body_total.strength[L],
      risk: DR.frames.body_total.risk[L],
    },
    rest_result: {
      essence: DR.frames.rest_result.essence[L],
      strength: DR.frames.rest_result.strength[L],
      risk: DR.frames.rest_result.risk[L],
    },
    decade: {
      essence: DR.frames.decade.essence[L],
      strength: DR.frames.decade.strength[L],
      risk: DR.frames.decade.risk[L],
    },
    chakra_physics: {
      essence: DR.frames.chakra_physics.essence[L],
      strength: DR.frames.chakra_physics.strength[L],
      risk: DR.frames.chakra_physics.risk[L],
    },
    chakra_physics_total: {
      essence: DR.frames.chakra_physics_total.essence[L],
      strength: DR.frames.chakra_physics_total.strength[L],
      risk: DR.frames.chakra_physics_total.risk[L],
    },
    chakra_energy_total: {
      essence: DR.frames.chakra_energy_total.essence[L],
      strength: DR.frames.chakra_energy_total.strength[L],
      risk: DR.frames.chakra_energy_total.risk[L],
    },
    chakra_emotions_total: {
      essence: DR.frames.chakra_emotions_total.essence[L],
      strength: DR.frames.chakra_emotions_total.strength[L],
      risk: DR.frames.chakra_emotions_total.risk[L],
    },
  };

  /**
   * Возраст — самостоятельный контекст, а не подпись над одним и тем же текстом. Рамки не
   * предсказывают события: они меняют вопрос, с которым читается аркан десятилетия.
   */
  const AGE_FRAME_TEXTS = DR.decades.map((frame) => frame[L]);

  function ageFrameText(index: number): string {
    const value = AGE_FRAME_TEXTS[index];
    if (!value) throw new Error(`[role-content] неизвестная возрастная рамка ${index}`);
    return value;
  }

  /**
   * Специальные итоги остаются самостоятельными ролями, но не заводят второй корпус из 22 арканов:
   * смысл аркана и действие берутся из одной канонической позиции, роль задаёт только контекст.
   */
  function variantRoleTemplate(
    number: number,
    position: string,
    variant: string,
  ): ReadingRoleTemplate {
    const frame = VARIANT_FRAMES[variant];
    if (!frame) throw new Error(`[role-content] неизвестная роль ${variant}`);
    const content = arcanum(number);
    const raw = content.inPositions[position];
    if (!raw) throw new Error(`[role-content] нет текста ${position}:${number}`);
    const parts = splitPosition(raw);
    return {
      title: content.title,
      // Рамка сути остаётся всегда: «итог М» и «итог Ж» (как и R1/R, R/земля) читают один и тот же
      // позиционный текст, и рамка объясняет, в какой роли он здесь читается.
      essence: `${frame.essence}: ${parts.essence}`,
      // Четырёхчастные тексты пишут силу и риск сами — они идут кубиком как есть; рамка
      // подставляет общие plus/minus аркана только там, где своего текста нет. Дословную копию
      // у парных ролей снимает `sameAs`, а не рамка.
      strength: parts.strength ?? `${frame.strength} ${clause(content.plus[0])}`,
      risk: parts.risk ?? `${frame.risk} ${clause(content.minus[0])}`,
      // Действие идёт без рамки: роль уже названа в сути, а «…помогает действие: Выпишите…»
      // давало на связях второй родительный подряд — «проверьте действие 0–10: Подготовить
      // переход к следующему этапу помогает действие: Выпишите…».
      action: parts.action,
    };
  }
  return { positionRoleTemplate, AGE_FRAME_TEXTS, ageFrameText, variantRoleTemplate };
});

// Compatibility for callers that explicitly use the deployment default.
export const { positionRoleTemplate, AGE_FRAME_TEXTS, ageFrameText, variantRoleTemplate } = forLocale(defaultLocale);
