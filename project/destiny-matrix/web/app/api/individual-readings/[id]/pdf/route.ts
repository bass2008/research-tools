import { forward } from "@/app/api/_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forward(`/individual-readings/${encodeURIComponent(id)}/pdf`, { source: req, method: "POST", body: {}, auth: true });
}
