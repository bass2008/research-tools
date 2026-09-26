import { forLocale as emailForLocale, normalizeEmail } from "@/lib/email";
import { requestLocale } from "@/lib/i18n/request";
import { forward, jsonError, readJson } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const L = await requestLocale(req);
  const { emailError } = emailForLocale(L);
  const body = await readJson(req);
  const email = normalizeEmail(String(body.email ?? ""));
  const wrong = emailError(email);
  if (wrong) return jsonError((locale) => emailForLocale(locale).emailError(email)!, L, 422);
  return forward("/auth/reset/request", { method: "POST", body: { email }, source: req });
}
