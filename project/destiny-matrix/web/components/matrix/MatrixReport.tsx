"use client";

/**
 * Бесплатный разбор под первым экраном: карта, два открытых раздела и восемнадцать имён под
 * замком.
 *
 * Отдельным компонентом, а не частью формы: раньше форма сама печатала отчёт и, поставленная
 * в справочник как приглашение к расчёту, тащила туда весь разбор — страница выглядела так,
 * будто предыдущая осталась на месте. Теперь отчёт стоит там, где его поставили, а форма
 * только собирает дату.
 */
import Link from "next/link";
import { useMemo } from "react";

import { calculate } from "@/lib/matrix";
import { money } from "@/lib/tariffs";
import { useBirth } from "@/lib/useBirth";

import LockIcon from "@/components/ui/LockIcon";
import MatrixResult from "@/components/matrix/MatrixResult";
import Plans from "@/components/pay/Plans";
import ReportSections from "@/components/matrix/ReportSections";
import SaveMatrixButton from "@/components/matrix/SaveMatrixButton";
import { useLead, usePriceKnown } from "@/components/pay/TariffsProvider";
import UnlockCta from "@/components/pay/UnlockCta";
import { buildFree, type PositionTexts } from "@/lib/publicSpec";
import { useSession } from "@/components/account/useSession";
import { useOwnDates } from "@/components/matrix/CalculationProvider";

export default function MatrixReport({ texts }: { texts?: PositionTexts }) {
  const lead = useLead();
  // цену из кода не печатаем: она видна ровно тогда, когда API недоступен и купить нельзя
  const priceKnown = usePriceKnown();
  const session = useSession();
  const birth = useBirth();
  // «уже оплачено» — про конкретную дату, а не про факт покупки: у человека может быть
  // куплена другая, и обещание на неоплаченной читалось как ошибка
  const ownDates = useOwnDates();

  // Карта-пример до первого расчёта: без пометки человек принимал её за свою и уходил
  // покупать разбор по дате, которую не вводил.
  const example = birth === null;
  const now = useMemo(() => new Date(), []);
  const matrix = useMemo(() => {
    try {
      if (birth) return calculate(birth.birth, birth.sex);
      return calculate({ year: now.getFullYear() - 30, month: now.getMonth() + 1, day: now.getDate() }, "f");
    } catch {
      return null;
    }
  }, [birth, now]);

  if (!matrix) return <div id="result" />;

  const sections = buildFree(matrix, texts);
  const locked = sections.filter((s) => !s.positions.length);
  const anyDate = session.status === "user" && session.unlimited;
  const thisDate = ownDates.find(
    (row) => row.birth === matrix.birth && row.sex === matrix.sex && row.access !== "locked",
  );
  const thisDateSaved = ownDates.find(
    (row) => row.birth === matrix.birth && row.sex === matrix.sex,
  );
  const thisDatePaid = Boolean(thisDate);

  return (
    <div id="result">
      <section className="wrap section-gap" style={{ padding: 0 }}>
        <MatrixResult m={matrix} example={example} />
        <ReportSections sections={sections} place="landing" />

        <div className="allbox" id={thisDatePaid || anyDate ? "plans" : undefined}>
          <h3>{example ? "Что покажет полный разбор" : "Открыть полный разбор"}</h3>
          <p>
            {example
              ? "Это карта-пример. Выберите свою дату выше — и те же 20 разделов пересчитаются по ней: "
              : "Все 20 разделов по вашей дате: "}
            деньги, отношения, род до седьмого колена, толкование карты энергий и разбор по
            десятилетиям до 80 лет.{" "}
            {thisDatePaid || anyDate
              ? null
              : priceKnown
                ? `${money(lead.price)} ₽ — один платёж, без подписки.`
                : "Цена уточняется."}
          </p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                <LockIcon /> {s.title}
              </span>
            ))}
          </div>

          {thisDatePaid && !anyDate ? (
            <>
              <p className="small">
                Разбор уже оплачен. Толкования печатает сервер, поэтому дата открывается на
                отдельной странице.
              </p>
              <Link className="btn wide" href={`/report?m=${thisDate!.id}`}>
                Открыть полный разбор
              </Link>
            </>
          ) : anyDate ? (
            <>
              <p className="small">
                Ваш тариф открывает любые даты. Толкования печатает сервер, поэтому сохраните эту
                дату в кабинет — разбор откроется на отдельной странице.
              </p>
              <SaveMatrixButton
                birth={matrix.birth}
                sex={matrix.sex}
                label="Сохранить дату и открыть полный разбор"
              />
            </>
          ) : (
            <>
              <UnlockCta
                place="allbox"
                testId="unlock-cta"
                matrixId={thisDateSaved?.access === "locked" ? thisDateSaved.id : undefined}
              >
                Купить
              </UnlockCta>
              {session.status === "guest" ? (
                <p className="small" style={{ marginTop: 10 }}>
                  Уже оплачивали? <Link href="/login">Войдите</Link> — доступ живёт в аккаунте, а не
                  в браузере.
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* тарифы не показываем тому, у кого эта дата уже открыта: на /report блок тоже
            скрыт при полном доступе, а здесь предлагал купить купленное */}
        {thisDatePaid || anyDate ? null : <Plans place="landing" />}
      </section>
    </div>
  );
}
