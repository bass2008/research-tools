import { DEFAULT_SITE } from "@/lib/siteProfile";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import { BUSINESS_FREE, BUSINESS_SPHERES } from "@/lib/pair/business";
import { pairChakraKeys } from "@/lib/pair/chakraReading";
import { pairUnits, readingUnits, unit } from "@/lib/pair/corpus";
import { computePair } from "@/lib/pair/engine";
import { FREE, unitKeys, visible } from "@/lib/pair/spheres";
import PairReport from "./PairReport";

const dates = { a: "1993-03-31", b: "1994-12-28" };
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");

describe.each(["ru", "en"] as const)("регрессии разбора пары (%s)", (locale) => {
  const dates = { a: "2003-03-31", b: "2015-12-28" };
  const render = (dates: { a: string; b: string }, printing: boolean, units?: ReturnType<typeof pairUnits>) => {
    const result = computePair(dates.a, dates.b, locale);
    return renderToStaticMarkup(<PairReport locale={locale} result={result} title="Пара" names={{ a: "А", b: "Б" }}
      dates={dates} units={units ?? pairUnits(locale, result, dates, true)} mode="full" printing={printing} />);
  };
  for (const printing of [false, true]) {
    it(`перестановка сохранённой пары не теряет купленные тексты (${printing ? "PDF" : "экран"})`, () => {
      const dates = { a: "1988-01-01", b: "1988-03-01" };
      const saved = pairUnits(locale, computePair(dates.a, dates.b, locale), dates, true);
      const html = render({ a: dates.b, b: dates.a }, printing, saved);
      expect(text(html)).not.toContain(DP.stub[locale]);
    });
    it(`финансовая линия сохраняет тройку 7-14-7 (${printing ? "PDF" : "экран"})`, () => {
      const finance = render(dates, printing).match(/<details[^>]*data-sec="business-finance"[^>]*>([\s\S]*?)<\/details>/)![1];
      expect(text(finance.split("</summary>")[0])).toContain("7-14-7");
    });
    it(`усиление указывает дополнительную точку, не объявляя ровно два повтора (${printing ? "PDF" : "экран"})`, () => {
      const html = text(render(dates, printing));
      expect(html).toContain(locale === "ru" ? "H — нижний правый угол" : "H — bottom-right corner");
      expect(html).toContain(locale === "ru" ? "I — нижний левый угол" : "I — bottom-left corner");
      expect(html).not.toContain(locale === "ru" ? "стоит у вас дважды" : "appears twice");
    });
  }
});

describe.each(["ru", "en"] as const)("три позиции хвоста пары (%s)", (locale) => {
  const cases = [
    { a: "2003-03-31", b: "2015-12-28" }, // 9–15–15: повтор в середине и главной задаче
    { a: "1981-04-07", b: "2004-05-19" }, // 18–6–6
  ];
  for (const dates of cases) {
    const result = computePair(dates.a, dates.b, locale);
    const render = (mode: "full" | "free", printing = false) => renderToStaticMarkup(
      <PairReport locale={locale} result={result} title="Пара" names={{ a: "А", b: "Б" }} dates={dates}
        units={pairUnits(locale, result, dates, mode === "full")} mode={mode} printing={printing} />);

    for (const printing of [false, true]) it(`${dates.a} + ${dates.b}: все роли в ${printing ? "печати" : "открытом разборе"}`, () => {
      const tail = render("full", printing).match(/<details[^>]*data-sec="tasks"[^>]*>([\s\S]*?)<\/details>/)![1];
      expect(tail.match(/<figure\b/g)).toHaveLength(3);
      for (const role of ["taskIn", "taskMid", "task"] as const) expect(text(tail)).toContain(DP.role[role][locale]);
    });

    it(`${dates.a} + ${dates.b}: все роли видны и под замком`, () => {
      const html = render("free");
      const tail = html.slice(html.indexOf('data-testid="pair-preview-tasks"'), html.indexOf('data-testid="pair-lock-spoils"'));
      expect(tail.match(/data-position=/g)).toHaveLength(3);
      for (const role of ["taskIn", "taskMid", "task"] as const) expect(text(tail)).toContain(DP.role[role][locale]);
    });
  }
});

