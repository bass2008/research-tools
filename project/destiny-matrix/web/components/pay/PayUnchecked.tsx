"use client";

import Link from "next/link";

/**
 * Платёж по адресу есть, а сервер о нём молчит.
 *
 * Форму здесь показывать нельзя: F5 на чеке при неотвечающем API предлагал оплатить уже
 * оплаченное. Пока исход неизвестен, про деньги ничего не утверждаем.
 */
export default function PayUnchecked({ paymentId }: { paymentId: string | null }) {
  return (
    <div className="panel paybox">
      <h3>Не удалось проверить платёж</h3>
      <p className="dim">
        Сервер не ответил, поэтому мы не знаем, прошёл ли платёж {paymentId}. Обновите страницу
        через минуту — если деньги списались, разбор уже открыт в{" "}
        <Link href="/account">кабинете</Link>.
      </p>
      <button className="btn wide" type="button" onClick={() => window.location.reload()}>
        Проверить ещё раз
      </button>
    </div>
  );
}
