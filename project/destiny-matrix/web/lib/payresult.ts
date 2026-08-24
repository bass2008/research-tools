/** Экран возврата из формы оплаты. */

export type PayStage = "checking" | "paid" | "pending" | "failed" | "error";

/**
 * Заголовок вкладки. Раньше он был статическим — «Оплата прошла», — и обещал исход ещё до ответа
 * банка: на экране шла проверка, а вкладка уже поздравляла с покупкой. При отказе по карте она
 * говорила то же самое.
 */
export function resultTitle(stage: PayStage): string {
  switch (stage) {
    case "paid":
      return "Оплата прошла";
    case "failed":
      return "Платёж не прошёл";
    case "pending":
      return "Платёж ещё в обработке";
    case "error":
      return "Не удалось проверить платёж";
    default:
      return "Проверяем платёж";
  }
}
