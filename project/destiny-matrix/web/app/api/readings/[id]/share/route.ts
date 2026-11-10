import { sameOrigin } from "@/app/api/_lib/sameOrigin";
import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, isNativeSessionRequest } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return jsonError(D.bffErrors.matrixNotFound, await requestLocale(req), 404);
  if (!sameOrigin(req) && !await isNativeSessionRequest(req)) return new Response(null, { status: 403 });
  return forward(`/readings/${id}/share`, { source: req, method: "POST", body: {}, auth: true });
}
