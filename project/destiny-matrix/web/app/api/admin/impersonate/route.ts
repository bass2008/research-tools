import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// Путь статический, идентификатор в теле: динамический сегмент при заданном API_ORIGIN уехал бы
// мимо BFF прямо в api, а тогда токен пришёл бы телом ответа и достался бы JavaScript.
export async function POST(req: Request) {
  const body = await readJson(req);
  const id = Number(body.user_id);
  if (!Number.isInteger(id) || id <= 0) return jsonError((L) => forLocale(L).t("Неверный пользователь"), await requestLocale(req), 400);
  // capture подменяет куку сессии на пользовательскую: админ дальше ходит по сайту как он.
  return forward(`/admin/users/${id}/impersonate`, { method: "POST", auth: true, capture: true,
                                                     source: req });
}
