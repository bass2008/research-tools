"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { track } from "@/lib/analytics";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { rub } from "@/lib/individualMoney";
import { EMPTY_CART, KIND_CARDS, cartQuery } from "@/lib/individualPricing";
import { alignBirth } from "@/lib/storage";
import { useBirth } from "@/lib/useBirth";
import { yearMatrix } from "@/lib/yearMatrix";

const mask = (raw: string) => {
  const v = raw.replace(/\D/g, "").slice(0, 8);
  return v.length > 4 ? `${v.slice(0, 2)}.${v.slice(2, 4)}.${v.slice(4)}` : v.length > 2 ? `${v.slice(0, 2)}.${v.slice(2)}` : v;
};

function parse(value: string, before: number) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCDate() === d && date.getUTCMonth() === mo - 1 && y >= 1900 && y < before ? { y, m: mo, d } : null;
}

/** Offer of the individual year reading on the year pages: the reader's own year by date, then the order. */
export default function YearReadingBanner({ arcanum, year, years, price, place }: {
  arcanum?: number; year: number; years: [number, number]; price: number; place: string;
}) {
  const L = useLocale();
  const T = D.individualSale;
  const { arcanumTitle } = arcanaForLocale(L);
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState(year);
  const [birth, setBirth] = useState<{ y: number; m: number; d: number } | null>(null);
  const stored = useBirth();
  const pad = (n: number) => String(n).padStart(2, "0");
  // the date typed here becomes the first person of the order form on /pay
  const order = () => {
    track("individual_year_order", { place });
    if (birth) alignBirth({ birth: `${birth.y}-${pad(birth.m)}-${pad(birth.d)}`, sex: stored?.sex ?? "f" });
  };
  const [error, setError] = useState(false);
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  const field = useId();

  const shown = useMemo(() => {
    if (!birth) return null;
    const y = yearMatrix(birth, picked);
    return { centre: y.centre, text: T.yearFor[L](T.yourYear[L](picked), `${y.centre} ${arcanumTitle(y.centre)}`,
      y.periods.map((n) => arcanumTitle(n)) as [string, string, string]) };
  }, [birth, picked, L, T, arcanumTitle]);
  const asked = Boolean(birth);
  useEffect(() => {
    if (!asked) return;
    let alive = true;
    fetch("/api/year-meanings", { headers: { "Accept-Language": L } })
      .then((res) => (res.ok ? res.json() : {}))
      .then((body) => { if (alive) setMeanings(body as Record<string, string>); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [asked, L]);

  const show = (e: React.FormEvent) => {
    e.preventDefault();
    const found = parse(input, years[0]);
    setBirth(found);
    setError(!found);
    if (found) track("individual_year_date", { place });
  };

  return (
    <aside className="yb" aria-label={T.yearBannerKicker[L].replace("✦ ", "")} data-testid="year-reading-banner">
      <div className="yb-fan" aria-hidden="true">
        {KIND_CARDS.year.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" loading="lazy" />)}
      </div>
      <div className="yb-body">
        <p className="yb-kicker">{T.yearBannerKicker[L]}</p>
        <p className="yb-title">{T.yearBannerTitle[L](arcanum ? arcanumTitle(arcanum) : "")}</p>
        <p className="yb-text"><RichText text={T.yearBannerText[L]} /></p>
        <form className="yb-form" autoComplete="off" onSubmit={show}>
          <div className="yb-years" role="group" aria-label={T.yearBannerYear[L]}>
            <span>{T.yearBannerYear[L]}</span>
            {years.map((y) => <button key={y} type="button" aria-pressed={y === picked} className={y === picked ? "on" : undefined}
              onClick={() => setPicked(y)}>{y}</button>)}
          </div>
          <label htmlFor={field}>{T.yearBannerDate[L]}</label>
          <div className="yb-row">
            <input id={field} inputMode="numeric" placeholder={L === "en" ? "DD.MM.YYYY" : "ДД.ММ.ГГГГ"} maxLength={10} value={input}
              onChange={(e) => { setInput(mask(e.target.value)); setError(false); }} />
            <button type="submit">{T.yearBannerShow[L](picked)}</button>
          </div>
          {error && <p className="yb-err">{T.yearBannerDateError[L]}</p>}
        </form>
        {shown && <div className="yb-result" data-testid="year-reading-result">
          <p><RichText text={shown.text} /></p>
          {meanings[shown.centre] && <p className="yb-mean">{meanings[shown.centre]}</p>}
          {shown.centre !== arcanum && <Link className="yb-more" href={`/year/${shown.centre}`} data-testid="year-reading-more">{T.yearBannerMore[L](`${shown.centre} ${arcanumTitle(shown.centre)}`)}</Link>}
          <small>{T.yearBannerHint[L]}</small>
        </div>}
        <div className="yb-cta">
          <Link className="yb-btn" onClick={order} href={`/pay?${cartQuery({ ...EMPTY_CART, year: 1 }, picked)}#order`}>{T.yearBannerOrder[L](picked, rub(price, L))}</Link>
          <Link className="yb-link" href="/matrix/individual-example/year">{T.yearBannerExample[L]}</Link>
        </div>
        <p className="yb-fine">{T.yearBannerFine[L]}</p>
      </div>
    </aside>
  );
}
