import { upstreamUrl } from "./upstream";

/**
 * Приём уведомления от платёжного провайдера. Банк ждёт ровно «OK» с кодом 200, иначе повторяет
 * уведомление сутками; ответ апстрима наружу не отдаём — провайдеру важен только факт приёма.
 */
export async function acceptNotification(req: Request, path: string): Promise<Response> {
  const raw = await req.text();
  try {
    const res = await fetch(upstreamUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
      cache: "no-store",
    });
    if (!res.ok) return new Response("FAIL", { status: 502 });
  } catch {
    return new Response("FAIL", { status: 502 });
  }
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}
