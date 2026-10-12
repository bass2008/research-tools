"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { useHydrated } from "@/lib/hydrated";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useMessage } from "@/lib/i18n/useMessage";
import { forLocale as localizedMatrix, MatrixError, type Matrix, type Sex } from "@/lib/matrix";
import { saveBirth } from "@/lib/storage";
import { browserDay, exampleDay } from "@/lib/today";
import { useBirth } from "@/lib/useBirth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DateFields from "./DateFields";

/**
 * Что происходит после расчёта. Дата в любом случае уже в браузере, различается только то,
 * где человек увидит карту: на этой же странице или сразу после перехода.
 */
export type Finish =
  | { kind: "here" }
  | { kind: "go"; href: string };

export const forLocale = localized((L: Locale) => {
  const { calculate, daysInMonth, toIso } = localizedMatrix(L);
  return { calculate, daysInMonth, toIso };
});

/**
 * Единственная форма ввода даты на сайте. Раньше их было две — на главной и в блоке-приглашении
 * справочника, — и правки доезжали до одной из них.
 *
 * `name` разводит два экземпляра на одной странице: у полей должны быть разные id, иначе
 * `<label for>` указывает на чужое поле.
 */
export default function MatrixForm({ locale: requestedLocale, ...localeProps }: ({
  name?: "calc" | "promo";
  title?: string;
  lead?: string;
  finish?: Finish;
  /** метка для аналитики: откуда считали */
  place?: string;
  onPreview?: (matrix: Matrix | null) => void;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    name = "calc",
    title = D.calc.formTitle[L],
    lead = D.calc.formLead[L],
    finish = { kind: "here" },
    place = "landing",
    onPreview,
  } = localeProps;
  const { calculate, daysInMonth, toIso } = forLocale(L);

  const promo = name === "promo";
  const fieldId = (short: string) => (promo ? `p${short}` : short);
  const testId = (what: string) => (promo ? `promo-${what}` : what);

  const router = useRouter();
  // Дата-пример корпуса, а не часы браузера: страница статическая, и «сегодня» в её HTML не
  // совпадает с датой у посетителя — в Москве после полуночи число расходилось, React считал это
  // расхождением текста и перерисовывал форму.
  const seed = useMemo(exampleDay, []);
  const saved = useBirth();
  const [day, setDay] = useState(seed.day);
  const [month, setMonth] = useState(seed.month);
  const [year, setYear] = useState(seed.year - 30);
  // Верхний год списка: в HTML это год даты-примера, а после гидратации — фактический, иначе
  // с января и до первого релиза года выбрать новый год было бы нечем.
  const [maxYear, setMaxYear] = useState(seed.year);
  const [sex, setSex] = useState<Sex>("f");
  const [error, setError] = useMessage(L);
  // Поля показывают дату, которую человек уже вводил: иначе «Рассчитать» во второй форме
  // страницы перетирало свежий выбор значением по умолчанию.
  useEffect(() => {
    if (!saved) return;
    const [y, m, d] = saved.birth.split("-").map(Number);
    if (!y || !m || !d) return;
    setDay(d);
    setMonth(m);
    setYear(y);
    setSex(saved.sex);
    // пришли по «Рассчитать» с другой страницы: дата уже в браузере, остаётся показать карту
    if (finish.kind === "here" && window.location.hash === "#result") {
      requestAnimationFrame(() => {
        document.getElementById("result")?.scrollIntoView({ block: "start" });
      });
    }
  }, [saved, finish.kind]);

  useEffect(() => setMaxYear(browserDay().year), []);

  useEffect(() => {
    if (!onPreview) return;
    try {
      onPreview(calculate(toIso({ year, month, day }), sex));
    } catch (e) {
      onPreview(null);
      setError((locale) => e instanceof MatrixError ? e.messageFor(locale) : D.calc.genericError[locale]);
    }
  }, [day, month, year, sex, calculate, toIso, onPreview, setError]);

  // До гидратации обработчик не подключён, и нажатие «Рассчитать» не делало ничего: человек на
  // медленном телефоне решал, что сайт сломан. Пока не готовы — говорим это прямо.
  // Поля тоже выключены до гидратации, а не только кнопка: React монтируется с начальным
  // состоянием и стирает выбор, сделанный до этого, — человек считал бы чужую дату.
  const ready = useHydrated();

  const change = (apply: () => void) => {
    setError(null);
    apply();
  };

  const submit = () => {
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      setError((locale) => D.calc.tooManyDays[locale](maxDay));
      return;
    }
    try {
      const birth = toIso({ year, month, day });
      calculate(birth, sex);                       // проверка даты: ошибку показываем здесь же
      setError(null);
      saveBirth({ birth, sex });
      track("calc", { place });
      if (finish.kind === "go") {
        // карту печатает другая страница: она прочитает дату из браузера, хеш просит прокрутку
        router.push(finish.href);
        return;
      }
      requestAnimationFrame(() => {
        document.getElementById("result")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch (e) {
      setError((locale) => e instanceof MatrixError ? e.messageFor(locale) : D.calc.genericError[locale]);
    }
  };

  return (
    <div className="form" id={promo ? undefined : "calc"}>
      <div className="fh2">{title}</div>
      <div className="sub">{lead}</div>
      <DateFields locale={L} id={fieldId} value={{ day, month, year }} maxYear={maxYear} disabled={!ready}
        onChange={(part, value) => change(() => (part === "day" ? setDay : part === "month" ? setMonth : setYear)(value))} />
      <div className="sexrow" role="group" aria-label={D.calc.sex[L]}>
        <button
          type="button"
          data-testid={testId("sex-f")}
          disabled={!ready}
          data-sex="f"
          aria-pressed={sex === "f"}
          className={sex === "f" ? "on" : ""}
          onClick={() => change(() => setSex("f"))}
        >
          {D.calc.female[L]}
        </button>
        <button
          type="button"
          data-testid={testId("sex-m")}
          disabled={!ready}
          data-sex="m"
          aria-pressed={sex === "m"}
          className={sex === "m" ? "on" : ""}
          onClick={() => change(() => setSex("m"))}
        >
          {D.calc.male[L]}
        </button>
      </div>
      {/* Прежняя подпись обещала, что пол задаёт подписи родовых линий: разборы обоих полов
          совпадают дословно, кроме названия карты, — обещание было неправдой. Названия линий
          заданы формулами точек F, G, H, I и одинаковы у всех. */}
      <p className="hint" style={{ textAlign: "left", marginTop: 6 }}>
        {D.calc.sexHint[L]}
      </p>
      <button
        type="button"
        className="btn wide"
        data-testid={promo ? "promo-submit" : "calc-submit"}
        style={{ marginTop: 12 }}
        disabled={!ready}
        onClick={submit}
      >
        {ready ? D.calc.submit[L] : D.calc.submitWaiting[L]}
      </button>
      {/* без скриптов расчёт не запустится никогда: подпись «Секунду, готовим расчёт…»
          обещала бы то, чего не произойдёт */}
      <noscript>
        <div className="err" role="alert" aria-live="assertive">
          {D.calc.noScript[L]}
        </div>
      </noscript>
      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
    </div>
  );
}
