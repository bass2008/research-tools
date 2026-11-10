import { describe, expect, it } from "vitest";
import articleV1 from "./__fixtures__/mobile-content-v1.json";
import { isMobileArticle } from "./mobileContentContract";

describe("installed mobile contract v1", () => {
  it("continues accepting the saved article excerpt and additive fields", () => {
    expect(isMobileArticle(articleV1)).toBe(true);
    expect(isMobileArticle({ ...articleV1, futureOptionalField: "ignored" })).toBe(true);
  });
  it("rejects unknown blocks and malformed private access expiry", () => {
    expect(isMobileArticle({ ...articleV1, blocks: [{ type: "unknown" }] })).toBe(false);
    expect(isMobileArticle({ ...articleV1, access: "private", accessUntil: "not-a-date" })).toBe(false);
  });
});
