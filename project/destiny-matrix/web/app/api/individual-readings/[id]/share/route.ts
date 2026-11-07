import { sameOrigin } from "@/app/api/_lib/sameOrigin";
import { forward } from "@/app/api/_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  return forward(`/individual-readings/${encodeURIComponent(id)}/share`, { source: req, method: "POST", body: {}, auth: true });
}
