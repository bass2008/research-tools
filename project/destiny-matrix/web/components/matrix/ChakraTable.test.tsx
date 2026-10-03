import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import ChakraTable from "./ChakraTable";

// Browser interactions and payment transitions are covered in e2e/test_chakra_atlas.py.
// These checks cover the first server render and the non-interactive PDF variant.
for (const locale of ["ru", "en"] as const) {
  const matrix = matrixForLocale(locale).calculate("1993-03-31", "m");
  describe(`chakra atlas (${locale})`, () => {
    it("shows all cards and seven locks before payment, without reading text", () => {
      const html = renderToStaticMarkup(<ChakraTable m={matrix} locale={locale} />);
      expect(html.match(/class="lockico"/g)).toHaveLength(7);
      expect(html.match(/data-column=/g)).toHaveLength(21);
      expect(html).toContain('data-access="locked"');
      expect(html).not.toContain('data-testid="chakra-copy"');
      expect(html).not.toContain("Вам легче идти в новое");
      if (locale === "en") expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/[А-Яа-яЁё]/);
    });
    it("removes the locks after the report grants access", () => {
      const html = renderToStaticMarkup(<ChakraTable m={matrix} locale={locale} unlocked />);
      expect(html).toContain('data-access="open"');
      expect(html).not.toContain('class="lockico"');
      expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(8);
    });
    it("prints every card with no dialogs or purchase controls", () => {
      const html = renderToStaticMarkup(<ChakraTable m={matrix} locale={locale} unlocked printing />);
      expect(html.match(/data-column=/g)).toHaveLength(21);
      expect(html.match(/src="\/img\/arcana\/half\/gen-/g)).toHaveLength(21);
      expect(html).not.toContain("<button");
      expect(html).not.toContain("<dialog");
      expect(html).not.toContain("lockico");
    });
  });
}
