import { describe, expect, it } from "vitest";
import { individualExample } from "./individualExamples";
import { SAMPLE_BIRTH } from "./individualSample";

describe("дата примера на странице оплаты", () => {
  it("совпадает с датой личного примера на обоих языках", () => {
    expect(individualExample("personal", "ru")?.inputs.birth).toBe(SAMPLE_BIRTH);
    expect(individualExample("personal", "en")?.inputs.birth).toBe(SAMPLE_BIRTH);
  });
});
