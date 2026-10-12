import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const id = Number(body.user_id);
  if (!Number.isInteger(id) || id <= 0) return jsonError((L) => forLocale(L).t("Неверный пользователь"), await requestLocale(req), 400);
  return forward(`/admin/users/${id}/subscription`, { method: "POST", auth: true, source: req });
}
