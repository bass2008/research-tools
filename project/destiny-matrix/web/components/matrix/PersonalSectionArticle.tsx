import Link from "next/link";

import type { LongformReading } from "@/lib/readingTypes";
import { D, L } from "@/lib/i18n";
import { positionHref } from "@/lib/publicSpec";
import type { PersonalSectionKey } from "@/lib/sectionReadings";

import CharacterReadingView from "./CharacterReadingView";

export default function PersonalSectionArticle({
  sectionKey,
  sectionTitle,
  reading,
}: {
  sectionKey: PersonalSectionKey;
  sectionTitle: string;
  reading: LongformReading;
}) {
  return (
    <>
      <p className="eyebrow">{D.sheet.personalEyebrow[L]}</p>
      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.lead}</p>

      <CharacterReadingView reading={reading} />

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
