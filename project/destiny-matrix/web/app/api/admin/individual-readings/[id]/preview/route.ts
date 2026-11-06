import { forward } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forward(`/admin/individual-readings/${encodeURIComponent(id)}/preview`, { auth: true, source: req });
}
