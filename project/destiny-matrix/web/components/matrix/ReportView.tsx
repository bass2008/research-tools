"use client";

import type { SavedMatrix } from "@/app/_lib/access";
import { useSession } from "@/components/account/useSession";
import MatrixResult, { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import ReportSections from "@/components/matrix/ReportSections";
import SaveMatrixButton from "@/components/matrix/SaveMatrixButton";
import Plans from "@/components/pay/Plans";
import { useLead, usePriceKnown } from "@/components/pay/TariffsProvider";
import UnlockCta from "@/components/pay/UnlockCta";
import { useLocale } from "@/components/ui/LocaleProvider";
import LockIcon from "@/components/ui/LockIcon";
import { ALL_FREE } from "@/lib/access";
import { useHydrated } from "@/lib/hydrated";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedPublicSpec, type PositionArticles, type PositionTexts } from "@/lib/publicSpec";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { useBirth } from "@/lib/useBirth";
import { useFullSections } from "@/lib/useFullSections";
import Link from "next/link";
import { useMemo } from "react";

export const forLocale = localized((L: Locale) => {
  const { calculate } = localizedMatrix(L);
  const { priceLabel } = localizedTariffs(L);
  const { birthLabel } = localizedMatrixResult(L);
  const { buildFree } = localizedPublicSpec(L);

  return { calculate, priceLabel, birthLabel, buildFree };
});

/**
 * Разбор по дате из этого браузера: два бесплатных раздела и восемнадцать имён под замком.
 *
 * Платных толкований здесь нет и появиться не может — их печатает сервер на странице /report,
 * когда кука подтверждает тариф. Признак доступа приходит пропсом от серверной страницы, а не
 * из браузера: локальному состоянию открывать разделы нечем.
 */
export default function ReportView({ locale: requestedLocale, ...localeProps }: ({
  granted?: boolean;
  texts?: PositionTexts;
  articles?: PositionArticles;
  saved?: SavedMatrix[];
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    granted = false,
    texts,
    articles,
    saved = [],
  } = localeProps;
  const { calculate, priceLabel, birthLabel, buildFree } = forLocale(L);

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
  }, [birth, L]);
  // на витрине без оплаты сервер досылает толкования всех разделов по слагу карты
  const full = useFullSections(matrix);

  if (!hydrated) {
    return <p className="skeleton">{D.unlockBox.buildingReport[L]}</p>;
  }

  if (!matrix) {
    return (
      <div className="panel narrow">
        <h1>{D.unlockBox.noDateTitle[L]}</h1>
        {/* Купленный разбор живёт в аккаунте: по ссылке из письма человек приходит без сессии, и
            без этой подсказки экран выглядел так, будто покупки не было. */}
        {/* вошедшему советовать вход бессмысленно: он уже здесь. Ему нужен путь к своим
            датам, а не повтор того, что он сделал */}
        {session.status === "user" ? (
          <p className="dim">
            {D.unlockBox.signedInNoDate[L](session.email ?? "")}{" "}
            <Link href="/account">{D.unlockBox.accountWord[L]}</Link>
            {D.unlockBox.noDateTail[L]}
          </p>
        ) : ALL_FREE ? (
          <p className="dim">
            {D.unlockBox.savedEarlier[L]} <Link href="/login">{D.unlockBox.signIn[L]}</Link>{" "}
            {D.unlockBox.accountHasList[L]}
          </p>
        ) : (
          <p className="dim">
            {D.unlockBox.paidNoSession[L]} <Link href="/login">{D.unlockBox.signIn[L]}</Link>{" "}
            {D.unlockBox.paidNoSessionTail[L]}
          </p>
        )}
        <p className="dim">{D.unlockBox.browserOnly[L]}</p>
        <Link className="btn wide" href="/#calc">
          {D.unlockBox.setDate[L]}
        </Link>
      </div>
    );
  }

  const sections = full ?? buildFree(matrix, texts, articles);
  const locked = sections.filter((s) => !s.positions.length);
  const currentSaved = saved.find((row) => row.birth === matrix.birth && row.sex === matrix.sex);

  return (
    <>
      <p className="crumbs">
        <Link href="/">{D.nav.home[L]}</Link> <span>/</span> <span>{D.nav.myReading[L]}</span>
      </p>
      <h1>{D.unlockBox.readingTitle[L]}</h1>
      <p className="dim">
        {birthLabel(matrix.birth)} ·{" "}
        {matrix.sex === "f" ? D.calc.femaleChartLabel[L] : D.calc.maleChartLabel[L]} ·{" "}
        {D.unlockBox.sectionsOpen[L](sections.filter((s) => s.positions.length).length)}
      </p>

      <div className="section-gap">
        <MatrixResult locale={L} m={matrix} />
      </div>

      <ReportSections locale={L} sections={sections} />

      {ALL_FREE ? (
        <div className="allbox">
          <h3>{D.unlockBox.openTitleFree[L]}</h3>
          <p>{D.unlockBox.reportOpenFree[L]}</p>
          <SaveMatrixButton locale={L}
            birth={matrix.birth}
            sex={matrix.sex}
            label={D.unlockBox.saveDate[L]}
          />
        </div>
      ) : granted ? (
        <div className="allbox">
          <h3>{D.unlockBox.grantedTitle[L]}</h3>
          <p>{D.unlockBox.grantedText[L](locked.length)}</p>
          <SaveMatrixButton locale={L}
            birth={matrix.birth}
            sex={matrix.sex}
            label={D.unlockBox.saveAndOpen[L]}
          />
          <p className="small" style={{ marginTop: 10 }}>
            {D.unlockBox.savedEarlier[L]} <Link href="/account">{D.nav.account[L]}</Link>{" "}
            {D.unlockBox.accountHasList[L]}
          </p>
        </div>
      ) : (
        <div className="allbox">
          <h3>{D.unlockBox.lockedLeft[L](locked.length)}</h3>
          <p>
            {D.unlockBox.lockedLead[L]}{" "}
            {priceKnown && lead
              ? D.unlockBox.onePaymentPdf[L](priceLabel(lead))
              : D.unlockBox.priceUnknown[L]}
          </p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                <LockIcon /> {s.title}
              </span>
            ))}
          </div>
          <UnlockCta locale={L} place="report_bottom" testId="unlock-cta" matrixId={currentSaved?.id}>
            {D.nav.buy[L]}
          </UnlockCta>
          {/* вошедшему предлагать вход бессмысленно: он уже здесь, и подпись читалась как
              «мы вас не узнали» */}
          {session.status === "user" ? (
            <p className="small" style={{ marginTop: 10 }}>
              {D.unlockBox.signedInAs[L](session.email ?? "")}
            </p>
          ) : (
            <p className="small" style={{ marginTop: 10 }}>
              {D.unlockBox.alreadyBought[L]} <Link href="/login">{D.unlockBox.signIn[L]}</Link>{" "}
              {D.unlockBox.signInTailAccount[L]}
            </p>
          )}
        </div>
      )}

      {!ALL_FREE && locked.length ? <Plans locale={L} place="report" /> : null}
    </>
  );
}
