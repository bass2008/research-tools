import { D } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";

/** Экран возврата из формы оплаты. */

export type PayStage = "checking" | "paid" | "refunded" | "pending" | "failed" | "error";

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {

  /**
   * Заголовок вкладки. Раньше он был статическим — «Оплата прошла», — и обещал исход ещё до ответа
   * банка: на экране шла проверка, а вкладка уже поздравляла с покупкой. При отказе по карте она
   * говорила то же самое.
   */
  function resultTitle(stage: PayStage): string {
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
  return { resultTitle };
});

// Compatibility for callers that explicitly use the deployment default.
export const { resultTitle } = forLocale(defaultLocale);
