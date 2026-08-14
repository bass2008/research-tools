"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { track } from "@/lib/analytics";
import { MatrixError, calculate, daysInMonth, toIso, type Matrix, type Sex } from "@/lib/matrix";
import { saveBirth, loadBirth } from "@/lib/storage";
import { money } from "@/lib/tariffs";

import LockIcon from "./LockIcon";
import MatrixResult from "./MatrixResult";
import Plans from "./Plans";
import ReportSections from "./ReportSections";
import SaveMatrixButton from "./SaveMatrixButton";
import { useLead } from "./TariffsProvider";
import UnlockCta from "./UnlockCta";
import { buildFree, type PositionTexts } from "./publicSpec";
import { useSession } from "./useSession";

const MONTHS = [
  "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
  "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
];

const MIN_YEAR = 1900;

export default function MatrixForm({ texts }: { texts?: PositionTexts }) {
  const lead = useLead();
  const now = useMemo(() => new Date(), []);
  const [day, setDay] = useState(now.getDate());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear() - 30);
  const [sex, setSex] = useState<Sex>("f");
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useSession();

  // Пример карты появляется сразу, но только после монтирования: на сервере матрицы нет,
  // иначе разъехалась бы гидратация.
  useEffect(() => {
    const stored = loadBirth();
    try {
      if (stored) {
        const [y, m, d] = stored.birth.split("-").map(Number);
        setDay(d);
        setMonth(m);
        setYear(y);
        setSex(stored.sex);
        setMatrix(calculate(stored.birth, stored.sex));
        return;
      }
      setMatrix(calculate({ year: now.getFullYear() - 30, month: now.getMonth() + 1, day: now.getDate() }, "f"));
    } catch {
      setMatrix(null);
    }
  }, [now]);

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= MIN_YEAR; y--) years.push(y);

  const submit = () => {
    const maxDay = daysInMonth(year, month);
    if (day > maxDay) {
      setError(`В этом месяце ${maxDay} дней — выберите другое число.`);
      return;
    }
    try {
      const birth = toIso({ year, month, day });
      const m = calculate(birth, sex);
      setError(null);
      setMatrix(m);
      saveBirth({ birth, sex });
      track("calc", { place: "landing" });
      requestAnimationFrame(() => {
        document.getElementById("result")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    } catch (e) {
      setError(e instanceof MatrixError ? e.message : "Не получилось рассчитать — проверьте дату.");
    }
  };

  // Платные разделы на лендинг не приходят вовсе: их печатает сервер на /report по
  // сохранённой матрице. Здесь всегда два открытых раздела и восемнадцать имён под замком.
  const granted = session.status === "user" && session.paid;
  const sections = matrix ? buildFree(matrix, texts) : [];
  const locked = sections.filter((s) => !s.positions.length);

  return (
    <>
      <div className="form" id="calc">
        <h2>Введите дату рождения</h2>
        <div className="sub">Расчёт бесплатный, без регистрации. Карта строится сразу.</div>
        <div className="fields">
          <div>
            <label htmlFor="d">Число</label>
            <select id="d" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="m">Месяц</label>
            <select id="m" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((nm, i) => (
                <option key={nm} value={i + 1}>
                  {nm}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="y">Год</label>
            <select id="y" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="sexrow">
          <button
            type="button"
            data-testid="sex-f"
            data-sex="f"
            className={sex === "f" ? "on" : ""}
            onClick={() => setSex("f")}
          >
            Женский
          </button>
          <button
            type="button"
            data-testid="sex-m"
            data-sex="m"
            className={sex === "m" ? "on" : ""}
            onClick={() => setSex("m")}
          >
            Мужской
          </button>
        </div>
        <button className="btn wide" data-testid="calc-submit" style={{ marginTop: 12 }} onClick={submit}>
          Рассчитать матрицу
        </button>
        {error ? <div className="err">{error}</div> : null}
        <div className="hint">Дата не покидает браузер — считаем на месте</div>
      </div>

      <div id="result">
        {matrix ? (
          <section className="wrap section-gap" style={{ padding: 0 }}>
            <MatrixResult m={matrix} />
            <ReportSections sections={sections} place="landing" />

            <div className="allbox">
              <h3>Открыть полный разбор</h3>
              <p>
                Все 20 разделов по вашей дате: деньги, отношения, род до седьмого колена, карта энергий
                по чакрам и разбор по годам до 80 лет. Один платёж, без подписки и автосписаний.
              </p>
              <div className="alllist">
                {locked.map((s) => (
                  <span key={s.key}>
                  <LockIcon /> {s.title}
                </span>
                ))}
              </div>
              {granted && matrix ? (
                <>
                  <p className="small">
                    Тариф «{granted}» уже оплачен. Толкования печатает сервер, поэтому сохраните эту дату
                    в кабинет — разбор откроется на отдельной странице.
                  </p>
                  <SaveMatrixButton
                    birth={matrix.birth}
                    sex={matrix.sex}
                    label="Сохранить дату и открыть полный разбор"
                  />
                </>
              ) : (
                <>
                  <UnlockCta place="allbox" testId="unlock-cta">
                    Открыть за {money(lead.price)} ₽
                  </UnlockCta>
                  {session.status === "guest" ? (
                    <p className="small" style={{ marginTop: 10 }}>
                      Уже оплачивали? <Link href="/login">Войдите</Link> — доступ живёт в аккаунте, а не в
                      браузере.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <Plans place="landing" />

            <p className="small section-gap">
              Полный отчёт по этой же дате открывается на отдельной странице:{" "}
              <Link href="/report">{granted ? "все разделы вашего тарифа" : "два раздела бесплатно"}</Link>
              .
            </p>
          </section>
        ) : (
          <p className="skeleton">Выберите дату — карта построится здесь.</p>
        )}
      </div>
    </>
  );
}
