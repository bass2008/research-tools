import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { D } from "@/lib/i18n";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { forLocale as sectionsForLocale } from "@/lib/sections";

vi.mock("@/components/pay/TariffsProvider", () => ({
  useTariffs: () => [{ id: "single", name: "Разбор", price: 25000, scope: ["single"], period_days: null }],
  useLead: () => ({ id: "single", name: "Разбор", price: 25000, scope: ["single"], period_days: null }),
  usePriceKnown: () => true,
  usePaymentProviders: () => ["mock"],
}));

import ReportSections from "./ReportSections";

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/g, " ");

describe.each(["ru", "en"] as const)("закрытые разделы (%s)", (locale) => {
  const matrix = matrixForLocale(locale).calculate("1990-06-15", "f");
  const { build, withLockedPreview } = sectionsForLocale(locale);
  const { arcanumShort } = arcanaForLocale(locale);

  it("сетка карт, раскладка чакр под замком и кнопка раздела", () => {
    const sections = withLockedPreview(matrix, build(matrix, false));
    const html = renderToStaticMarkup(
      <ReportSections locale={locale} sections={sections} place="report" matrixId={7} />);
    expect(html.match(/data-locked="true"/g)).toHaveLength(18);
    expect(html.match(/class="mp"/g)).toHaveLength(17);
    const cards = sections.filter((s) => s.locked && s.key !== "chakras").flatMap((s) => s.positions);
    expect(html.match(/class="mpc"/g)).toHaveLength(cards.length);
    const gist = arcanumShort(cards[0].arcanum);
    expect(html).toContain(gist.charAt(0).toLocaleUpperCase(locale) + gist.slice(1));
    expect(html.match(/data-testid="section-buy-/g)).toHaveLength(18);
    expect(html.match(/href="\/(?:ru|en)\/pay\?for=personal&amp;m=7"/g)).toHaveLength(36 + 8);
    expect(html).toContain(D.report.unlockSection[locale]);

    const chakras = sections.find((s) => s.key === "chakras")!.longform!;
    expect(html).toContain('data-testid="chakras-locked"');
    for (const row of [...chakras.chakraRows!, chakras.energyField!]) {
      expect(html).toContain(D.report.lockedWords[locale](row.lockedWords!));
    }
    expect(html.match(/data-testid="chakra-lock-[^"]*"><a [^>]*href="\/(?:ru|en)\/pay\?for=personal&amp;m=7"/g)).toHaveLength(8);
    expect(html).not.toContain("chakras-reading");
    if (locale === "en") expect(text(html)).not.toMatch(/[А-Яа-яЁё]/);
  });

  it("после оплаты разделы открыты как раньше: без замков и заглушек", () => {
    const sections = withLockedPreview(matrix, build(matrix, true));
    const html = renderToStaticMarkup(<ReportSections locale={locale} sections={sections} matrixId={7} />);
    expect(html).not.toContain('data-locked="true"');
    expect(html).not.toContain("section-buy-");
    expect(html).not.toContain("chakra-lock-");
    expect(html).toContain('data-testid="chakras-reading"');
  });

  it("печать закрытого разбора — только строки разделов", () => {
    const sections = withLockedPreview(matrix, build(matrix, false));
    const html = renderToStaticMarkup(<ReportSections locale={locale} sections={sections} printing />);
    expect(html.match(/data-locked="true"/g)).toHaveLength(18);
    expect(html).not.toContain('class="mp"');
    expect(html).not.toContain("chakras-locked");
  });
});
