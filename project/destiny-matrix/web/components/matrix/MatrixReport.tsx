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
import { useSession } from "@/components/account/useSession";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { useOwnDates } from "@/components/matrix/CalculationProvider";
import MatrixResult from "@/components/matrix/MatrixResult";
import ReportSections from "@/components/matrix/ReportSections";
import SaveMatrixButton from "@/components/matrix/SaveMatrixButton";
import Plans from "@/components/pay/Plans";
import { useLead, usePriceKnown } from "@/components/pay/TariffsProvider";
import UnlockCta from "@/components/pay/UnlockCta";
import { useLocale } from "@/components/ui/LocaleProvider";
import LockIcon from "@/components/ui/LockIcon";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedPublicSpec, type PositionArticles, type PositionTexts } from "@/lib/publicSpec";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { exampleDay } from "@/lib/today";
import { useBirth } from "@/lib/useBirth";
import { useChakraAccess } from "@/lib/useChakraAccess";
import { useFullSections } from "@/lib/useFullSections";
import { useLockedPreview, withPreview } from "@/lib/useLockedPreview";
import Link from "@/components/ui/LocalizedLink";
import { useMemo } from "react";

export const forLocale = localized((L: Locale) => {
  const { calculate } = localizedMatrix(L);
  const { priceLabel } = localizedTariffs(L);
  const { buildFree } = localizedPublicSpec(L);

  return { calculate, priceLabel, buildFree };
});

export default function MatrixReport({ locale: requestedLocale, ...localeProps }: ({ texts?: PositionTexts; articles?: PositionArticles }) & { locale?: Locale }
) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { texts, articles } = localeProps;
  const { calculate, priceLabel, buildFree } = forLocale(L);

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
  }, [birth, seed, L]);
  // на витрине без оплаты и подписчику сервер досылает толкования всех разделов по слагу карты
  const mode = useOfferMode();
  const open = mode !== "sell";
  const full = useFullSections(matrix, open);
  const preview = useLockedPreview(matrix, !open);
  const access = useChakraAccess(matrix, ownDates, full);

  if (!matrix) return <div id="result" />;

  const sections = full ?? withPreview(buildFree(matrix, texts, articles), preview);
  const locked = sections.filter((s) => s.locked);
  const { anyDate, paid: thisDate, saved: thisDateSaved } = access;
  const thisDatePaid = Boolean(thisDate);

  return (
    <div id="result">
      <section className="wrap section-gap" style={{ padding: 0 }}>
        <MatrixResult locale={L} m={matrix} example={example}
          chakraReading={access.reading}
          chakraReadingStatus={access.readingStatus}
          chakraUnlocked={access.unlocked}
          matrixId={access.matrixId} />
        <ReportSections locale={L} sections={sections} place="landing" />

        {open ? (
          <div className="allbox">
            <h3>{example ? D.unlockBox.exampleTitleFree[L] : D.unlockBox.openTitleFree[L]}</h3>
            <p>
              {example ? D.unlockBox.exampleLeadFree[L] : mode === "free" ? D.unlockBox.openLeadFree[L] : D.unlockBox.openLeadSubscribed[L]}
              {D.unlockBox.saveForPdf[L]}
            </p>
            {example ? null : (
              <SaveMatrixButton locale={L}
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
                <SaveMatrixButton locale={L}
                  birth={matrix.birth}
                  sex={matrix.sex}
                  label={D.unlockBox.saveAndOpen[L]}
                />
              </>
            ) : (
              <>
                <UnlockCta locale={L}
                  place="allbox"
                  testId="unlock-cta"
                  matrixId={thisDateSaved?.access === "locked" ? thisDateSaved.id : undefined}
                  unavailable={null}
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
        {open || thisDatePaid || anyDate ? null : <Plans locale={L} place="landing" />}
      </section>
    </div>
  );
}
