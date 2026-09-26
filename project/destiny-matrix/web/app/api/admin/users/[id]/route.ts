import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return jsonError((L) => forLocale(L).t("Не найдено"), await requestLocale(req), 404);
  return forward(`/admin/users/${id}`, { auth: true, source: req });
}
