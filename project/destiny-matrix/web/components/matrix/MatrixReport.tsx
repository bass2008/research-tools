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
import { priceLabel } from "@/lib/tariffs";
import { exampleDay } from "@/lib/today";
import { useBirth } from "@/lib/useBirth";

import LockIcon from "@/components/ui/LockIcon";
import MatrixResult from "@/components/matrix/MatrixResult";
import Plans from "@/components/pay/Plans";
import ReportSections from "@/components/matrix/ReportSections";
import SaveMatrixButton from "@/components/matrix/SaveMatrixButton";
import { useLead, usePriceKnown } from "@/components/pay/TariffsProvider";
import UnlockCta from "@/components/pay/UnlockCta";
import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import { buildFree, type PositionArticles, type PositionTexts } from "@/lib/publicSpec";
import { useFullSections } from "@/lib/useFullSections";
import { useSession } from "@/components/account/useSession";
import { useOwnDates } from "@/components/matrix/CalculationProvider";

export default function MatrixReport(
  { texts, articles }: { texts?: PositionTexts; articles?: PositionArticles },
) {
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
  // Пример считается от даты публикации корпуса: с часов браузера в статическом HTML стояла одна
  // дата, а в браузере другая, и карта-пример пересчитывалась после гидратации (#418).
  const seed = useMemo(exampleDay, []);
  const matrix = useMemo(() => {
    try {
      if (birth) return calculate(birth.birth, birth.sex);
      return calculate({ year: seed.year - 30, month: seed.month, day: seed.day }, "f");
    } catch {
      return null;
    }
  }, [birth, seed]);
  // на витрине без оплаты сервер досылает толкования всех разделов по слагу карты
  const full = useFullSections(matrix);

  if (!matrix) return <div id="result" />;

  const sections = full ?? buildFree(matrix, texts, articles);
  const locked = sections.filter((s) => !s.positions.length);
  const anyDate = session.status === "user" && session.unlimited;
  // Право ищем по дате, а не по паре «дата + пол». Пол не меняет в карте ни одного числа
  // (`engine/tests/test_method_contract.py`: разборы обоих полов совпадают дословно), а оферта и
  // экран оплаты обещают «все 20 разделов по одной дате рождения». Пока сравнивался и пол,
  // переключатель после покупки возвращал оплаченную дату под 18 замков.
  const thisDate = ownDates.find(
    (row) => row.birth === matrix.birth && row.access !== "locked",
  );
  const thisDateSaved = ownDates.find(
    (row) => row.birth === matrix.birth && row.sex === matrix.sex,
  ) ?? ownDates.find((row) => row.birth === matrix.birth);
  const thisDatePaid = Boolean(thisDate);

  return (
    <div id="result">
      <section className="wrap section-gap" style={{ padding: 0 }}>
        <MatrixResult m={matrix} example={example} />
        <ReportSections sections={sections} place="landing" />

        {ALL_FREE ? (
          <div className="allbox">
            <h3>{example ? D.unlockBox.exampleTitleFree[L] : D.unlockBox.openTitleFree[L]}</h3>
            <p>
              {example ? D.unlockBox.exampleLeadFree[L] : D.unlockBox.openLeadFree[L]}
              {D.unlockBox.saveForPdf[L]}
            </p>
            {example ? null : (
              <SaveMatrixButton
                birth={matrix.birth}
                sex={matrix.sex}
                label={D.unlockBox.saveDate[L]}
              />
            )}
          </div>
        ) : (
        <div className="allbox" id={thisDatePaid || anyDate ? "plans" : undefined}>
          <h3>{example ? D.unlockBox.exampleTitle[L] : D.unlockBox.openTitle[L]}</h3>
          <p>
            {example ? D.unlockBox.exampleLead[L] : D.unlockBox.openLead[L]}
            {D.unlockBox.contents[L]}{" "}
            {thisDatePaid || anyDate
              ? null
              : priceKnown && lead
                ? D.unlockBox.onePayment[L](priceLabel(lead))
                : D.unlockBox.priceUnknown[L]}
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
              <p className="small">{D.unlockBox.alreadyPaid[L]}</p>
              <Link className="btn wide" href={`/report?m=${thisDate!.id}`}>
                {D.unlockBox.openTitle[L]}
              </Link>
            </>
          ) : anyDate ? (
            <>
              <p className="small">{D.unlockBox.unlimitedPlan[L]}</p>
              <SaveMatrixButton
                birth={matrix.birth}
                sex={matrix.sex}
                label={D.unlockBox.saveAndOpen[L]}
              />
            </>
          ) : (
            <>
              <UnlockCta
                place="allbox"
                testId="unlock-cta"
                matrixId={thisDateSaved?.access === "locked" ? thisDateSaved.id : undefined}
              >
                {D.nav.buy[L]}
              </UnlockCta>
              {session.status === "guest" ? (
                <p className="small" style={{ marginTop: 10 }}>
                  {D.unlockBox.alreadyBought[L]}{" "}
                  <Link href="/login">{D.unlockBox.signIn[L]}</Link> {D.unlockBox.signInTail[L]}
                </p>
              ) : null}
            </>
          )}
        </div>

        )}

        {/* тарифы не показываем тому, у кого эта дата уже открыта: на /report блок тоже
            скрыт при полном доступе, а здесь предлагал купить купленное */}
        {ALL_FREE || thisDatePaid || anyDate ? null : <Plans place="landing" />}
      </section>
    </div>
  );
}
