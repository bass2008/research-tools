"use client";

import ChakraTable from "@/components/matrix/ChakraTable";
import CalcPromo from "@/components/matrix/CalcPromo";
import { useState } from "react";
import { chakraAtlas as copy } from "@/lib/i18n/dict/chakraAtlas";
import type { Lang } from "@/lib/i18n/lang";
import type { Matrix } from "@/lib/matrix";
import type { SiteProfile } from "@/lib/siteProfile";
import { useChakraAccess } from "@/lib/useChakraAccess";
import { useFullSections } from "@/lib/useFullSections";
import { useSavedDates } from "@/lib/useSavedDates";

// The article page is static, so access is resolved in the browser with the landing page's rule.
export default function ChakraAtlasExample({ m: initial, locale: L, site, promoTitle, promoLead, place = "chakra" }: {
  m: Matrix; locale: Lang; site: SiteProfile; promoTitle: string; promoLead: string; place?: string;
}) {
  const [m, setMatrix] = useState<Matrix | null>(initial);
  const { dates } = useSavedDates();
  const access = useChakraAccess(m, dates, useFullSections(m));

  return (
    <>
      {m ? <div className="section-gap">
        <ChakraTable site={site} locale={L} m={m} heading="h3" title={copy.exampleTitle[L]}
          reading={access.reading} readingStatus={access.readingStatus} unlocked={access.unlocked} matrixId={access.matrixId} />
      </div> : null}
      <div className="section-gap">
        <CalcPromo locale={L} title={promoTitle} lead={promoLead} place={place} onPreview={setMatrix} />
      </div>
    </>
  );
}
