import { expect, it } from "vitest";
import { configuredSites } from "@/lib/siteProfile";
import { printHref } from "./PrintLinks";

it("prints internal links as public addresses of the article language", () => {
  const ru = configuredSites().find((s) => s.origin === "https://arcana-sense.ru")!;
  expect(printHref(ru, "ru")("/encyclopedia/position/profession/8")).toBe("https://arcana-sense.ru/ru/encyclopedia/position/profession/8");
  expect(printHref(ru, "en")("/encyclopedia/arcanum/8")).toBe("https://arcana-sense.com/en/encyclopedia/arcanum/8");
  for (const href of ["https://litres.com/book", "//cdn.example/x", "#faq"]) expect(printHref(ru, "ru")(href)).toBe(href);
});
