import Link from "next/link";

import type { Stage } from "@/lib/payStage";

import { birthLabel } from "@/components/matrix/MatrixResult";
import { sexLabel } from "@/lib/matrix";

/** Чек: что оплачено, куда идти и почему доступ живёт в аккаунте, а не в браузере. */
export default function PayReceipt({
  stage,
  tariffName,
  test,
  signedInto,
  leadKept,
}: {
  stage: Extract<Stage, { kind: "paid" }>;
  tariffName: string;
  /** деньги ненастоящие: предупреждение показываем только тогда */
  test: boolean;
  /** аккаунт на эту почту уже существовал — мы вошли в него, а не создали новый */
  signedInto: string | null;
  /** почта не ушла на сервер и лежит в браузере */
  leadKept: boolean;
}) {
  // В чеке пол печатаем всегда: две карты на одну дату могут называться одинаково, а после
  // оплаты человек должен однозначно видеть, какую из них открыл платёж.
  const label = stage.matrix
    ? `${stage.matrix.title ?? birthLabel(stage.matrix.birth)} (${sexLabel(stage.matrix.sex)})`
    : null;

  return (
    <div className="panel paybox">
      <h3>Доступ открыт</h3>
      <div className="cap">
        Платёж {stage.paymentId} · тариф «{tariffName}»
      </div>
      <p className="dim">
        {test ? "Это тестовый приём оплаты: списаний не происходит. " : ""}
        Разделы открыты в аккаунте <b data-testid="account-email">{stage.email}</b>, а не в этом
        браузере, — поэтому доступ работает и с телефона.
      </p>

      <p className="hint">
        Вход с другого устройства — <Link href="/login">на странице входа</Link>: почта{" "}
        {stage.email} и пароль, который вы задали.
      </p>

      {signedInto ? (
        <p className="hint" data-testid="signed-into" style={{ textAlign: "left" }}>
          Аккаунт на {signedInto} уже существовал — мы вошли в него, а не создали новый. Поэтому в
          кабинете есть прежние матрицы и платежи.
        </p>
      ) : null}

      {label ? (
        <p className="hint" style={{ textAlign: "left" }}>
          Этим платежом открыта: <b>{label}</b>.
        </p>
      ) : null}

      <Link
        className="btn wide"
        href={stage.matrix ? `/report?m=${stage.matrix.id}` : "/report"}
        style={{ marginTop: 14 }}
      >
        Открыть полный разбор
      </Link>

      {label ? (
        <p className="small" data-testid="paid-matrix">
          {label} сохранена в кабинете — платные разделы печатает сервер, поэтому разбор
          открывается с любого устройства.
        </p>
      ) : null}

      {leadKept ? (
        <p className="hint" data-testid="lead-status">
          Почту сервер не принял — она сохранена в этом браузере и уйдёт при следующем открытии
          формы.
        </p>
      ) : null}
    </div>
  );
}
