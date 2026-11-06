import { sameOrigin } from "./sameOrigin";
import { forward, json, readJson, dropSession } from "./upstream";

/** Cookie-authenticated account actions accept only same-origin JSON requests. */
export async function accountMutation(req: Request, path: string, auth = true, capture = false) {
  if (!sameOrigin(req)) return json({ detail: "Forbidden origin" }, 403);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return json({ detail: "JSON required" }, 415);
  const response = await forward(path, { source: req, method: "POST", auth, optionalAuth: !auth, capture, body: await readJson(req) });
  if (path === "/auth/email/change/confirm" && response.ok) {
    const body = await response.clone().json();
    if (body.changed) dropSession(response);
  }
  return response;
}
