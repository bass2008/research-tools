"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics";
import { useHydrated } from "@/lib/hydrated";
import { MatrixError, MONTHS_ACC, calculate, daysInMonth, toIso, type Sex } from "@/lib/matrix";
import { saveBirth } from "@/lib/storage";
import { useBirth } from "@/lib/useBirth";

const MIN_YEAR = 1900;

/**
 * Что происходит после расчёта. Дата в любом случае уже в браузере, различается только то,
 * где человек увидит карту: на этой же странице или сразу после перехода.
 */
export type Finish =
  | { kind: "here" }
  | { kind: "go"; href: string };

/**
 * Единственная форма ввода даты на сайте. Раньше их было две — на главной и в блоке-приглашении
 * справочника, — и правки доезжали до одной из них.
 *
 * `name` разводит два экземпляра на одной странице: у полей должны быть разные id, иначе
 * `<label for>` указывает на чужое поле.
 */
export default function MatrixForm({
  name = "calc",
  title = "Введите дату рождения",
  lead = "Расчёт бесплатный, без регистрации. Карта строится сразу.",
  finish = { kind: "here" },
  place = "landing",
}: {
  name?: "calc" | "promo";
  title?: string;
  lead?: string;
  finish?: Finish;
  /** метка для аналитики: откуда считали */
  place?: string;
}) {
  const promo = name === "promo";
  const fieldId = (short: string) => (promo ? `p${short}` : short);
  const testId = (what: string) => (promo ? `promo-${what}` : what);

  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const saved = useBirth();
  const [day, setDay] = useState(now.getDate());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear() - 30);
  const [sex, setSex] = useState<Sex>("f");
  const [error, setError] = useState<string | null>(null);
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

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= MIN_YEAR; y--) years.push(y);

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
      setError(`В этом месяце ${maxDay} дней — выберите другое число.`);
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
      setError(e instanceof MatrixError ? e.message : "Не получилось рассчитать — проверьте дату.");
    }
  };

  return (
    <div className="form" id={promo ? undefined : "calc"}>
      <div className="fh2">{title}</div>
      <div className="sub">{lead}</div>
      <div className="fields">
        <div>
          <label htmlFor={fieldId("d")}>Число</label>
          <select
            id={fieldId("d")}
            disabled={!ready}
            value={day}
            onChange={(e) => change(() => setDay(Number(e.target.value)))}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={fieldId("m")}>Месяц</label>
          <select
            id={fieldId("m")}
            disabled={!ready}
            value={month}
            onChange={(e) => change(() => setMonth(Number(e.target.value)))}
          >
            {MONTHS_ACC.map((nm, i) => (
              <option key={nm} value={i + 1}>
                {nm}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={fieldId("y")}>Год</label>
          <select
            id={fieldId("y")}
            disabled={!ready}
            value={year}
            onChange={(e) => change(() => setYear(Number(e.target.value)))}
          >
            {years.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sexrow" role="group" aria-label="Пол">
        <button
          type="button"
          data-testid={testId("sex-f")}
          disabled={!ready}
          data-sex="f"
          aria-pressed={sex === "f"}
          className={sex === "f" ? "on" : ""}
          onClick={() => change(() => setSex("f"))}
        >
          Женский
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
          Мужской
        </button>
      </div>
      {/* пол не меняет числа карты — только подписи родовых линий в полном разборе;
          без объяснения поле выглядело обязательным и непонятным */}
      <p className="hint" style={{ textAlign: "left", marginTop: 6 }}>
        Пол задаёт подписи мужской и женской линий рода в полном разборе. На числа карты он не
        влияет.
      </p>
      <button
        type="button"
        className="btn wide"
        data-testid={promo ? "promo-submit" : "calc-submit"}
        style={{ marginTop: 12 }}
        disabled={!ready}
        onClick={submit}
      >
        {ready ? "Рассчитать матрицу" : "Секунду, готовим расчёт…"}
      </button>
      {/* без скриптов расчёт не запустится никогда: подпись «Секунду, готовим расчёт…»
          обещала бы то, чего не произойдёт */}
      <noscript>
        <div className="err" role="alert" aria-live="assertive">
          Расчёт идёт прямо в браузере, поэтому нужен включённый JavaScript: дата рождения
          никуда не отправляется, и считать её на сервере мы не станем.
        </div>
      </noscript>
      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
    </div>
  );
}
