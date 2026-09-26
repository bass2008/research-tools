import { expect, it } from "vitest";
import { INTERNATIONAL_RU } from "./international";
import { TERMS } from "./terms";
import { PRIVACY } from "./privacy";
import { REFUND } from "./refund";
import { forLocale } from "../site";
import { DEFAULT_SITE } from "../siteProfile";

function structure(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structure);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) =>
    [k, ["legal", "link", "only", "tariffs"].includes(k) ? v : structure(v)]));
  return typeof value === "string" ? "text" : value;
}
it("translates the international documents without changing sections, links, identity or paid/free visibility", () => {
  for (const [key, original] of Object.entries({terms: TERMS.en, privacy: PRIVACY.en, refund: REFUND.en})) {
    expect(structure(INTERNATIONAL_RU[key as keyof typeof INTERNATIONAL_RU])).toEqual(structure(original));
  }
});
it("keeps domain legal details while formatting display fields in the selected language", () => {
  const site = {...DEFAULT_SITE, legalLocale: "en" as const};
  const ru = forLocale("ru", site).LEGAL, en = forLocale("en", site).LEGAL;
  for (const key of ["entity", "inn", "ogrnip", "email", "site", "bank"] as const) expect(ru[key]).toBe(en[key]);
  expect(ru.updated).toBe("20 сентября 2026");
  expect(en.updated).toBe("20 September 2026");
  expect(ru.entity).toBe("Arcana Sense");
  expect(ru.inn).toBe("");
});
