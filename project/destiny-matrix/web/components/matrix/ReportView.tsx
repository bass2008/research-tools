"use client";

import Link from "next/link";
import { useMemo } from "react";

import { calculate } from "@/lib/matrix";
import { useHydrated } from "@/lib/hydrated";
import { useBirth } from "@/lib/useBirth";
import { money } from "@/lib/tariffs";
import { counted, plural } from "@/lib/plural";

import LockIcon from "@/components/ui/LockIcon";
import MatrixResult, { birthLabel } from "@/components/matrix/MatrixResult";
import Plans from "@/components/pay/Plans";
import ReportSections from "@/components/matrix/ReportSections";
import SaveMatrixButton from "@/components/matrix/SaveMatrixButton";
import { useLead, usePriceKnown } from "@/components/pay/TariffsProvider";
import { useSession } from "@/components/account/useSession";
import UnlockCta from "@/components/pay/UnlockCta";
import { buildFree, type PositionTexts } from "@/lib/publicSpec";
import type { SavedMatrix } from "@/app/_lib/access";

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
  saved = [],
}: {
  granted?: boolean;
  texts?: PositionTexts;
  saved?: SavedMatrix[];
}) {
  const lead = useLead();
  const priceKnown = usePriceKnown();
  const session = useSession();
  const birth = useBirth();
  const hydrated = useHydrated();

  // дата приходит хуком: он же перечитывает её при возврате во вкладку
  const matrix = useMemo(() => {
    if (!birth) return null;
    try {
      return calculate(birth.birth, birth.sex);
    } catch {
      return null;
    }
  }, [birth]);

  if (!hydrated) {
    return <p className="skeleton">Собираем отчёт…</p>;
  }

  if (!matrix) {
    return (
      <div className="panel narrow">
        <h1>Дата не выбрана</h1>
        {/* Купленный разбор живёт в аккаунте: по ссылке из письма человек приходит без сессии, и
            без этой подсказки экран выглядел так, будто покупки не было. */}
        {/* вошедшему советовать вход бессмысленно: он уже здесь. Ему нужен путь к своим
            датам, а не повтор того, что он сделал */}
        {session.status === "user" ? (
          <p className="dim">
            Вы вошли как {session.email}. Сохранённые даты открываются из{" "}
            <Link href="/account">кабинета</Link>, а новую можно посчитать здесь.
          </p>
        ) : (
          <p className="dim">
            Если разбор оплачен, <Link href="/login">войдите</Link> — он привязан к аккаунту, а не к
            браузеру.
          </p>
        )}
        <p className="dim">
          Отчёт строится в браузере по вашей дате рождения — на сервер она не уходит, поэтому и здесь
          её нет, пока вы не укажете дату. По той же причине расчёт не переносится в новую вкладку:
          он остаётся в той, где вы его сделали.
        </p>
        <Link className="btn wide" href="/#calc">
          Указать дату рождения
        </Link>
      </div>
    );
  }

  const sections = buildFree(matrix, texts);
  const locked = sections.filter((s) => !s.positions.length);
  const currentSaved = saved.find((row) => row.birth === matrix.birth && row.sex === matrix.sex);

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
            Полный разбор открывает деньги, отношения, родовые задачи, программы и разбор по десятилетиям до 80
            лет.{" "}
            {priceKnown && lead
              ? `${money(lead.price)} ₽ — один платёж, без подписки: разбор открыт в аккаунте и скачивается в PDF.`
              : "Цена уточняется."}
          </p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                  <LockIcon /> {s.title}
                </span>
            ))}
          </div>
          <UnlockCta place="report_bottom" testId="unlock-cta" matrixId={currentSaved?.id}>
            Купить
          </UnlockCta>
          {/* вошедшему предлагать вход бессмысленно: он уже здесь, и подпись читалась как
              «мы вас не узнали» */}
          {session.status === "user" ? (
            <p className="small" style={{ marginTop: 10 }}>
              Вы вошли как {session.email}: покупка откроет разделы в этом аккаунте.
            </p>
          ) : (
            <p className="small" style={{ marginTop: 10 }}>
              Уже оплачивали? <Link href="/login">Войдите</Link> — доступ привязан к аккаунту, а не к
              браузеру.
            </p>
          )}
        </div>
      )}

      {locked.length ? <Plans place="report" /> : null}
    </>
  );
}
