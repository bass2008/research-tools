import { describe, expect, it } from "vitest";

import { arcanumContent, matrixItem, matrixSlugs } from "./content";
import {
  buildSectionReading,
  chakraColumnModifier,
  sectionReadingHref,
  sectionReadingItem,
  sectionReadingMatrix,
  sectionReadingSlug,
  sectionExampleNote,
  sectionReadingSlugs,
  sectionRoleTemplate,
  type PersonalSectionKey,
} from "./sectionReadings";
import { AGE_FRAME_TEXTS } from "./roleContent";
import { SECTION_ROLES } from "./sectionReadingShared";
import { isBlockedText } from "./textPolicy";
import { calculate } from "./matrix";

function corpus(section: PersonalSectionKey, slug: string): string {
  const item = sectionReadingItem(section, slug)!;
  const reading = buildSectionReading(section, item.matrix);
  return [
    reading.title,
    reading.lead,
    reading.rolesTitle,
    reading.rolesLead,
    reading.interactionsTitle,
    reading.interactionsLead,
    reading.summary,
    ...reading.roles.flatMap((role) => [
      role.label,
      role.question,
      role.essence,
      role.strength,
      role.risk,
      role.action,
    ]),
    ...reading.interactions.flatMap((interaction) => [interaction.title, ...interaction.paragraphs]),
    reading.strength,
    reading.tension,
    reading.practice,
  ].join(" ");
}

function repeatShape(slug: string): "distinct" | "first-second" | "first-third" | "second-third" | "all" {
  const [first, middle, last] = slug.split("-").map(Number);
  if (first === middle && middle === last) return "all";
  if (first === middle) return "first-second";
  if (first === last) return "first-third";
  if (middle === last) return "second-third";
  return "distinct";
}

function shapeCounts(slugs: string[]): Record<string, number> {
  return slugs.reduce<Record<string, number>>((counts, slug) => {
    const shape = repeatShape(slug);
    counts[shape] = (counts[shape] ?? 0) + 1;
    return counts;
  }, {});
}

