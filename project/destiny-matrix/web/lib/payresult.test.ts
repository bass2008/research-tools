import { describe, expect, it } from "vitest";

import { D, L } from "./i18n";
import { resultTitle } from "./payresult";

// Заголовки приходят из словаря языка: сверять их с вшитой русской строкой значило бы проверять
// сборку одного языка и падать на любой другой. Сторожит тест не текст, а соответствие стадии
// своему заголовку — и то, что разные стадии не выглядят одинаково.
describe("заголовок страницы возврата из оплаты", () => {
  it("не обещает успех, пока банк не ответил", () => {
    expect(resultTitle("checking")).toBe(D.payResult.stageChecking[L]);
  });

  it.each([
    ["paid", "stagePaid"],
    ["failed", "stageFailed"],
    ["pending", "stagePending"],
    ["error", "stageUnknown"],
  ] as const)("%s берёт заголовок из %s", (stage, key) => {
    expect(resultTitle(stage)).toBe(D.payResult[key][L]);
  });

  it("у каждой стадии свой заголовок", () => {
    const stages = ["checking", "paid", "refunded", "failed", "pending", "error"] as const;
    const titles = stages.map(resultTitle);
    expect(new Set(titles).size, titles.join(" / ")).toBe(stages.length);
    for (const title of titles) expect(title.trim().length).toBeGreaterThan(0);
  });
});

describe("возвращённый платёж", () => {
  it("не выдаётся за успешную оплату", () => {
    expect(resultTitle("refunded")).toBe(D.payResult.stageRefunded[L]);
    expect(resultTitle("refunded")).not.toBe(resultTitle("paid"));
  });
});
