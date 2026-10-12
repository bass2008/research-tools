"use client";

import DateFields, { type DatePart } from "@/components/matrix/DateFields";
import { D } from "@/lib/i18n";
import type { Lang as Locale } from "@/lib/i18n/lang";
import type { Sex } from "@/lib/matrix";
import type { StoredBirth, StoredPair } from "@/lib/storage";
import { DP } from "@/lib/i18n/dict/pair";
import { browserDay, exampleDay } from "@/lib/today";
import { useEffect, useMemo, useRef, useState } from "react";

export type PickedDate = Record<DatePart, number>;

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: PickedDate) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;

function parse(iso: string | undefined): PickedDate | null {
  const [year, month, day] = (iso ?? "").split("-").map(Number);
  return year && month && day ? { day, month, year } : null;
}

function useSeed() {
  const seed = useMemo(exampleDay, []);
  const [maxYear, setMaxYear] = useState(seed.year);
  useEffect(() => setMaxYear(browserDay().year), []);
  return { start: { day: seed.day, month: seed.month, year: seed.year - 30 }, maxYear };
}

// Поля стартуют с даты, с которой человек пришёл (`initial`), но только пока он их не трогал:
// список сохранённых дат приходит позже, и он не должен перебивать уже введённое.
function usePrefill(ready: boolean, initial: unknown, apply: () => void) {
  const touched = useRef(false);
  const key = JSON.stringify(initial);
  useEffect(() => {
    if (ready && initial && !touched.current) apply();
  }, [ready, key]);
  return () => { touched.current = true; };
}

/** Дата и пол для разбора одной даты — те же поля, что в калькуляторе на главной. */
export function BirthPicker({ locale: L, initial, ready, disabled, onChange }: {
  locale: Locale;
  initial: StoredBirth | null;
  ready: boolean;
  disabled: boolean;
  onChange: (value: { date: PickedDate; sex: Sex }) => void;
}) {
  const { start, maxYear } = useSeed();
  const [date, setDate] = useState<PickedDate>(start);
  const [sex, setSex] = useState<Sex>("f");
  const touch = usePrefill(ready, initial, () => {
    const parsed = parse(initial?.birth);
    if (parsed) setDate(parsed);
    if (initial) setSex(initial.sex);
  });
  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => report.current({ date, sex }), [date, sex]);

  return (
    <div className="paybirth" data-testid="pay-birth">
      <DateFields locale={L} id={(part) => `pay-${part}`} testId={(part) => `pay-${part}`} value={date}
        maxYear={maxYear} disabled={disabled}
        onChange={(part, value) => { touch(); setDate((prev) => ({ ...prev, [part]: value })); }} />
      <div className="sexrow" role="group" aria-label={D.calc.sex[L]}>
        {(["f", "m"] as const).map((value) => (
          <button key={value} type="button" data-testid={`pay-sex-${value}`} disabled={disabled} data-sex={value}
            aria-pressed={sex === value} className={sex === value ? "on" : ""}
            onClick={() => { touch(); setSex(value); }}>
            {value === "f" ? D.calc.female[L] : D.calc.male[L]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Две даты для разбора пары — те же поля, что в калькуляторе совместимости. */
export function PairPicker({ locale: L, initial, ready, disabled, onChange }: {
  locale: Locale;
  initial: StoredPair | null;
  ready: boolean;
  disabled: boolean;
  onChange: (value: { a: PickedDate; b: PickedDate }) => void;
}) {
  const { start, maxYear } = useSeed();
  const [pair, setPair] = useState<{ a: PickedDate; b: PickedDate }>({ a: start, b: { ...start, year: start.year - 2 } });
  const touch = usePrefill(ready, initial, () => {
    const a = parse(initial?.a.birth);
    const b = parse(initial?.b.birth);
    if (a && b) setPair({ a, b });
  });
  const report = useRef(onChange);
  report.current = onChange;
  useEffect(() => report.current(pair), [pair]);

  const partner = (who: "a" | "b", title: string) => (
    <div className="paypartner">
      <p className="paypartner-t">{title}</p>
      <DateFields locale={L} id={(part) => `pay-${who}-${part}`} testId={(part) => `pay-${who}-${part}`}
        value={pair[who]} maxYear={maxYear} disabled={disabled}
        onChange={(part, value) => { touch(); setPair((prev) => ({ ...prev, [who]: { ...prev[who], [part]: value } })); }} />
    </div>
  );
  return (
    <div className="paybirth" data-testid="pay-pair">
      {partner("a", DP.first[L])}
      {partner("b", DP.second[L])}
    </div>
  );
}
