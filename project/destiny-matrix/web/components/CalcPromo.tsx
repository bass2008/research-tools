"use client";

import { useHydrated } from "@/lib/hydrated";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics";
import { MatrixError, daysInMonth, toIso, type Sex } from "@/lib/matrix";
import { saveBirth } from "@/lib/storage";

import ArcanumCard from "./ArcanumCard";
import { arcanumTitle } from "@/lib/arcana";

const MONTHS = [
  "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
  "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
];

const MIN_YEAR = 1900;

/**
 * Приглашение рассчитать матрицу на страницах энциклопедии: слева карта аркана, справа те же
 * поля, что на главной. Дата не уходит на сервер и здесь — она кладётся в браузер, а расчёт
 * делает главная: два калькулятора на сайте разошлись бы, а движок должен быть один.
 */
export default function CalcPromo({
  arcanum,
  caption,
  title = "Постройте свою матрицу",
  lead = "Расчёт бесплатный, без регистрации. Карта строится сразу.",
  place = "encyclopedia",
}: {
  arcanum?: number;
  caption?: string;
  title?: string;
  lead?: string;
  place?: string;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [day, setDay] = useState(now.getDate());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear() - 30);
  const [sex, setSex] = useState<Sex>("f");
  const [error, setError] = useState<string | null>(null);

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= MIN_YEAR; y--) years.push(y);

  // Поля тоже выключены до гидратации, а не только кнопка: React монтируется с начальным
  // состоянием и стирает выбор, сделанный до этого, — человек считал бы чужую дату.
  const ready = useHydrated();

  const submit = () => {
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      setError(`В этом месяце ${maxDay} дней — выберите другое число.`);
      return;
    }
    try {
      const birth = toIso({ year, month, day });
      saveBirth({ birth, sex });
      track("calc", { place });
      // главная сама прочитает дату из браузера и построит карту; хеш просит её прокрутиться
      router.push("/#result");
    } catch (e) {
      setError(e instanceof MatrixError ? e.message : "Не получилось рассчитать — проверьте дату.");
    }
  };

  return (
    <div className="promo" data-testid="calc-promo">
      {arcanum ? (
        <figure className="promocard">
          <ArcanumCard n={arcanum} size="big" decorative />
          <figcaption>
            {caption ?? `${arcanum}. ${arcanumTitle(arcanum)}`}
          </figcaption>
        </figure>
      ) : null}

      <div className="form">
        <h2>{title}</h2>
        <p className="sub">{lead}</p>
        <div className="fields">
          <div>
            <label htmlFor="pd">Число</label>
            <select id="pd" disabled={!ready} value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pm">Месяц</label>
            <select id="pm" disabled={!ready} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="py">Год</label>
            <select id="py" disabled={!ready} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="sexrow">
          <button
            type="button"
            data-testid="promo-sex-f"
            disabled={!ready}
            className={sex === "f" ? "on" : ""}
            onClick={() => setSex("f")}
          >
            Женский
          </button>
          <button
            type="button"
            data-testid="promo-sex-m"
            disabled={!ready}
            className={sex === "m" ? "on" : ""}
            onClick={() => setSex("m")}
          >
            Мужской
          </button>
        </div>
        <button
          type="button"
          className="btn wide"
          data-testid="promo-submit"
          style={{ marginTop: 12 }}
          disabled={!ready}
          onClick={submit}
        >
          {ready ? "Рассчитать матрицу" : "Секунду, готовим расчёт…"}
        </button>
        {error ? <div className="err">{error}</div> : null}
        <div className="hint">Дата не покидает браузер — считаем на месте</div>
      </div>
    </div>
  );
}
