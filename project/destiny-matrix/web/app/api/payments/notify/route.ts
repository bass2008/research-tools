import { upstreamUrl } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// Банк ждёт ровно «OK» с кодом 200, иначе повторяет уведомление сутками. Ответ апстрима наружу
// не отдаём: для банка важен только факт приёма.
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const res = await fetch(upstreamUrl("/payments/notify"), {
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
