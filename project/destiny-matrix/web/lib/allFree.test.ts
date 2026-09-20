import { describe, expect, it } from "vitest";

import { createPublicSettings } from "./settings/public";

describe("витрина без оплаты", () => {
  it("выключена, пока переменная не задана", () => {
    expect(createPublicSettings({}).get("allFree")).toBe(false);
    expect(createPublicSettings({ NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT: "" }).get("allFree")).toBe(false);
    expect(createPublicSettings({ NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT: "0" }).get("allFree")).toBe(false);
  });

  it("включается только явным значением", () => {
    for (const raw of ["1", "true", "yes", "on", "TRUE"]) {
      expect(createPublicSettings({ NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT: raw }).get("allFree")).toBe(true);
    }
  });

  it("видна в снимке настроек админки", () => {
    const row = createPublicSettings({ NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT: "1" })
      .snapshot()
      .find((item) => item.name === "NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT");
    expect(row).toMatchObject({ value: "true", source: "environment", sensitive: false });
  });
});
