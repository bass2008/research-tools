"use client";

import { useMemo } from "react";
import LinksMap from "@/components/individual/landing/LinksMap";
import { onePrice, useIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";
import { LIGHT_COLORS } from "@/lib/individualLinks";
import { rub } from "@/lib/individualMoney";
import type { Matrix } from "@/lib/matrix";
import { alignBirth, savePair } from "@/lib/storage";
import "@/app/individual/landing.css";

type Couple = { a: string; b: string; names: { a: string; b: string } };

// The links block of the landing under a reading: the person's chart under the report, the couple's under the pair.
export default function IndividualLinksOffer(props: { matrix: Matrix } | { pair: Couple }) {
  const L = useLocale();
  const T = D.individualSale;
  const terms = useIndividualTerms();
  const matrix = "matrix" in props ? props.matrix : null, pair = "pair" in props ? props.pair : null;
  const place = matrix ? "report" : "pair";
  const birth = matrix?.birth, pa = pair?.a, pb = pair?.b, na = pair?.names.a, nb = pair?.names.b;
  const date = useMemo(() => { if (!birth) return undefined; const [y, m, d] = birth.split("-").map(Number); return { y, m, d }; }, [birth]);
  const couple = useMemo(() => pa && pb ? { a: pa, b: pb, names: { a: na ?? "", b: nb ?? "" } } : undefined, [pa, pb, na, nb]);
  const shown = L === "ru" && terms.payable;
  if (!shown) return null;
  const order = () => {
    track("individual_report_order", { place });
    if (matrix) alignBirth({ birth: matrix.birth, sex: matrix.sex });
    if (pair) savePair({ a: { birth: pair.a }, b: { birth: pair.b } });
  };
  const orderButton = <Link className="lm-btn lm-btn-gold" href={matrix ? "/pay?personal=1#order" : "/pay?pair=1#order"} onClick={order}
    data-testid={`${place}-offer-order`}>{T.reportOfferOrder[L](rub(onePrice(terms), L))}</Link>;
  const exampleButton = <Link className="lm-btn lm-btn-ghost lm-ex" href={`/matrix/individual-example/${matrix ? "personal" : "pair"}`}
    data-testid={`${place}-offer-example`}>{matrix ? T.reportOfferExample[L] : `${D.individualLanding.exLabel[L].pair} →`}</Link>;
  return (
    <div className="ro-links" data-testid={`${place}-individual-offer`}>
      <LinksMap key={birth ?? `${pa}+${pb}`} id={`${place}-links`} date={date} pair={couple} palette={LIGHT_COLORS} place={place}
        cta={<>{orderButton}{exampleButton}</>}
        endCta={<>{orderButton}{exampleButton}<Link className="lm-btn lm-btn-ghost" href="/individual" data-testid={`${place}-offer-more`}>{T.reportOfferMore[L]}</Link></>} />
    </div>
  );
}
