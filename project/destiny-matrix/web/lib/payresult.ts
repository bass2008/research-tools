import { D, L } from "./i18n";

/** Экран возврата из формы оплаты. */

export type PayStage = "checking" | "paid" | "refunded" | "pending" | "failed" | "error";

/**
 * Заголовок вкладки. Раньше он был статическим — «Оплата прошла», — и обещал исход ещё до ответа
 * банка: на экране шла проверка, а вкладка уже поздравляла с покупкой. При отказе по карте она
 * говорила то же самое.
 */
export function resultTitle(stage: PayStage): string {
  switch (stage) {
    case "paid":
      return D.payResult.stagePaid[L];
    case "refunded":
      return D.payResult.stageRefunded[L];
    case "failed":
      return D.payResult.stageFailed[L];
    case "pending":
      return D.payResult.stagePending[L];
    case "error":
      return D.payResult.stageUnknown[L];
    default:
      return D.payResult.stageChecking[L];
  }
}
