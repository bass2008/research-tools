import { describe, expect, it } from "vitest";

import {
  ENCYCLOPEDIA_SECTIONS,
  encyclopediaSectionFromPath,
  encyclopediaSectionFromExternalRoot,
  encyclopediaSectionFromSegment,
  encyclopediaSectionHref,
} from "./encyclopediaNavigation";

describe("единый реестр навигации энциклопедии", () => {
  it("содержит восемь уникальных разделов и канонические ссылки", () => {
    const keys = ENCYCLOPEDIA_SECTIONS.map((section) => section.key);
    expect(keys).toEqual(["arc", "sec", "pts", "chk", "tls", "yer", "cmb", "art"]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(encyclopediaSectionHref(key)).toBe(`/encyclopedia?sec=${key}`);
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
    expect(encyclopediaSectionFromPath("/encyclopedia/position/day", positions, articles)).toBe("pts");
    expect(encyclopediaSectionFromPath("/encyclopedia/karmic-tail/15-8-11", positions, articles)).toBe("tls");
    expect(encyclopediaSectionFromPath("/encyclopedia/karmic-tail", positions, articles)).toBe("art");
    expect(encyclopediaSectionFromPath("/na-god/2026", positions, articles)).toBe("yer");
    expect(encyclopediaSectionFromPath("/na-god", positions, articles)).toBe("art");
    expect(encyclopediaSectionFromPath("/o-metode", positions, articles)).toBe("art");
  });
});
