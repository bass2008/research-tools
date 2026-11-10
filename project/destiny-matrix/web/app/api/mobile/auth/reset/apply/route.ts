import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { jsonError, readJson, forward } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const locale = await requestLocale(req);
  const body = await readJson(req);
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (token.length < 20) return jsonError(D.bffErrors.invalidLink, locale, 400);
  if (password.length < 3) return jsonError(D.bffErrors.shortPassword, locale, 400);
  return forward("/auth/reset/apply", { source: req, method: "POST", body: { token, password } });
}
