import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import type { LongformReading } from "@/lib/readingTypes";
import type { PersonalSectionKey } from "@/lib/sectionReadings";
import Link from "next/link";
import CharacterReadingView from "./CharacterReadingView";

export const forLocale = localized((L: Locale) => {
  const { positionHref } = localizedPublicSpec(L);

  return { positionHref };
});

export default function PersonalSectionArticle({ locale: requestedLocale, ...localeProps }: ({
  sectionKey: PersonalSectionKey;
  sectionTitle: string;
  reading: LongformReading;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    sectionKey,
    sectionTitle,
    reading,
  } = localeProps;
  const { positionHref } = forLocale(L);

  return (
    <>
      <p className="eyebrow">{D.sheet.personalEyebrow[L]}</p>
      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.lead}</p>

      <CharacterReadingView locale={L} reading={reading} />

      <div className="allbox">
        <h2>{D.sheet.howSectionWorks[L](sectionTitle)}</h2>
        <p>
          {D.sheet.personalExplainer[L]}
        </p>
        <div className="btnrow center">
          <Link className="btn" href={positionHref(sectionKey)}>
            {D.sheet.openSectionArticle[L]}
          </Link>
          <Link className="btn ghost" href="/report">
            {D.sheet.backToReport[L]}
          </Link>
          <Link className="btn ghost" href="/#calc">
            {D.sheet.otherDate[L]}
          </Link>
        </div>
      </div>
    </>
  );
}
