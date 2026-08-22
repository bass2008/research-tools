import { upstreamUrl } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

// Провайдер ждёт ровно «OK» с кодом 200, иначе повторяет уведомление сутками.
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!/^[a-z][a-z0-9_-]{0,15}$/.test(provider)) return new Response("FAIL", { status: 400 });
  const raw = await req.text();
  try {
    const res = await fetch(upstreamUrl(`/payments/notify/${provider}`), {
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
