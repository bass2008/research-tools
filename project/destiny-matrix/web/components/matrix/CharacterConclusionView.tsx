import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import type { ReadingConclusion } from "@/lib/readingTypes";

/** Компактный персональный итог; длинные связи остаются в статье энциклопедии. */
export default function CharacterConclusionView({ locale: requestedLocale, ...localeProps }: ({
  reading: ReadingConclusion;
  label?: string;
  showSummary?: boolean;
  idPrefix?: string;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    reading,
    label = D.report.tripleSummary[L],
    showSummary = true,
    idPrefix = "character-reading",
  } = localeProps;

  const resultTitleId = `${idPrefix}-result-title`;
  return (
    <div className="character-compact" data-testid="character-conclusion">
      {showSummary ? (
        <div className="character-summary panel">
          <p className="cap">{label}</p>
          <p>{reading.summary}</p>
        </div>
      ) : null}
      <section className="character-conclusion section-gap" aria-labelledby={resultTitleId}>
        <h2 id={resultTitleId}>{D.sheet.conclusionTitle[L]}</h2>
        <div className="panel">
          <h3>{D.sheet.mainStrength[L]}</h3>
          <p>{reading.strength}</p>
        </div>
        <div className="panel">
          <h3>{D.sheet.mainTension[L]}</h3>
          <p>{reading.tension}</p>
        </div>
        <div className="panel">
          <h3>{D.sheet.practicalStep[L]}</h3>
          <p>{reading.practice}</p>
        </div>
      </section>
    </div>
  );
}
