"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { calculate, type Matrix } from "@/lib/matrix";
import { loadBirth } from "@/lib/storage";
import { money } from "@/lib/tariffs";
import { counted, plural } from "@/lib/plural";

import LockIcon from "./LockIcon";
import MatrixResult, { birthLabel } from "./MatrixResult";
import Plans from "./Plans";
import ReportSections from "./ReportSections";
import SaveMatrixButton from "./SaveMatrixButton";
import { useLead } from "./TariffsProvider";
import UnlockCta from "./UnlockCta";
import { buildFree, type PositionTexts } from "./publicSpec";

/**
 * Разбор по дате из этого браузера: два бесплатных раздела и восемнадцать имён под замком.
 *
 * Платных толкований здесь нет и появиться не может — их печатает сервер на странице /report,
 * когда кука подтверждает тариф. Признак доступа приходит пропсом от серверной страницы, а не
 * из браузера: локальному состоянию открывать разделы нечем.
 */
export default function ReportView({
  granted = false,
  texts,
}: {
  granted?: boolean;
  texts?: PositionTexts;
}) {
  const lead = useLead();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadBirth();
    if (stored) {
      try {
        setMatrix(calculate(stored.birth, stored.sex));
      } catch {
        setMatrix(null);
      }
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <p className="skeleton">Собираем отчёт…</p>;
  }

  if (!matrix) {
    return (
      <div className="panel narrow">
        <h3>Дата не выбрана</h3>
        <p className="dim">
          Отчёт строится в браузере по вашей дате рождения — на сервер она не уходит, поэтому и здесь
          её нет, пока вы не укажете дату.
        </p>
        <Link className="btn wide" href="/#calc">
          Указать дату рождения
        </Link>
      </div>
    );
  }

  const sections = buildFree(matrix, texts);
  const locked = sections.filter((s) => !s.positions.length);

  return (
    <>
      <p className="crumbs">
        <Link href="/">Главная</Link> <span>/</span> <span>Мой разбор</span>
      </p>
      <h1>Разбор матрицы судьбы</h1>
      <p className="dim">
        {birthLabel(matrix.birth)} · {matrix.sex === "f" ? "женская карта" : "мужская карта"} ·{" "}
        {counted(sections.filter((s) => s.positions.length).length, "раздел", "раздела", "разделов")}{" "}
        открыто
      </p>

      <div className="section-gap">
        <MatrixResult m={matrix} />
      </div>

      <ReportSections sections={sections} />

      {granted ? (
        <div className="allbox">
          <h3>Полный разбор по этой дате собирает сервер</h3>
          <p>
            Тариф оплачен, но толкования платных разделов в браузер не приходят: их печатает сервер по
            сохранённой матрице. Сохраните эту дату в кабинет — и {locked.length} разделов откроются на
            странице разбора.
          </p>
          <SaveMatrixButton
            birth={matrix.birth}
            sex={matrix.sex}
            label="Сохранить дату и открыть полный разбор"
          />
          <p className="small" style={{ marginTop: 10 }}>
            Уже сохраняли раньше? <Link href="/account">Кабинет</Link> — там список ваших матриц.
          </p>
        </div>
      ) : (
        <div className="allbox">
          <h3>Осталось {locked.length} разделов под замком</h3>
          <p>
            Полный разбор открывает деньги, отношения, родовые задачи, программы и разбор по годам до 80
            лет. {money(lead.price)} ₽ — один платёж, доступ остаётся навсегда.
          </p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                  <LockIcon /> {s.title}
                </span>
            ))}
          </div>
          <UnlockCta place="report_bottom" testId="unlock-cta">
            Купить
          </UnlockCta>
          <p className="small" style={{ marginTop: 10 }}>
            Уже оплачивали? <Link href="/login">Войдите</Link> — доступ привязан к аккаунту, а не к
            браузеру.
          </p>
        </div>
      )}

      {locked.length ? <Plans place="report" /> : null}
    </>
  );
}