describe.each(["ru", "en"] as const)("хвост пары со статьёй в энциклопедии (%s)", (locale) => {
  const dates = { a: "1975-08-14", b: "1975-04-14" }; // 9–21–12
  const result = computePair(dates.a, dates.b, locale);
  const units = pairUnits(locale, result, dates, true);

  it("короткая версия статьи, ссылка на полную и ни одной ссылки на арканы", () => {
    const unit = units["tasks:9-21-12"];
    expect(unit?.report?.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(<PairReport locale={locale} result={result} title="Пара" names={{ a: "А", b: "Б" }}
      dates={dates} units={units} mode="full" printing={false} />);
    const tail = html.match(/<details[^>]*data-sec="tasks"[^>]*>([\s\S]*?)<\/details>/)![1];
    expect(tail).toContain(`href="/${DEFAULT_SITE.defaultLocale}/encyclopedia/compatibility/tails/9-21-12"`);
    expect(tail.replace(/<figure\b[\s\S]*?<\/figure>/g, "")).not.toMatch(/href="\/(?:ru|en)\/encyclopedia\/(compatibility|arcanum)\/\d+"/);
    expect(text(tail)).toContain(text(renderToStaticMarkup(<>{DP.moreTail[locale]("9-21-12")}</>)).trim());
    const first = unit!.report!.find((x): x is string => typeof x === "string")!;
    expect(text(tail)).toContain(text(renderToStaticMarkup(<>{first.slice(0, 40)}</>)).trim());
  });

  it("бесплатная статья открыта и без покупки: ссылка в «Главных числах»", () => {
    const html = renderToStaticMarkup(<PairReport locale={locale} result={result} title="Пара" names={{ a: "А", b: "Б" }}
      dates={dates} units={pairUnits(locale, result, dates, false)} mode="free" printing={false} />);
    expect(html).toMatch(/data-testid="pair-key-tail-link"[^>]*href="\/(?:ru|en)\/encyclopedia\/compatibility\/tails\/9-21-12"|href="\/(?:ru|en)\/encyclopedia\/compatibility\/tails\/9-21-12"[^>]*data-testid="pair-key-tail-link"/);
  });
});

describe.each(["ru", "en"] as const)("закрытая часть разбора пары (%s)", (locale) => {
  const result = computePair(dates.a, dates.b, locale);
  const { a, b, p } = result;
  const locked = visible(a, b).filter((s) => !FREE.includes(s.id));
  const render = (buyHref?: string) => renderToStaticMarkup(
    <PairReport locale={locale} result={result} title="Пара" names={{ a: "А", b: "Б" }} dates={dates}
      units={pairUnits(locale, result, dates, false)} mode="free" buyHref={buyHref} price="250 ₽" />);

  it("закрытые сферы — карты и кнопка, чакры — раскладка под замком", () => {
    const html = render("/pay?for=pair");
    const bizLocked = BUSINESS_SPHERES.length - BUSINESS_FREE.length;
    expect(html.match(/data-testid="pair-lock-(?!business)/g)).toHaveLength(locked.length + 1);
    expect(html.match(/data-testid="pair-lock-business-/g)).toHaveLength(bizLocked);
    expect(html.match(/data-testid="pair-buy-/g)).toHaveLength(locked.length + 1 + bizLocked);
    expect(html.match(/data-testid="chakra-lock-[^"]*"><a [^>]*href="\/(?:ru|en)\/pay\?for=pair"/g)).toHaveLength(8);
    expect(text(html)).toContain(DP.chakras.lockedRow[locale]);
    expect(text(html)).toContain(`${D.report.unlockSection[locale]}250 ₽`);
    expect(html).toContain(`href="/${DEFAULT_SITE.defaultLocale}/pay?for=pair"`);
  });

  it("платные тексты сфер и чакр в разметку не попадают", () => {
    const html = text(render("/pay?for=pair"));
    const paid = readingUnits(locale, a, b, p);
    const lockedKeys = locked.flatMap((s) => unitKeys(s, a, b, p));
    const chakraTexts = pairChakraKeys(locale, dates).map((key) => unit(locale, key));
    const pieces = [...lockedKeys.map((key) => paid[key]), ...chakraTexts]
      .flatMap((u) => (Array.isArray(u?.text) ? u.text : u?.text ? [u.text] : []))
      .map((paragraph) => paragraph.replace(/\s+/g, " ").slice(0, 60));
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) expect(html).not.toContain(piece);
  });

  it("без покупки (пример, подписчик) карты видны, кнопок нет", () => {
    const html = render(undefined);
    expect(html.match(/data-testid="pair-preview-/g)?.length).toBeGreaterThan(locked.length);
    expect(html).not.toContain('data-testid="pair-buy-');
    expect(html).not.toMatch(/data-testid="chakra-lock-[^"]*"><a /);
  });
});
