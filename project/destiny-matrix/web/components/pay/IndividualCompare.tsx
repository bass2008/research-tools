"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import RichText from "@/components/ui/RichText";
import { useIndividualTerms } from "@/components/pay/IndividualOffer";
import { D } from "@/lib/i18n";
import { priceWords } from "@/lib/individualMoney";

// a price or "3 рабочих" never breaks away from its number, a dash never starts a line
const nb = (s: string) => s.replace(/(\d) (?=\d|₽|рабоч|месяц|тысяч|год|working|month)/g, "$1\u00a0").replace(/ —/g, "\u00a0—");

/** Automatic against individual, face to face: the row name sits between the two answers. */
export default function IndividualCompare({ toc = false }: { toc?: boolean } = {}) {
  const L = useLocale();
  const T = D.individualSale;
  const P = priceWords(useIndividualTerms().prices, L);
  return (
    <section className="icmp" aria-labelledby="icmp-h" data-testid="individual-compare">
      <p className="isale-divider">{T.compareEyebrow[L]}</p>
      <h2 id="icmp-h" data-toc={toc ? "" : undefined}>{T.compareTitle[L]}</h2>
      <div className="icmp-box" role="table" aria-labelledby="icmp-h">
        <div className="icmp-row icmp-hd" role="row">
          <div className="a" role="columnheader"><strong>{T.compareAuto[L]}</strong><small>{T.compareAutoSub[L]}</small></div>
          <span className="vs" aria-hidden="true">vs</span>
          <div className="b" role="columnheader"><strong>✦&nbsp;{T.compareInd[L]}</strong><small>{T.compareIndSub[L](P)}</small></div>
        </div>
        {T.compareRows[L](P).map(([label, auto, ind]) => (
          <div className="icmp-row" role="row" key={label}>
            <div className="a" role="cell">{auto ? <RichText text={nb(auto)} /> : <span className="no">—</span>}</div>
            <span className="k" role="rowheader">{label}</span>
            <div className="b" role="cell"><RichText text={nb(ind)} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
