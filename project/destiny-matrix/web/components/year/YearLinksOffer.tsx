"use client";

import { useCallback, useState } from "react";
import LinksMap from "@/components/individual/landing/LinksMap";
import { useIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";
import { LIGHT_COLORS } from "@/lib/individualLinks";
import { rub } from "@/lib/individualMoney";
import { EMPTY_CART, cartQuery } from "@/lib/individualPricing";
import { alignBirth } from "@/lib/storage";
import { useBirth } from "@/lib/useBirth";
import { yearModel } from "@/lib/yearLinks";
import "@/app/individual/landing.css";

// the date of the year example: the sample chart and the example it links to are the same person
const SAMPLE = "07.10.1988";
const EXAMPLE = "/matrix/individual-example/year";

/** The links block for the year: the visitor's date and year, the links of the year matrix, the order of the year reading. */
export default function YearLinksOffer({ year, years, price, place }: { year: number; years: [number, number]; price: number; place: string }) {
  const L = useLocale();
  const T = D.individualSale;
  const terms = useIndividualTerms();
  const [picked, setPicked] = useState(year);
  const [birth, setBirth] = useState<{ y: number; m: number; d: number } | null>(null);
  const stored = useBirth();
  const build = useCallback((d: { y: number; m: number; d: number }) => yearModel(L, d, picked), [L, picked]);
  const pad = (n: number) => String(n).padStart(2, "0");
  // the date typed here becomes the first person of the order form on /pay
  const order = () => {
    track("individual_year_order", { place });
    if (birth) alignBirth({ birth: `${birth.y}-${pad(birth.m)}-${pad(birth.d)}`, sex: stored?.sex ?? "f" });
  };
  const orderButton = <Link className="lm-btn lm-btn-gold" onClick={order} href={`/pay?${cartQuery({ ...EMPTY_CART, year: 1 }, picked)}#order`}
    data-testid="year-offer-order">{T.yearBannerOrder[L](picked, rub(terms.bought >= 3 ? terms.prices.after_three : price, L))}</Link>;
  const exampleButton = <Link className="lm-btn lm-btn-ghost lm-ex" href={EXAMPLE} data-testid="year-offer-example">{T.reportOfferExample[L]}</Link>;
  const years_ = <div className="yb-years lm-years" role="group" aria-label={T.yearBannerYear[L]}>
    <span>{T.yearBannerYear[L]}</span>
    {years.map((y) => <button key={y} type="button" aria-pressed={y === picked} className={y === picked ? "on" : undefined}
      onClick={() => setPicked(y)}>{y}</button>)}
  </div>;
  return (
    <div className="ro-links yl-links" data-testid="year-individual-offer">
      <LinksMap id="year-links" sample={SAMPLE} build={build} compact titleTag="p" formExtra={years_} submitLabel={T.yearBannerShow[L](picked)}
        palette={LIGHT_COLORS} place="year" dateGoal="individual_year_date" goalParams={{ place }} autoGoal={false} onDate={(d) => setBirth(d)}
        cta={<>{orderButton}{exampleButton}</>}
        endCta={<>{orderButton}{exampleButton}<Link className="lm-btn lm-btn-ghost" href="/individual" data-testid="year-offer-more">{T.reportOfferMore[L]}</Link></>} />
    </div>
  );
}
