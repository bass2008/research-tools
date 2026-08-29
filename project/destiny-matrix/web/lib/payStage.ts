import type { PaymentResponse } from "./api";

/**
 * Экран оплаты как конечный автомат.
 *
 * Это состояние ЭКРАНА, а не заказа: статус платежа живёт на сервере (`Payment.state()`), и
 * второй такой автомат на клиенте неизбежно разошёлся бы с ним. Сюда статус приходит событием.
 *
 * Переходы собраны в одну чистую функцию намеренно: пока `setStage` вызывался из пяти мест,
 * состояние залипало — «нужен пароль» оставался после смены почты, а чек показывался и после
 * возврата денег. Здесь видно, какое событие какое состояние сбрасывает, и это проверяется
 * без браузера.
 */
export type PaidMatrix = NonNullable<PaymentResponse["matrix"]>;

export type Stage =
  | { kind: "form" }
  /** почта занята, а введённый пароль к ней не подошёл: нужен пароль владельца */
  | { kind: "login-needed"; email: string }
  | { kind: "paid"; paymentId: string; email: string; matrix: PaidMatrix | null }
  /** чек открыт по адресу, но сервер не ответил: платёж мог пройти — форму не показываем */
  | { kind: "unchecked" };

export type PayEvent =
  | { type: "paid"; paymentId: string; email: string; matrix: PaidMatrix | null }
  | { type: "password-needed"; email: string }
  /** человек правит почту: требование пароля от другого аккаунта больше не действует */
  | { type: "email-changed"; email: string }
  | { type: "receipt-missing" }
  | { type: "receipt-unreachable" }
  | { type: "restart" };

export const START: Stage = { kind: "form" };

export function reduce(stage: Stage, event: PayEvent): Stage {
  switch (event.type) {
    case "paid":
      return {
        kind: "paid",
        paymentId: event.paymentId,
        email: event.email,
        matrix: event.matrix,
      };
    case "password-needed":
      return { kind: "login-needed", email: event.email };
    case "email-changed":
      // требование пароля привязано к своей почте: сменили её — требование снято
      return stage.kind === "login-needed" && stage.email !== event.email.trim().toLowerCase()
        ? START
        : stage;
    case "receipt-missing":
      // платёж по адресу не найден или возвращён: чек не показываем
      return stage.kind === "paid" ? stage : START;
    case "receipt-unreachable":
      return stage.kind === "paid" ? stage : { kind: "unchecked" };
    case "restart":
      return START;
  }
}

/** Требуется ли пароль владельца именно для этой почты. */
export function needsOwnerPassword(stage: Stage, email: string): boolean {
  return stage.kind === "login-needed" && stage.email === email.trim().toLowerCase();
}
