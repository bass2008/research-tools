"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/components/account/useSession";
import { BirthPicker, isoOf, type PickedDate } from "@/components/pay/BirthPicker";
import { YearInput, forgetIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import { useMessage } from "@/lib/i18n/useMessage";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { track } from "@/lib/analytics";
import { ApiError, forLocale as localizedApi } from "@/lib/api";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import {
  CHILD_HINT_AGE, CHILD_TAG_MAX_AGE, OWN, ageOn, carryChoices, defaultChoices, defaultYears, problemOf, readingsOf, resolve, slotsOf, type Choices,
} from "@/lib/individualOrder";
import { RELATION_CODES, workdaysFrom, type Cart, type OrderPreset } from "@/lib/individualPricing";
import type { Sex } from "@/lib/matrix";
import type { StoredBirth, StoredPair } from "@/lib/storage";
import type { PaymentProvider } from "@/lib/tariffs";
import { browserDay, moscowDay } from "@/lib/today";
import { pairTrio, personalTrio, yearTrio, type Trio } from "@/lib/arcanaTrio";

const MIN_PASSWORD = 3;

function validDate(d: PickedDate): boolean {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day));
  const now = browserDay();
  return t.getUTCFullYear() === d.year && t.getUTCMonth() === d.month - 1 && t.getUTCDate() === d.day
    && t.getTime() <= Date.UTC(now.year, now.month - 1, now.day);
}

