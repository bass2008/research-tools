"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/components/account/useSession";
import { BirthPicker, isoOf, type PickedDate } from "@/components/pay/BirthPicker";
import { YearInput, forgetIndividualTerms } from "@/components/pay/IndividualOffer";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { track } from "@/lib/analytics";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { OWN, defaultChoices, defaultYears, problemOf, readingsOf, resolve, slotsOf, type Choices } from "@/lib/individualOrder";
import { workdaysFrom, type Cart } from "@/lib/individualPricing";
import type { Sex } from "@/lib/matrix";
import type { StoredBirth } from "@/lib/storage";
import type { PaymentProvider } from "@/lib/tariffs";
import { browserDay } from "@/lib/today";

const MIN_PASSWORD = 3;

function validDate(d: PickedDate): boolean {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day));
  const now = browserDay();
  return t.getUTCFullYear() === d.year && t.getUTCMonth() === d.month - 1 && t.getUTCDate() === d.day
    && t.getTime() <= Date.UTC(now.year, now.month - 1, now.day);
}

/** Who each reading is for, a question, the account and the payment — everything before paying. */
export default function OrderForm({ cart, baseYear, total, providers, payable, initialBirth, question, setQuestion, topics, latest, onDates, onYears, summary }: {
  cart: Cart; baseYear: number; total: string; providers: PaymentProvider[]; payable: boolean; initialBirth: StoredBirth | null;
  question: string; setQuestion: (q: string) => void; topics: ReactNode; latest: string;
  onDates: (dates: string[]) => void; onYears: (years: number[]) => void; summary: string;
}) {
  const L = useLocale();
  const T = D.individualSale;
  const TL = D.individualLanding;
  const { api } = localizedApi(L);
  const session = useSession();
  const { dateLabel } = localizedI18n(L);
  const slots = useMemo(() => slotsOf(cart), [cart]);
  const [choices, setChoices] = useState<Choices>(() => defaultChoices(cart));
  const [people, setPeople] = useState<Record<string, { date: PickedDate; sex: Sex }>>({});
  const [years, setYears] = useState<Record<string, number>>({});
  const [relations, setRelations] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<[string, string] | null>(null);
  const signedIn = session.status === "user";
  const mail = signedIn && session.email ? session.email : email.trim().toLowerCase();

  useEffect(() => { setChoices(defaultChoices(cart)); }, [cart]);

  const roles = slots.flatMap((s) => s.roles);
  const { owners, person } = resolve(slots, choices);
  const fallbackYears = defaultYears(slots, person, baseYear);
  const yearOf = (role: string) => years[role] || fallbackYears[role];
  const readings = readingsOf(slots, person, yearOf, (role) => relations[role] ?? "");
  const dateOf = (role: string) => people[role] ? dateLabel(isoOf(people[role].date), L) : "";
  const sourceOf = (role: string) => {
    const key = role[0] as "p" | "y" | "a" | "b";
    const kind = key === "p" ? "personal" : key === "y" ? "year" : "pair";
    return T.personSource[L][key](cart[kind] > 1 ? ` ${Number(role.slice(1)) + 1}` : "");
  };
  const ownerDates = owners.map(dateOf).filter(Boolean).join(", ");
  useEffect(() => { onDates(ownerDates ? ownerDates.split(", ") : []); }, [ownerDates, onDates]);
  const chosenYears = slots.filter((s) => s.kind === "year").map((s) => yearOf(s.roles[0])).join(",");
  useEffect(() => { onYears(chosenYears ? chosenYears.split(",").map(Number) : []); }, [chosenYears, onYears]);

  const choose = (role: string, target: string) => { setError(""); setChoices((c) => ({ ...c, [role]: target })); };
  const who = (role: string, label?: string) => {
    const before = owners.filter((o) => roles.indexOf(o) < roles.indexOf(role));
    if (!before.length) return null;
    const current = owners.includes(role) ? OWN : choices[role];
    return (
      <div className="lp-who-pick" role="group" aria-label={label ?? T.whoFor[L]}>
        {label === undefined && <span className="lp-lbl2">{T.whoFor[L]}</span>}
        <div className="lp-topics">
          {[...before, OWN].map((o) => (
            <button key={o} type="button" className={current === o ? "lp-on" : undefined} aria-pressed={current === o}
              disabled={busy} onClick={() => choose(role, o)}>{o === OWN ? T.otherPerson[L] : `${dateOf(o)} · ${sourceOf(o)}`}</button>
          ))}
        </div>
      </div>
    );
  };
  // kept mounted while someone else is chosen: switching back must not lose the typed date
  const picker = (role: string) => (
    <div hidden={!owners.includes(role)}>
      <BirthPicker locale={L} idPrefix={`lp-${role}`} initial={role === roles[0] ? initialBirth : null} ready disabled={busy}
        onChange={(value) => setPeople((p) => ({ ...p, [role]: value }))} />
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!readings.length) return setError(T.errEmpty[L]);
    if (owners.some((o) => !people[o] || !validDate(people[o].date))) return setError(T.errDate[L]);
    const problem = problemOf(readings);
    if (problem) return setError(problem === "samePerson" ? T.errSamePerson[L] : T.errDuplicate[L]);
    if (!signedIn && password.length < MIN_PASSWORD) return setError(D.payForm.errors.shortPassword[L](MIN_PASSWORD));
    if (!agreed) return setError(D.payForm.errors.consent[L]);
    setBusy(true);
    track("individual_order_submit", { count: readings.length });
    try {
      if (!signedIn) {
        try {
          await api.register(mail, password);
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 400) throw err;
          await api.login(mail, password);
        }
        await session.refresh();
      }
      const persons = owners.map((o) => ({ birth: isoOf(people[o].date), sex: people[o].sex === "m" ? "m" as const : "f" as const }));
      const res = await api.individualOrder({ email: mail, persons, readings, question }, providers[0]?.id);
      forgetIndividualTerms();
      if (res.payment_url) {
        window.location.href = res.payment_url;
        return;
      }
      const today = browserDay();
      setDone([dateLabel(workdaysFrom(today, 1), L), dateLabel(workdaysFrom(today, 3), L)]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(D.payForm.errors.wrongPassword[L]);
      else if (err instanceof ApiError) setError(err.messageFor(L).replace(/[.!…]?$/, ".") + (err.status ? D.payForm.errors.notCharged[L] : ""));
      else setError(D.payForm.errors.generic[L]);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="lp-form lp-ff lp-done" data-testid="iorder-done">
        <h3>{T.doneTitle[L]}</h3>
        <p>{T.doneText[L](done[0], done[1])}</p>
        <Link className="lp-btn lp-gold" href="/account?filter=individual">{T.toGolden[L]}</Link>
      </div>
    );
  }

  return (
    <form className="lp-form lp-ff" onSubmit={submit} noValidate data-testid="iorder">
      {slots.map((s) => (
        <fieldset className="lp-person" key={s.roles[0]} data-testid={`iorder-${s.roles[0]}`}>
          <legend>{T.slotTitle[L][s.kind]}{cart[s.kind] > 1 ? ` ${s.n + 1}` : ""}</legend>
          {s.kind === "pair" ? s.roles.map((role, i) => {
            const side = i ? T.secondPerson[L] : T.firstPerson[L];
            return <div className="lp-side" key={role}><span className="lp-lbl2">{side}</span>{who(role, side)}{picker(role)}</div>;
          }) : <>{s.kind === "year" && who(s.roles[0])}{picker(s.roles[0])}</>}
          {s.kind === "year" && (
            <label className="lp-fl lp-yrow">
              <span>{T.yearLabel[L]}</span>
              <YearInput value={yearOf(s.roles[0])} onChange={(y) => setYears((v) => ({ ...v, [s.roles[0]]: y }))} label={T.yearLabel[L]} />
            </label>
          )}
          {s.kind === "pair" && (
            <div className="lp-fl">
              <span>{T.relationLabel[L]}</span>
              <div className="lp-topics">
                {T.relations[L].map((r) => {
                  const on = relations[s.roles[0]] === r;
                  return <button key={r} type="button" className={on ? "lp-on" : undefined} aria-pressed={on}
                    onClick={() => setRelations((v) => ({ ...v, [s.roles[0]]: on ? "" : r }))}>{r}</button>;
                })}
              </div>
            </div>
          )}
        </fieldset>
      ))}
      <div className="lp-fl">
        <span>{T.questionLabel[L]}</span>
        {topics}
        <textarea id="lp-question" value={question} maxLength={5000} placeholder={TL.questionPlaceholder[L]} onChange={(e) => setQuestion(e.target.value)} disabled={busy} />
        <small>{T.questionHint[L]}</small>
      </div>
      {!signedIn && <>
        <label className="lp-fl"><span>{T.emailLabel[L]}</span>
          <input type="email" autoComplete="email" placeholder={TL.emailPlaceholder[L]} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} data-testid="iorder-email" />
          <small>{T.emailHint[L]}</small>
        </label>
        <label className="lp-fl"><span>{T.passwordLabel[L]}</span>
          <input type="password" autoComplete="new-password" placeholder={TL.passwordPlaceholder[L]} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} data-testid="iorder-password" />
        </label>
      </>}
      <label className="lp-check">
        <input type="checkbox" checked={agreed} onChange={(e) => { setError(""); setAgreed(e.target.checked); }} data-testid="iorder-consent" />
        <span>
          {D.payForm.consentHead[L]}{" "}
          <Link href="/privacy" target="_blank" rel="noopener">{D.payForm.consentPolicy[L]}</Link>
          {D.payForm.consentAccept[L]}{" "}
          <Link href="/terms" target="_blank" rel="noopener">{D.payForm.consentTerms[L]}</Link>{" "}
          {D.payForm.consentAnd[L]}{" "}
          <Link href="/refund" target="_blank" rel="noopener">{D.payForm.consentRefund[L]}</Link>.
        </span>
      </label>
      <div className="lp-pay">
        <p className="lp-mini-sum"><RichText text={summary} /></p>
        {owners.length > 0 && <p className="lp-mini-sum" data-testid="iorder-dates">{T.forDates[L]}: <b>{owners.map(dateOf).join(", ")}</b></p>}
        {!payable && <p className="lp-form-err lp-on" data-testid="iorder-region">{D.pay.regionUnavailable[L]}</p>}
        {error && <p className="lp-form-err lp-on" role="alert" data-testid="iorder-error">{error}</p>}
        <button className="lp-btn lp-gold" type="submit" disabled={busy || !readings.length || !payable} data-testid="iorder-submit">
          {busy ? T.sending[L] : T.payFor[L](total)}
        </button>
        <p className="lp-fine"><RichText text={TL.payFine[L](latest)} /></p>
      </div>
    </form>
  );
}
