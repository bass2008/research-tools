import { sameOrigin } from "@/app/api/_lib/sameOrigin";
import { forward } from "@/app/api/_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  return forward(`/individual-examples/${encodeURIComponent(slug)}/pdf`, { source: req, method: "POST", body: {} });
}
