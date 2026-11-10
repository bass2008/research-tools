import { cookies } from "next/headers";
import { sameOrigin } from "./sameOrigin";
import { forward, json, SESSION_COOKIE } from "./upstream";

type Action = "config" | "challenge" | "login";

/** Web receives an HttpOnly session. Native endpoints never accept browser credentials. */
export async function googleAuth(req: Request, action: Action, native = false) {
  if (native) {
    if (req.headers.has("origin") || req.headers.has("sec-fetch-site") || (await cookies()).get(SESSION_COOKIE))
      return json({ detail: "Native request required" }, 403);
  } else if (action !== "config" && !sameOrigin(req)) {
    return json({ detail: "Forbidden origin" }, 403);
  }
  if (action === "config") return forward("/auth/google/config", { source: req });
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? ""))
    return json({ detail: "JSON required" }, 415);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object required");
    body = parsed as Record<string, unknown>;
  } catch { return json({ detail: "Invalid JSON" }, 400); }
  if (action === "challenge") return forward("/auth/google/challenge", { source: req, method: "POST", body: {} });
  const { credential, challenge, current_password } = body;
  if (typeof credential !== "string" || !credential.trim() || credential.length > 16_384
    || typeof challenge !== "string" || !challenge.trim() || challenge.length > 2048
    || (current_password !== undefined && (typeof current_password !== "string" || current_password.length > 200)))
    return json({ detail: "Invalid Google sign-in request" }, 422);
  return forward("/auth/google", { source: req, method: "POST", capture: !native,
    body: { credential, challenge, ...(current_password === undefined ? {} : { current_password }) } });
}
