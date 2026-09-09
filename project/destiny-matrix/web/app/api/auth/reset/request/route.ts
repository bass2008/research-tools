import { emailError, normalizeEmail } from "@/lib/email";

import { json, readJson, forward } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const email = normalizeEmail(String(body.email ?? ""));
  const wrong = emailError(email);
  if (wrong) return json({ detail: wrong }, 422);
  return forward("/auth/reset/request", { method: "POST", body: { email }, source: req });
}
