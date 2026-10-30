import { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import type { Stage } from "@/lib/payStage";
import { readingHref } from "@/lib/readingLinks";
import Link from "@/components/ui/LocalizedLink";

export const forLocale = localized((L: Locale) => {
  const { birthLabel } = localizedMatrixResult(L);
  const { sexLabel } = localizedMatrix(L);

  return { birthLabel, sexLabel };
});

/** Чек: что оплачено, куда идти и почему доступ живёт в аккаунте, а не в браузере. */
export default function PayReceipt({ locale: requestedLocale, ...localeProps }: ({
  stage: Extract<Stage, { kind: "paid" }>;
  tariffName: string;
  /** деньги ненастоящие: предупреждение показываем только тогда */
  test: boolean;
  /** аккаунт на эту почту уже существовал — мы вошли в него, а не создали новый */
  signedInto: string | null;
  /** почта не ушла на сервер и лежит в браузере */
  subscription?: boolean;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    stage,
    tariffName,
    test,
    signedInto,
    subscription = false,
  } = localeProps;
  const { birthLabel, sexLabel } = forLocale(L);

  // В чеке пол печатаем всегда: две карты на одну дату могут называться одинаково, а после
  // оплаты человек должен однозначно видеть, какую из них открыл платёж.
  const label = !stage.matrix ? null
    : stage.matrix.birth && stage.matrix.sex
      ? `${stage.matrix.title ?? birthLabel(stage.matrix.birth)} (${sexLabel(stage.matrix.sex)})`
      : stage.matrix.title;

  return (
    <div className="panel paybox">
      <h3>{D.payResult.receiptTitle[L]}</h3>
      <div className="cap">
        {D.payResult.receiptLine[L](String(stage.paymentId), tariffName)}
      </div>
      <p className="dim">
        {test ? D.payResult.testNote[L] : ""}
        {D.payResult.receiptAccountHead[L]}{" "}
        <b data-testid="account-email">{stage.email}</b>
        {D.payResult.receiptAccountTail[L]}
      </p>

      <p className="hint">
        {D.payResult.receiptSignIn[L]}{" "}
        <Link href="/login">{D.payResult.receiptSignInPage[L]}</Link>
        {D.payResult.receiptCredentials[L](stage.email)}
      </p>

      {signedInto ? (
        <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
          {D.payResult.receiptExisting[L](signedInto)}
        </p>
      ) : null}

      {label ? (
        <p className="hint" style={{ textAlign: "left" }}>
          {D.payResult.receiptOpened[L]} <b>{label}</b>.
        </p>
      ) : null}

      {/* у подписки своего разбора нет: «Открыть полный разбор» вёл на /report, а без посчитанной
          даты оттуда перебрасывает на главную */}
      {subscription && !stage.matrix ? (
        <>
          <Link className="btn wide" href="/#calc" style={{ marginTop: 14 }} data-testid="receipt-calculate">
            {D.payResult.calculate[L]}
          </Link>
          <p className="hint">
            <Link href="/compatibility">{D.payResult.calculatePair[L]}</Link>{" · "}
            <Link href="/account">{D.nav.account[L]}</Link>
          </p>
        </>
      ) : (
        <Link
          className="btn wide"
          href={readingHref(stage.matrix)}
          style={{ marginTop: 14 }}
        >
          {D.payResult.openFull[L]}
        </Link>
      )}

      {label ? (
        <p className="small" data-testid="paid-matrix">
          {D.payResult.receiptSavedTail[L](label)}
        </p>
      ) : null}
    </div>
  );
}
