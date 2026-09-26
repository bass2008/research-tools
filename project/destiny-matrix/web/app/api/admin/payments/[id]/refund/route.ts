import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError } from "../../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return jsonError((L) => forLocale(L).t("Неверный платёж"), await requestLocale(req), 400);
  return forward(`/admin/payments/${id}/refund`, { method: "POST", auth: true, source: req });
}
