"use client";

import { navigationHref } from "@/lib/publicRouting";
import { useSite } from "@/components/ui/LocaleProvider";

import type { SavedMatrix } from "@/app/_lib/access";
import { useSession } from "@/components/account/useSession";
import { useOfferMode } from "@/components/pay/useOfferMode";
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
import { useLockedPreview, withPreview } from "@/lib/useLockedPreview";
import Link from "@/components/ui/LocalizedLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

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
  // на витрине без оплаты и подписчику сервер досылает толкования всех разделов по слагу карты
  const mode = useOfferMode();
  const open = mode !== "sell";
  const full = useFullSections(matrix, open);
  const preview = useLockedPreview(matrix, !open);
  const router = useRouter();
  const navigationSite = useSite();
  const navigationLocale = useLocale();
  // Даты нет — разбирать нечего: человек попадает на главную, к расчёту, а не на экран-объяснение.
  useEffect(() => {
    if (hydrated && !matrix) router.replace(navigationHref("/", navigationSite, navigationLocale));
  }, [hydrated, matrix, router]);

  if (!hydrated || !matrix) {
    return <p className="skeleton">{D.unlockBox.buildingReport[L]}</p>;
  }

  const sections = full ?? withPreview(buildFree(matrix, texts, articles), preview);
  const locked = sections.filter((s) => s.locked);
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
        {D.unlockBox.sectionsOpen[L](sections.filter((s) => !s.locked).length)}
      </p>

      <div className="section-gap">
        <MatrixResult locale={L} m={matrix} chakraUnlocked={open}
          chakraReading={full?.find((s) => s.key === "chakras")?.longform} matrixId={currentSaved?.id} />
      </div>

      <ReportSections locale={L} sections={sections} />

      {open ? (
        <div className="allbox">
          <h3>{D.unlockBox.openTitleFree[L]}</h3>
          <p>{mode === "free" ? D.unlockBox.reportOpenFree[L] : D.unlockBox.reportOpenSubscribed[L]}</p>
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
          <UnlockCta locale={L} place="report_bottom" testId="unlock-cta" matrixId={currentSaved?.id} unavailable={null}>
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

      {!open && locked.length ? <Plans locale={L} place="report" /> : null}
    </>
  );
}
