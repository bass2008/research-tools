/** ClientID остаётся строкой: число Метрики может превышать точность JavaScript. */
export function linkMetrikaClient(counterId: number): () => void {
  let active = true;
  try {
    window.ym?.(counterId, "getClientID", (clientId: unknown) => {
      if (!active || typeof clientId !== "string" || !/^[0-9]{1,64}$/.test(clientId)) return;
      void fetch("/api/auth/metrika-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counter_id: counterId, client_id: clientId }),
      }).catch(() => { /* Аналитика не блокирует работу сайта. Следующая страница повторит отправку. */ });
    });
  } catch {
    // Заблокированный счётчик не мешает входу или покупке.
  }
  return () => { active = false; };
}
