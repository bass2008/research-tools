import { forLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("job"));
  if (!Number.isInteger(id) || id <= 0) return jsonError((L) => forLocale(L).t("Неверная задача печати"), await requestLocale(req), 400);
  return forward(`/admin/reports/${id}/link`, { auth: true, source: req });
}
