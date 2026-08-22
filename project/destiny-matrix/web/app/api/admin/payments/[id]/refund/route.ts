import { forward, json } from "../../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return json({ detail: "Неверный платёж" }, 400);
  return forward(`/admin/payments/${id}/refund`, { method: "POST", auth: true });
}
