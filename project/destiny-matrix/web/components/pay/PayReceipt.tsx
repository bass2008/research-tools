import Link from "next/link";

import { D, L } from "@/lib/i18n";

import type { Stage } from "@/lib/payStage";

import { birthLabel } from "@/components/matrix/MatrixResult";
import { sexLabel } from "@/lib/matrix";

/** Чек: что оплачено, куда идти и почему доступ живёт в аккаунте, а не в браузере. */
export default function PayReceipt({
  stage,
  tariffName,
  test,
  signedInto,
}: {
  stage: Extract<Stage, { kind: "paid" }>;
  tariffName: string;
  /** деньги ненастоящие: предупреждение показываем только тогда */
  test: boolean;
  /** аккаунт на эту почту уже существовал — мы вошли в него, а не создали новый */
  signedInto: string | null;
  /** почта не ушла на сервер и лежит в браузере */
}) {
  // В чеке пол печатаем всегда: две карты на одну дату могут называться одинаково, а после
  // оплаты человек должен однозначно видеть, какую из них открыл платёж.
  const label = stage.matrix
    ? `${stage.matrix.title ?? birthLabel(stage.matrix.birth)} (${sexLabel(stage.matrix.sex)})`
    : null;

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

      <Link
        className="btn wide"
        href={stage.matrix ? `/report?m=${stage.matrix.id}` : "/report"}
        style={{ marginTop: 14 }}
      >
        {D.payResult.openFull[L]}
      </Link>

      {label ? (
        <p className="small" data-testid="paid-matrix">
          {D.payResult.receiptSavedTail[L](label)}
        </p>
      ) : null}
    </div>
  );
}
