import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return jsonError(D.bffErrors.matrixNotFound, await requestLocale(req), 404);
  return forward(`/matrices/${id}`, { source: req, auth: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return jsonError(D.bffErrors.matrixNotFound, await requestLocale(req), 404);
  const body = await readJson(req);
  const title = body.title === undefined || body.title === null ? null : String(body.title).slice(0, 200);
  return forward(`/matrices/${id}`, { source: req, method: "PATCH", auth: true, body: { title } });
}
