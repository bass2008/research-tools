import { describe, expect, it } from "vitest";

import { isBlockedText, TEXT_POLICY_CASES } from "./textPolicy";

describe("каноническая политика текста", () => {
  it.each(TEXT_POLICY_CASES)("$text", ({ text, content_blocked }) => {
    expect(isBlockedText(text)).toBe(content_blocked);
  });
});
