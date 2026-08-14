import { forward, json } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return json({ detail: "Матрица не найдена" }, 404);
  return forward(`/matrices/${id}`, { auth: true });
}