/** Who each reading is for, a question, the account and the payment — everything before paying. */
export default function OrderForm({ cart, baseYear, total, providers, payable, initialBirth, initialPair, preset = {}, childBySwitch = false, question, setQuestion, topics, latest, onDates, onYears, onTrio, summary }: {
  cart: Cart; baseYear: number; total: string; providers: PaymentProvider[]; payable: boolean; initialBirth: StoredBirth | null; initialPair?: StoredPair | null;
  preset?: OrderPreset; childBySwitch?: boolean;
  question: string; setQuestion: (q: string) => void; topics: ReactNode; latest: string;
  onDates: (dates: string[]) => void; onYears: (years: number[]) => void; onTrio?: (trio: Trio | null) => void; summary: string;
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
  const [relations, setRelations] = useState<Record<string, string>>(() => preset.relation
    ? Object.fromEntries(slots.filter((s) => s.kind === "pair").map((s) => [s.roles[0], T.relations[L][RELATION_CODES.indexOf(preset.relation!)]]))
    : {});
  const [childTags, setChildTags] = useState<Record<string, boolean>>(() => ({ p0: Boolean(preset.childFirst) }));
  useEffect(() => { setChildTags((c) => ({ ...c, p0: Boolean(preset.childFirst) })); }, [preset.childFirst]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useMessage(L);
  const [lostPassword, setLostPassword] = useState(false);
  const [done, setDone] = useState<[string, string] | null>(null);
  // A recheck on returning to the tab keeps the known account: the guest fields flashed for its 0.1 s.
  const signedIn = session.status === "user" || (session.status === "loading" && Boolean(session.email));
  const mail = signedIn && session.email ? session.email : email.trim().toLowerCase();

  const picked = useRef(new Set<string>());
  useEffect(() => { setChoices((c) => carryChoices(cart, c, picked.current)); }, [cart]);

  const roles = slots.flatMap((s) => s.roles);
  // the couple calculated last fills the first pair; everyone else starts empty, the first one from the stored date
  const initialOf = (role: string): StoredBirth | null => initialPair && role === "a0" ? { birth: initialPair.a.birth, sex: "f" }
    : initialPair && role === "b0" ? { birth: initialPair.b.birth, sex: "f" } : role === roles[0] && !preset.childFirst ? initialBirth : null;
  const { owners, person } = resolve(slots, choices);
  const fallbackYears = defaultYears(slots, person, baseYear);
  const yearOf = (role: string) => years[role] || fallbackYears[role];
  const readings = readingsOf(slots, person, yearOf, (role) => relations[role] ?? "", (role) => Boolean(childTags[role]));
  const ageOf = (role: string) => {
    if (!people[role] || !validDate(people[role].date)) return null;
    const { year, month, day } = browserDay();
    return ageOn(isoOf(people[role].date), `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };
  const tooOld = (role: string) => Boolean(childTags[role]) && (ageOf(role) ?? 0) > CHILD_TAG_MAX_AGE;
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
  // the order card shows the cards of the couple if there is one, otherwise of the person
  const births = owners.map((o) => people[o] ? isoOf(people[o].date) : "");
  const main = readings.find((r) => r.kind === "pair") ?? readings.find((r) => r.kind === "personal") ?? readings[0];
  const [w0, w1] = main ? main.who.map((i) => births[i]) : [];
  const trio = !main || !w0 ? null : main.kind === "pair" ? (w1 ? pairTrio(w0, w1) : null)
    : main.kind === "year" && main.year ? yearTrio(w0, main.year) : personalTrio(w0);
  const trioKey = trio ? trio.join("-") : "";
  useEffect(() => { onTrio?.(trioKey ? trioKey.split("-").map(Number) as Trio : null); }, [trioKey, onTrio]);

  const choose = (role: string, target: string) => { setError(null); picked.current.add(role); setChoices((c) => ({ ...c, [role]: target })); };
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
  // the buyer decides what the reading is; the age only suggests the tag and limits it to minors
  const childTag = (role: string) => {
    const on = Boolean(childTags[role]);
    const age = ageOf(role);
    const note = on ? (tooOld(role) ? T.errChildAdult[L] : T.childTagNote[L]) : age !== null && age < CHILD_HINT_AGE ? T.childHint[L] : "";
    if (childBySwitch && !note) return null;
    return (
      <div className="lp-fl lp-child">
        {!childBySwitch && <div className="lp-topics">
          <button type="button" className={on ? "lp-on" : undefined} aria-pressed={on} disabled={busy} data-testid={`iorder-child-${role}`}
            onClick={() => { setError(null); setChildTags((c) => ({ ...c, [role]: !on })); }}>{T.childTag[L]}</button>
        </div>}
        {note && <small data-testid={`iorder-child-note-${role}`}>{note}</small>}
      </div>
    );
  };
  // kept mounted while someone else is chosen: switching back must not lose the typed date
  const picker = (role: string) => (
    <div hidden={!owners.includes(role)}>
      <BirthPicker locale={L} idPrefix={`lp-${role}`} initial={initialOf(role)} ready disabled={busy} yearsAgo={childTags[role] ? 8 : undefined}
        onChange={(value) => setPeople((p) => ({ ...p, [role]: value }))} />
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLostPassword(false);
    if (!readings.length) return setError(T.errEmpty);
    if (owners.some((o) => !people[o] || !validDate(people[o].date))) return setError(T.errDate);
    const problem = problemOf(readings);
    if (problem) return setError(problem === "samePerson" ? T.errSamePerson : T.errDuplicate);
    if (slots.some((s) => s.kind === "personal" && tooOld(s.roles[0]))) return setError(T.errChildAdult);
    if (!signedIn && password.length < MIN_PASSWORD) return setError((l) => D.payForm.errors.shortPassword[l](MIN_PASSWORD));
    if (!agreed) return setError(D.payForm.errors.consent);
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
      const today = moscowDay();
      setDone([workdaysFrom(today, 1), workdaysFrom(today, 3)]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(D.payForm.errors.wrongPassword);
        setLostPassword(true);
      }
      else if (err instanceof ApiError) setError((l) => err.messageFor(l).replace(/[.!…]?$/, ".") + (err.status ? D.payForm.errors.notCharged[l] : ""));
      else setError(D.payForm.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="lp-form lp-ff lp-done" data-testid="iorder-done">
        <h3>{T.doneTitle[L]}</h3>
        <p>{T.doneText[L](dateLabel(done[0], L), dateLabel(done[1], L))}</p>
        <Link className="lp-btn lp-gold" href="/account?filter=individual">{T.toGolden[L]}</Link>
      </div>
    );
  }

  return (
    <form className="lp-form lp-ff" onSubmit={submit} noValidate data-testid="iorder">
      {slots.map((s) => (
        <fieldset className="lp-person" key={s.roles[0]} data-testid={`iorder-${s.roles[0]}`}>
          <legend>{s.kind === "personal" && childTags[s.roles[0]] ? T.childTag[L] : T.slotTitle[L][s.kind]}{cart[s.kind] > 1 ? ` ${s.n + 1}` : ""}</legend>
          {s.kind === "pair" ? s.roles.map((role, i) => {
            const side = i ? T.secondPerson[L] : T.firstPerson[L];
            return <div className="lp-side" key={role}><span className="lp-lbl2">{side}</span>{who(role, side)}{picker(role)}</div>;
          }) : <>{s.kind === "year" && who(s.roles[0])}{picker(s.roles[0])}{s.kind === "personal" && childTag(s.roles[0])}</>}
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
        <input type="checkbox" checked={agreed} onChange={(e) => { setError(null); setAgreed(e.target.checked); }} data-testid="iorder-consent" />
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
        {error && <p className="lp-form-err lp-on" role="alert" data-testid="iorder-error">{error}
          {lostPassword && <> <Link href="/forgot" target="_blank" rel="noopener" data-testid="iorder-forgot">{D.payForm.restorePassword[L]}</Link></>}</p>}
        <button className="lp-btn lp-gold" type="submit" disabled={busy || !readings.length || !payable} data-testid="iorder-submit">
          {busy ? T.sending[L] : T.payFor[L](total)}
        </button>
        <p className="lp-fine"><RichText text={TL.payFine[L](latest)} /></p>
      </div>
    </form>
  );
}
