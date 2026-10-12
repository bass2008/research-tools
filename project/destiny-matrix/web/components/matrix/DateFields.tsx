import { D } from "@/lib/i18n";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { forLocale as localizedMatrix } from "@/lib/matrix";

export type DatePart = "day" | "month" | "year";
export const MIN_YEAR = 1900;

/** Поля «число, месяц, год» — одни на калькулятор, приглашение справочника и форму пары. */
export default function DateFields({ locale: L, id, testId, value, maxYear, disabled, onChange }: {
  locale: Locale;
  id: (part: "d" | "m" | "y") => string;
  testId?: (part: "d" | "m" | "y") => string;
  value: Record<DatePart, number>;
  maxYear: number;
  disabled: boolean;
  onChange: (part: DatePart, value: number) => void;
}) {
  const { MONTHS_ACC } = localizedMatrix(L);
  const years: number[] = [];
  for (let y = maxYear; y >= MIN_YEAR; y--) years.push(y);
  const field = (short: "d" | "m" | "y", part: DatePart, label: string, options: Array<[number, string | number]>) => (
    <div>
      <label htmlFor={id(short)}>{label}</label>
      <select id={id(short)} data-testid={testId?.(short)} disabled={disabled} value={value[part]}
        onChange={(e) => onChange(part, Number(e.target.value))}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  );
  return (
    <div className="fields">
      {field("d", "day", D.calc.day[L], Array.from({ length: 31 }, (_, i) => [i + 1, i + 1]))}
      {field("m", "month", D.calc.month[L], MONTHS_ACC.map((name, i) => [i + 1, name]))}
      {field("y", "year", D.calc.year[L], years.map((y) => [y, y]))}
    </div>
  );
}