describe("персональные разборы центра и профессии", () => {
  it("собирает контрольную матрицу в точные тройки E–M–K и B–P–K", () => {
    const matrix = calculate("1993-03-31", "f");
    const comfort = buildSectionReading("comfort", matrix);
    const profession = buildSectionReading("profession", matrix);

    expect(comfort.slug).toBe("4-15-7");
    expect(comfort.roles.map((role) => [role.key, role.arcanum])).toEqual([
      ["E", 4], ["M", 15], ["K", 7],
    ]);
    expect(profession.slug).toBe("3-10-7");
    expect(profession.roles.map((role) => [role.key, role.arcanum])).toEqual([
      ["B", 3], ["P", 10], ["K", 7],
    ]);
    expect(sectionReadingHref("comfort", matrix)).toBe("/encyclopedia/comfort/4-15-7");
    expect(sectionReadingHref("profession", matrix)).toBe("/encyclopedia/profession/3-10-7");
  });

  it("разделяет все 22 профессиональные позиции P на четыре содержательных кубика", () => {
    for (let arcanum = 1; arcanum <= 22; arcanum++) {
      const role = sectionRoleTemplate("profession", arcanum, "profession");
      for (const part of [role.essence, role.strength, role.risk, role.action]) {
        expect(part.length, `P:${arcanum}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("покрывает ровно 286 достижимых внутренних троек", () => {
    const slugs = sectionReadingSlugs("comfort");
    expect(slugs).toHaveLength(286);
    expect(shapeCounts(slugs)).toEqual({
      distinct: 260,
      "first-second": 12,
      "second-third": 14,
    });
    for (const slug of slugs) {
      const reading = buildSectionReading("comfort", sectionReadingItem("comfort", slug)!.matrix);
      expect(reading.slug).toBe(slug);
      expect(reading.roles).toHaveLength(3);
      expect(reading.interactions.length).toBeGreaterThanOrEqual(1);
      expect(reading.interactions.length).toBeLessThanOrEqual(3);
      const text = corpus("comfort", slug);
      expect(text.length).toBeGreaterThan(1800);
      expect(isBlockedText(text)).toBe(false);
    }
  });

  it("покрывает ровно 160 достижимых профессиональных линий", () => {
    const slugs = sectionReadingSlugs("profession");
    expect(slugs).toHaveLength(160);
    expect(shapeCounts(slugs)).toEqual({
      distinct: 151,
      "first-second": 7,
      "first-third": 2,
    });
    for (const slug of slugs) {
      const reading = buildSectionReading("profession", sectionReadingItem("profession", slug)!.matrix);
      expect(reading.slug).toBe(slug);
      expect(reading.roles).toHaveLength(3);
      expect(reading.interactions.length).toBeGreaterThanOrEqual(1);
      expect(reading.interactions.length).toBeLessThanOrEqual(3);
      const text = corpus("profession", slug);
      expect(text.length).toBeGreaterThan(1800);
      expect(isBlockedText(text)).toBe(false);
    }
  });

  it("отдаёт 404-данные для недостижимых и неверных троек", () => {
    expect(sectionReadingItem("comfort", "1-1-1")).toBeNull();
    expect(sectionReadingItem("profession", "23-1-1")).toBeNull();
    expect(sectionReadingItem("profession", "3-10-7-extra")).toBeNull();
  });

  it("сворачивает каждый реально достижимый повтор в один общий сюжет", () => {
    const cases: Array<[PersonalSectionKey, string, string]> = [
      ["comfort", "9-9-10", "позиции E, M"],
      ["comfort", "22-6-6", "позиции M, K"],
      ["profession", "7-7-18", "позиции B, P"],
      ["profession", "5-10-5", "позиции B, K"],
    ];
    for (const [section, slug, title] of cases) {
      const reading = buildSectionReading(section, sectionReadingItem(section, slug)!.matrix);
      expect(reading.interactions).toHaveLength(2);
      expect(reading.interactions.filter((item) => item.title.includes(title))).toHaveLength(1);
    }
  });
});

describe("персональные разборы остальных разделов третьей итерации", () => {
  const counts: Record<PersonalSectionKey, number> = {
    comfort: 286,
    profession: 160,
    realisation: 86,
    karma40: 332,
    resources: 95,
    family_gifts: 4463,
    soul_tasks: 239,
    purpose: 42,
    money: 1766,
    money40: 95,
    relations: 1685,
    parents_children: 4429,
    ancestry: 886,
    body_resource: 363,
    chakras: 5544,
    rest: 215,
    loops: 54,
    years: 5544,
  };

  it("покрывает точные конечные реестры всех формульных результатов", () => {
    for (const [section, expected] of Object.entries(counts) as Array<[PersonalSectionKey, number]>) {
      const slugs = sectionReadingSlugs(section);
      expect(slugs, section).toHaveLength(expected);
      expect(new Set(slugs).size, section).toBe(expected);
      for (const slug of [slugs[0], slugs[Math.floor(slugs.length / 2)], slugs.at(-1)!]) {
        const item = sectionReadingItem(section, slug);
        expect(item, `${section}:${slug}`).not.toBeNull();
        const reading = buildSectionReading(section, item!.matrix, new Date("2026-09-01T12:00:00Z"));
        expect(reading.slug).toBe(slug);
        expect(reading.summary.length).toBeGreaterThan(100);
        expect(reading.practice.length).toBeGreaterThan(80);
        expect(isBlockedText(corpus(section, slug)), `${section}:${slug}`).toBe(false);
      }
    }
  });

  it("создаёт 66 безопасных модификаторов аркан × колонка", () => {
    for (let number = 1; number <= 22; number++) {
      for (const column of ["physics", "energy", "emotions"] as const) {
        const value = chakraColumnModifier(number, column);
        expect(value.modifier.length, `${number}:${column}`).toBeGreaterThan(80);
        expect(value.action.length, `${number}:${column}`).toBeGreaterThan(50);
        expect(isBlockedText(`${value.modifier} ${value.action}`)).toBe(false);
      }
    }
  });

  it("разворачивает все новые канонические роли в 22 полных набора кубиков", () => {
    const roles: Array<[PersonalSectionKey, string, string]> = [
      ["resources", "resources", "R2"],
      ["family_gifts", "family_gifts", "итог М"],
      ["family_gifts", "family_gifts", "итог Ж"],
      ["soul_tasks", "soul_tasks", "итог неба"],
      ["money", "resources", "R2"],
      ["money", "money", "R"],
      ["money", "money", "земля"],
      ["relations", "relations", "R1"],
      ["relations", "relations", "R"],
      ["ancestry", "ancestry", "задача М"],
      ["ancestry", "ancestry", "задача Ж"],
      ["body_resource", "body_resource", "итог"],
      ["rest", "rest", "радость"],
      ["years", "years", "0–10"],
    ];
    for (const [section, position, roleKey] of roles) {
      for (let number = 1; number <= 22; number++) {
        const role = sectionRoleTemplate(section, number, position, roleKey);
        for (const part of [role.essence, role.strength, role.risk, role.action]) {
          // Порог 40 мерил не содержательность кубика, а длину рамки роли: пока сила и риск
          // собирались как «рамка + общий plus/minus», короче он быть не мог. Теперь там, где
          // формулировка написана под роль, кубик идёт своим текстом и бывает коротким —
          // «Условие — брать за это деньги» (resources:R2:3). Порог тот же, что у роли P выше.
          expect(part.length, `${section}:${roleKey}:${number}`).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });

  // Прежний сторож требовал, чтобы у парных ролей четыре кубика «различались», и проходил от
  // одной рамки: предметная часть у них совпадает по построению — обе читают одну позицию
  // корпуса. Проверяем то, что действительно защищает читателя: при одном аркане вторая роль
  // помечена повтором и её текст не печатается второй раз, при разных — обе полноценные.
  it("печатает парную роль второй раз только когда у неё свой аркан", () => {
    const pairs: Array<[PersonalSectionKey, string, string]> = [
      ["family_gifts", "итог М", "итог Ж"],
      ["ancestry", "задача М", "задача Ж"],
      ["relations", "R1", "R"],
      ["money", "R", "земля"],
    ];
    for (const [section, firstKey, secondKey] of pairs) {
      let collapsed = 0;
      let full = 0;
      for (const slug of sectionReadingSlugs(section)) {
        const item = sectionReadingItem(section, slug)!;
        const reading = buildSectionReading(section, item.matrix, new Date("2026-09-01T12:00:00Z"));
        const first = reading.roles.find((role) => role.key === firstKey)!;
        const second = reading.roles.find((role) => role.key === secondKey)!;
        if (first.arcanum === second.arcanum) {
          expect(second.sameAs?.key, `${section}:${slug}`).toBe(firstKey);
          collapsed++;
        } else {
          expect(second.sameAs, `${section}:${slug}`).toBeUndefined();
          // Разные арканы — разные тексты позиции, копии тут неоткуда взяться.
          expect(second.essence, `${section}:${slug}`).not.toBe(first.essence);
          full++;
        }
      }
      // Обе ветки должны реально встречаться, иначе проверка вырождается в одну сторону.
      expect(collapsed, `${section}: нет ни одного совпадения арканов`).toBeGreaterThan(0);
      expect(full, `${section}: нет ни одного расхождения арканов`).toBeGreaterThan(0);
    }
  });

  it("не теряет ни одного предложения позиционного корпуса", () => {
    const riskMark = /;\s*(?:а\s+)?(?:в\s+риске\s+|риск(?:ом)?\s*[—–-]\s*|риск\s+в\s+том,?\s*(?:что\s+)?)/i;
    // Хвост фразы переживает и срез зачина, и деление середины на силу с риском.
    const tail = (value: string) => {
      const core = value.replace(/[.;!?…]+$/, "").trim();
      return core.slice(Math.max(0, core.length - 25));
    };
    // Каждая роль каждого раздела: позиция корпуса и ключ, по которому её достаёт разбор.
    const catalogue = (Object.keys(SECTION_ROLES) as PersonalSectionKey[]).flatMap((section) =>
      SECTION_ROLES[section].map((role) => ({ section, position: role.position, key: role.key })),
    );
    const lost: string[] = [];
    for (const { section, position, key } of catalogue) {
      for (let number = 1; number <= 22; number++) {
        const raw = arcanumContent(number)?.inPositions[position];
        if (!raw) continue;
        const parts = raw.trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
        const role = sectionRoleTemplate(section, number, position, key);
        const bag = [role.essence, role.strength, role.risk, role.action].join("  ");
        const split = parts.length === 3 && riskMark.test(parts[1]);
        for (const [index, part] of parts.entries()) {
          for (const piece of split && index === 1 ? part.split(riskMark) : [part]) {
            if (piece.trim() && !bag.includes(tail(piece))) {
              lost.push(`${section}/${position}:${number} «${piece.trim().slice(0, 60)}»`);
            }
          }
        }
      }
    }
    expect(lost).toEqual([]);
  });

  it("собирает семь строк карты и восемь возрастных этапов", () => {
    const matrix = calculate("1993-03-31", "f");
    const chakras = buildSectionReading("chakras", matrix);
    expect(chakras.layout).toBe("chakras");
    expect(chakras.title).toContain("4–3–22");
    expect(chakras.chakraRows).toHaveLength(7);
    expect(chakras.chakraRows?.every((row) => row.cells.length === 3)).toBe(true);

    const years = buildSectionReading("years", matrix, new Date("2026-09-01T12:00:00Z"));
    expect(years.layout).toBe("years");
    expect(years.title).toContain("31 марта 1993");
    expect(years.agePeriods).toHaveLength(8);
    expect(years.agePeriods?.filter((period) => period.current)).toHaveLength(1);
    expect(years.summary).toContain("Сейчас возраст");
    expect(years.interactions.some((item) => item.key === "sharp-changes")).toBe(true);
    expect(AGE_FRAME_TEXTS).toHaveLength(8);
    expect(new Set(AGE_FRAME_TEXTS).size).toBe(8);
    for (const [index, period] of years.agePeriods!.entries()) {
      expect(period.essence, `${index * 10}–${index * 10 + 10}`).toContain(AGE_FRAME_TEXTS[index]);
    }
  });

  it("даёт картам чакр и возрастным линиям собственные заголовки", () => {
    const first = calculate("1993-03-31", "f");
    const second = calculate("1990-03-07", "f");
    for (const section of ["chakras", "years"] as const) {
      const firstReading = buildSectionReading(section, first);
      const secondReading = buildSectionReading(section, second);
      expect(firstReading.slug, section).not.toBe(secondReading.slug);
      expect(firstReading.title, section).not.toBe(secondReading.title);
      const titles = sectionReadingSlugs(section).map((slug) => {
        const item = sectionReadingItem(section, slug)!;
        return buildSectionReading(section, item.matrix).title;
      });
      expect(new Set(titles).size, section).toBe(5_544);
    }
  });

  it("строит составные переходы из обеих исходных ролей, а не из последней точки", () => {
    const matrix = calculate("1993-03-31", "f");
    const expected: Array<[PersonalSectionKey, string, string[], string]> = [
      ["soul_tasks", "synthesis:B+D=>итог неба", ["B", "D", "итог неба"], "3-11-14"],
      ["purpose", "synthesis:личное+социальное=>духовное", ["личное", "социальное", "духовное"], "22-8-3-11"],
      ["ancestry", "synthesis:задача М+задача Ж=>планетарное", ["задача М", "задача Ж", "планетарное"], "15-13-22-11"],
      ["body_resource", "synthesis:C+D=>итог", ["C", "D", "итог"], "22-11-6"],
    ];
    for (const [section, key, roles, slug] of expected) {
      const reading = buildSectionReading(section, matrix);
      expect(reading.slug, section).toBe(slug);
      expect(reading.interactions.find((item) => item.key === key)?.roles, section).toEqual(roles);
    }
    expect(buildSectionReading("soul_tasks", matrix).roles.map((role) => role.key)).toEqual([
      "B", "D", "итог неба",
    ]);
    expect(buildSectionReading("body_resource", matrix).roles.at(-1)?.arcanum)
      .toBe(matrix.chakras[6].emotions);
  });

  it("не смешивает роль итога неба с B или D при совпадении номера аркана", () => {
    const matrix = matrixItem("1-5-12")!.matrix;
    const reading = buildSectionReading("soul_tasks", matrix);
    const b = reading.roles.find((role) => role.key === "B")!;
    const total = reading.roles.find((role) => role.key === "итог неба")!;
    expect(b.arcanum).toBe(total.arcanum);
    expect(total.essence).not.toBe(b.essence);
    expect(total.action).not.toBe(b.action);
  });

  it("называет точное число связей одной пары после дедупликации", () => {
    const family = buildSectionReading("family_gifts", matrixItem("1-6-10")!.matrix);
    expect(family.interactions.find((item) => item.key === "7-16")?.title).toContain("в 4 связях");

    const purpose = buildSectionReading("purpose", matrixItem("1-1-7")!.matrix);
    expect(purpose.interactions.find((item) => item.key === "9-18")?.title).toContain("в 2 связях");

    const years = buildSectionReading("years", matrixItem("9-9-9")!.matrix);
    expect(years.interactions.find((item) => item.key === "9-18")?.title).toContain("в 7 связях");
  });

  it("различает заметный разрыв чакр и хранит полную карту в 24-компонентном URL", () => {
    const first = matrixItem("1-1-20")!.matrix;
    const second = matrixItem("1-10-20")!.matrix;
    expect(sectionReadingSlug("chakras", first)).not.toBe(sectionReadingSlug("chakras", second));

    const matrix = calculate("1993-03-31", "f");
    const slug = sectionReadingSlug("chakras", matrix);
    expect(slug.split("-")).toHaveLength(24);
    expect(sectionReadingMatrix("chakras", slug)?.chakras).toEqual(matrix.chakras);
    expect(sectionReadingHref("chakras", matrix)).toBe(`/encyclopedia/chakras/${slug}`);
    expect(sectionReadingItem("chakras", "4-12-8-12-4-8-22-7-7-14")).toBeNull();

    const reading = buildSectionReading("chakras", matrix);
    const imbalance = reading.interactions.find((item) => item.key === "imbalance");
    expect(imbalance?.title).toBe("Главный внутренний разрыв карты");
    expect(imbalance?.caption).toMatch(/^Уровень [А-Яа-яЁё]+ · (Физика|Энергия|Эмоции)–(Физика|Энергия|Эмоции)$/);
    expect(imbalance?.caption).not.toMatch(/physics|energy|emotions/);
    expect(imbalance?.paragraphs.join(" ")).toContain("заметный разрыв");
    const columns = reading.interactions.find((item) => item.key === "columns");
    expect(columns?.caption).toMatch(/^Колонки (Физика|Энергия|Эмоции)–(Физика|Энергия|Эмоции)$/);
    expect(columns?.paragraphs.join(" ")).toContain("порога заметного разрыва");
  });

  it("правильно отмечает границы десятилетий от 0 до 80 лет", () => {
    const matrix = calculate("1993-03-31", "f");
    const now = new Date("2026-09-01T12:00:00Z");
    const timeline = (birth: string) => buildSectionReading("years", { ...matrix, birth }, now);
    const flags = (birth: string) => timeline(birth).agePeriods!
      .filter((period) => period.current || period.next)
      .map((period) => [period.from, period.current, period.next]);

    expect(flags("2026-09-01")).toEqual([[0, true, false], [10, false, true]]);
    expect(flags("2016-09-01")).toEqual([[10, true, false], [20, false, true]]);
    expect(flags("1957-09-01")).toEqual([[60, true, false], [70, false, true]]);
    expect(flags("1956-09-01")).toEqual([[70, true, false]]);
    expect(flags("1946-09-01")).toEqual([]);
    expect(timeline("1946-09-01").summary).toContain("за пределами шкалы до 80");
    expect(timeline("1993-03-31").interactions
      .filter((item) => item.key === "returns" || item.key === "sharp-changes")
      .every((item) => item.roles.length === 0)).toBe(true);
  });

  it("без параметра birth не приписывает линии чужую дату", () => {
    const matrix = calculate("1993-03-31", "f");
    const slug = sectionReadingSlug("years", matrix);
    const personal = sectionReadingMatrix("years", slug, { birth: matrix.birth })!;
    const anonymous = sectionReadingMatrix("years", slug)!;
    expect(personal.birth).toBe(matrix.birth);
    expect(anonymous.birth).toBe("");

    const now = new Date("2026-09-01T12:00:00Z");
    const named = buildSectionReading("years", personal, now);
    const plain = buildSectionReading("years", anonymous, now);
    expect(named.title).toContain("31 марта 1993");
    expect(plain.title).toBe(`Разбор по десятилетиям до 80 лет: линия ${slug}`);
    // Восемь периодов остаются, но текущий этап не выдумывается по чужой матрице.
    expect(plain.agePeriods).toHaveLength(8);
    expect(plain.agePeriods!.some((period) => period.current || period.next)).toBe(false);
    expect(named.agePeriods!.filter((period) => period.current)).toHaveLength(1);
    expect(plain.summary).not.toMatch(/Сейчас возраст|за пределами шкалы/);
  });

  it("не принимает неизвестный результат ни в одном каталоге", () => {
    const unknown = Array.from({ length: 24 }, () => "22").join("-");
    for (const section of Object.keys(counts) as PersonalSectionKey[]) {
      expect(sectionReadingItem(section, unknown), section).toBeNull();
    }
  });

  // Оговорка раздела — единственное место, где продукт отказывается от обещания. Сюжет повтора
  // аркана раньше замещал предметный итог и уносил её с собой на 2 190 разборах.
  const guards: Partial<Record<PersonalSectionKey, string>> = {
    profession: "не список обязательных профессий",
    karma40: "в день сорокалетия",
    resources: "не обещает богатства",
    money: "не прогнозирует сумму",
    money40: "в день сорокалетия",
    relations: "не совместимость двух дат",
    parents_children: "есть ли у человека дети",
    ancestry: "семь отдельных поколений",
    body_resource: "не заключение о состоянии",
    loops: "становится «программой»",
  };

  it("проходит каждый достижимый результат без пустых ролей и выводов", () => {
    const problems: string[] = [];
    for (const section of Object.keys(counts) as PersonalSectionKey[]) {
      for (const slug of sectionReadingSlugs(section)) {
        const item = sectionReadingItem(section, slug);
        if (!item) {
          problems.push(`${section}:${slug}: нет матрицы`);
          continue;
        }
        try {
          const reading = buildSectionReading(section, item.matrix, new Date("2026-09-01T12:00:00Z"));
          if (reading.slug !== slug || !reading.summary || !reading.practice) problems.push(`${section}:${slug}: пустой итог`);
          if (reading.roles.some((role) => !role.essence || !role.strength || !role.risk || !role.action)) {
            problems.push(`${section}:${slug}: пустой кубик роли`);
          }
          if (!reading.interactions.length) problems.push(`${section}:${slug}: нет связей`);
          // Кубик роли и шаблон вокруг него оба ставили свой знак: «…не выгорает..» уезжало
          // в энциклопедию, отчёт и PDF. Проверяем весь видимый текст, а не только итог.
          // Поиск по подстроке, а не регуляркой: обход идёт по 26 284 разборам.
          const visible = [
            reading.summary, reading.strength, reading.tension, reading.practice,
            ...reading.interactions.flatMap((item) => item.paragraphs),
            ...reading.roles.flatMap((role) => [role.essence, role.strength, role.risk, role.action]),
          ].join("  ");
          const bad = ["..", ".;", ",,", " ,", " .", " ;", "::"].find(
            (mark) => visible.includes(mark) && !(mark === ".." && visible.includes("...")),
          );
          if (bad) {
            const at = visible.indexOf(bad);
            problems.push(`${section}:${slug}: сдвоенный знак «${visible.slice(Math.max(0, at - 40), at + 2)}»`);
          }
          // Кубик бывает придаточным к «человек» и готовым предложением: рамка «когда человек …»
          // подходит только первому, иначе выходит «в позиции R2 человек Движение теряет опору».
          const framed = /человек\s+[А-ЯЁ]/.exec(visible);
          if (framed) {
            problems.push(`${section}:${slug}: рамка на готовом предложении «${visible.slice(Math.max(0, framed.index - 40), framed.index + 40)}»`);
          }
          const guard = guards[section];
          if (guard && !reading.summary.includes(guard)) {
            problems.push(`${section}:${slug}: из итога пропала оговорка «${guard}»`);
          }
        } catch (error) {
          problems.push(`${section}:${slug}: ${String(error)}`);
        }
      }
    }
    expect(problems).toEqual([]);
    // Обход всех 26 284 разборов со сборкой видимого текста не укладывается в дефолтные 5 с.
  }, 30_000);

  // Блок «Те же точки в разделе …» вёл на разбор чужой матрицы у 89,8 % дат: слаг «Программ» не
  // определяет слаг отдыха, а адрес строился из матрицы, восстановленной по слагу. Персональная
  // ссылка допустима только там, где целевой слаг однозначно выводится из исходного.
  it("ведёт из блока общих точек только на разбор той же матрицы", () => {
    const problems: string[] = [];
    for (const [from, to] of [["loops", "rest"], ["money40", "resources"], ["realisation", "purpose"]] as const) {
      for (const slug of matrixSlugs().slice(0, 600)) {
        const matrix = matrixItem(slug)!.matrix;
        const reading = buildSectionReading(from, sectionReadingMatrix(from, sectionReadingSlug(from, matrix))!);
        const block = reading.interactions.find((item) => item.key.startsWith("shared:"));
        if (!block?.href) continue;
        if (!block.href.startsWith(`/encyclopedia/${to}/`)) continue;
        const own = `/encyclopedia/${to}/${sectionReadingSlug(to, matrix)}`;
        if (block.href !== own) problems.push(`${from}/${slug}: ${block.href} вместо ${own}`);
      }
    }
    expect(problems.slice(0, 3)).toEqual([]);
  });

  it("даёт каждому разделу свою подпись к персональному примеру", () => {
    const matrix = calculate("1993-03-31", "f");
    const notes = (Object.keys(counts) as PersonalSectionKey[]).map((section) => sectionExampleNote(section, matrix));
    expect(new Set(notes).size).toBe(notes.length);
    for (const note of notes) expect(note.length).toBeGreaterThan(120);
  });

  it("сохраняет точную карту чакр в URL и текущий возраст через параметр персональной ссылки", () => {
    const actual = calculate("1993-03-31", "f");
    const chakraSlug = sectionReadingSlug("chakras", actual);
    expect(sectionReadingMatrix("chakras", chakraSlug)?.chakras).toEqual(actual.chakras);
    const yearSlug = actual.age_scale.map((period) => period.arcanum).join("-");
    expect(sectionReadingMatrix("years", yearSlug, { birth: actual.birth })?.birth).toBe(actual.birth);
    expect(sectionReadingMatrix("years", yearSlug, { birth: "not-a-date" })).toBeNull();
  });
});
