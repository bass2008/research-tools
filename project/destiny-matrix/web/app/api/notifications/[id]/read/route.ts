import { accountMutation } from "@/app/api/_lib/accountMutation";
import { json } from "@/app/api/_lib/upstream";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return json({ detail: "Not found" }, 404);
  return accountMutation(req, `/notifications/${id}/read`);
}
