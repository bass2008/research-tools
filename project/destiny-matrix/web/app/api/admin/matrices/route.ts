import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const id = Number(body.user_id);
  if (!Number.isInteger(id) || id <= 0) return jsonError((L) => forLocale(L).t("Неверный пользователь"), await requestLocale(req), 400);
  const birth = String(body.birth ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return jsonError((L) => forLocale(L).t("Нужна дата рождения"), await requestLocale(req), 422);
  const sex = body.sex === "m" ? "m" : "f";
  return forward(`/admin/users/${id}/matrices`, { method: "POST", body: { birth, sex }, auth: true, source: req });
}
