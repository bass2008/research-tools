import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENCYCLOPEDIA_SECTIONS,
  encyclopediaSectionFromPath,
  encyclopediaSectionFromExternalRoot,
  encyclopediaSectionFromSegment,
  encyclopediaSectionCrumb,
  encyclopediaSectionHref,
  encyclopediaSectionHub,
} from "./encyclopediaNavigation";

describe("единый реестр навигации энциклопедии", () => {
  const keys = ENCYCLOPEDIA_SECTIONS.map((section) => section.key);

  it("содержит восемь уникальных разделов", () => {
    expect(keys).toEqual(["arc", "sec", "pts", "chk", "tls", "yer", "cmb", "art"]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // Раздел без своей страницы существовал только как фильтр `?sec=`: тот адрес несёт canonical
  // на /encyclopedia, поэтому крошка объявляла родителем то, чего в поиске нет.
  it("даёт каждой ветке справочника свою страницу", () => {
    const withoutHub = keys.filter((key) => encyclopediaSectionHub(key) === null);
    expect(withoutHub).toEqual(["art"]);
  });

  it("кладёт шапку на префикс своих листьев", () => {
    expect(encyclopediaSectionHub("arc")).toBe("/encyclopedia/arcanum");
    expect(encyclopediaSectionHub("chk")).toBe("/encyclopedia/chakra");
    expect(encyclopediaSectionHub("cmb")).toBe("/encyclopedia/combination");
    expect(encyclopediaSectionHub("tls")).toBe("/encyclopedia/karmic-tail");
    expect(encyclopediaSectionHub("yer")).toBe("/na-god");
  });

  // «Разделы отчёта» и «Позиции карты» — один роут `position/[key]`, поэтому и одна шапка.
  it("сводит две половины позиций на общую шапку", () => {
    expect(encyclopediaSectionHub("sec")).toBe("/encyclopedia/position");
    expect(encyclopediaSectionHub("pts")).toBe("/encyclopedia/position");
  });

  it("ведёт меню к половине страницы якорем, а крошку — к самой странице", () => {
    expect(encyclopediaSectionHref("sec")).toBe("/encyclopedia/position#razdely");
    expect(encyclopediaSectionHref("pts")).toBe("/encyclopedia/position#tochki");
    expect(encyclopediaSectionCrumb("sec").path).toBe("/encyclopedia/position");
    expect(encyclopediaSectionCrumb("pts").path).toBe("/encyclopedia/position");
  });

  it("не ставит якорь там, где раздел занимает страницу целиком", () => {
    for (const key of ["arc", "chk", "cmb", "tls", "yer"] as const) {
      expect(encyclopediaSectionHref(key)).toBe(encyclopediaSectionHub(key));
    }
  });

  // Единственный раздел без ветки: статьи — это адреса первого уровня.
  it("оставляет статьям фильтр, а не выдуманный адрес", () => {
    expect(encyclopediaSectionHref("art")).toBe("/encyclopedia?sec=art");
  });

  it("сопоставляет вложенные сегменты с тем же реестром", () => {
    expect(encyclopediaSectionFromSegment("arcanum")).toBe("arc");
    expect(encyclopediaSectionFromSegment("chakra")).toBe("chk");
    expect(encyclopediaSectionFromSegment("combination")).toBe("cmb");
    expect(encyclopediaSectionFromSegment("karmic-tail")).toBe("tls");
    expect(encyclopediaSectionFromSegment("unknown")).toBeNull();
    expect(encyclopediaSectionFromExternalRoot("na-god")).toBe("yer");
    expect(encyclopediaSectionFromExternalRoot("unknown")).toBeNull();
  });

  it("выбирает раздел для всех форм маршрутов без отдельных таблиц в компонентах", () => {
    const positions = { character: "sec", day: "pts" } as const;
    const articles = ["/encyclopedia/karmic-tail", "/na-god", "/o-metode"];
    expect(encyclopediaSectionFromPath("/encyclopedia", positions, articles)).toBeNull();
    expect(encyclopediaSectionFromPath("/encyclopedia/arcanum/15", positions, articles)).toBe("arc");
    expect(encyclopediaSectionFromPath("/encyclopedia/position/character", positions, articles)).toBe("sec");
    expect(encyclopediaSectionFromPath("/encyclopedia/character/4-3-22", positions, articles)).toBe("sec");
    expect(encyclopediaSectionFromPath("/encyclopedia/comfort/4-15-7", positions, articles)).toBe("sec");
    expect(encyclopediaSectionFromPath("/encyclopedia/profession/3-10-7", positions, articles)).toBe("sec");
    expect(encyclopediaSectionFromPath("/encyclopedia/position/day", positions, articles)).toBe("pts");
    expect(encyclopediaSectionFromPath("/encyclopedia/karmic-tail/15-8-11", positions, articles)).toBe("tls");
    // Шапка раздела — голова своей ветки, а не статья: иначе меню утверждает «Статьи», пока
    // рядом стоит неподсвеченным пункт собственного раздела.
    expect(encyclopediaSectionFromPath("/encyclopedia/karmic-tail", positions, articles)).toBe("tls");
    // Шапки новых разделов подсвечивают свой раздел, а не «Статьи».
    expect(encyclopediaSectionFromPath("/encyclopedia/arcanum", positions, articles)).toBe("arc");
    expect(encyclopediaSectionFromPath("/encyclopedia/chakra", positions, articles)).toBe("chk");
    expect(encyclopediaSectionFromPath("/encyclopedia/combination", positions, articles)).toBe("cmb");
    expect(encyclopediaSectionFromPath("/encyclopedia/position", positions, articles)).toBe("pts");
    expect(encyclopediaSectionFromPath("/na-god/2026", positions, articles)).toBe("yer");
    expect(encyclopediaSectionFromPath("/na-god", positions, articles)).toBe("yer");
    // Настоящая статья — адрес первого уровня без своей ветки: она остаётся в «Статьях».
    expect(encyclopediaSectionFromPath("/o-metode", positions, articles)).toBe("art");
  });

  // Адрес раздела зашивали в карусель первого экрана и в подвал листа позиции, и после переезда
  // на шапки эти три ссылки продолжали вести на фильтр. Единственный законный `?sec=` — у
  // «Статей»: ветки справочника у них нет.
  it("не оставляет адресов раздела мимо реестра", () => {
    const root = path.join(__dirname, "..");
    const skip = new Set(["node_modules", ".next", "content", "public", "scripts"]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        if (full.endsWith(path.join("lib", "encyclopediaNavigation.ts"))) continue;
        for (const line of readFileSync(full, "utf8").split("\n")) {
          if (/["`]\/encyclopedia\?sec=/.test(line)) offenders.push(`${path.relative(root, full)}: ${line.trim()}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
