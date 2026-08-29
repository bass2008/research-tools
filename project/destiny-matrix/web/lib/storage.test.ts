import { afterEach, describe, expect, it } from "vitest";

import {
  clearBirth,
  loadBirth,
  saveBirth,
  takeCalculationRequest,
} from "./storage";

afterEach(() => clearBirth());

describe("calculation request", () => {
  it("is consumed once without losing the selected birth", () => {
    const birth = { birth: "1993-03-31", sex: "m" as const };

    saveBirth(birth);

    expect(takeCalculationRequest()).toEqual(birth);
    expect(takeCalculationRequest()).toBeNull();
    expect(loadBirth()).toEqual(birth);
  });
});
