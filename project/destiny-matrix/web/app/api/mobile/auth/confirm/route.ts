import { forward, json, readJson } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ detail: "JSON required" }, 415);
  const body = await readJson(req);
  const path = body.kind === "verify_email" ? "/auth/email/verification/confirm" : body.kind === "change_email" ? "/auth/email/change/confirm" : null;
  if (!path || typeof body.token !== "string" || body.token.length < 20) return json({ detail: "Invalid confirmation link" }, 400);
  // The single-use operation token is the sole credential; never inherit a browser cookie.
  return forward(path, { source: req, method: "POST", body: { token: body.token } });
}
