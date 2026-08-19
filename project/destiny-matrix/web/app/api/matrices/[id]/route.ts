import { forward, json, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return json({ detail: "Матрица не найдена" }, 404);
  return forward(`/matrices/${id}`, { auth: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return json({ detail: "Матрица не найдена" }, 404);
  const body = await readJson(req);
  const title = body.title === undefined || body.title === null ? null : String(body.title).slice(0, 200);
  return forward(`/matrices/${id}`, { method: "PATCH", auth: true, body: { title } });
}
