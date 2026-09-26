import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { jsonError, readJson, forward } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const L = await requestLocale(req);
  const body = await readJson(req);
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (token.length < 20) return jsonError(D.bffErrors.invalidLink, L, 400);
  if (password.length < 3) return jsonError(D.bffErrors.shortPassword, L, 400);
  // capture: апстрим отдаёт токен, он должен уехать в httpOnly-куку, а не в тело ответа
  return forward("/auth/reset/apply", { source: req, method: "POST", body: { token, password }, capture: true });
}
