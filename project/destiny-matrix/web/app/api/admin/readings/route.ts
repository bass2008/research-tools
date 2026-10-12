import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const id = Number(body.user_id);
  if (!Number.isInteger(id) || id <= 0) return jsonError((L) => forLocale(L).t("Неверный пользователь"), await requestLocale(req), 400);
  const product = String(body.product ?? "");
  if (!/^[a-z]{1,32}$/.test(product) || typeof body.inputs !== "object" || body.inputs === null) {
    return jsonError((L) => forLocale(L).t("Нужна дата рождения"), await requestLocale(req), 422);
  }
  return forward(`/admin/users/${id}/readings`, { method: "POST", body: { product, inputs: body.inputs }, auth: true, source: req });
}
