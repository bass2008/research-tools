import { upstreamUrl } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

// The task worker (MCP arcana-tasks) reaches the queue through the site; the API checks its token.
async function pass(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.map(encodeURIComponent).join("/");
  const headers: Record<string, string> = { Accept: "application/json", "X-Internal-Token": req.headers.get("x-internal-token") ?? "" };
  const body = req.method === "POST" ? await req.text() : undefined;
  if (body) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${upstreamUrl(`/internal/tasks/${path}`)}${new URL(req.url).search}`,
      { method: req.method, headers, body, cache: "no-store" });
    return new Response(await res.text(), { status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "API недоступен" }, { status: 502 });
  }
}

export const GET = pass;
export const POST = pass;
