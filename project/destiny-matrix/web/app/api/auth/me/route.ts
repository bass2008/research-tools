import { forward, json } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// A guest is a normal state, not an error: no session or an expired one answers 200 with user null.
export async function GET() {
  const res = await forward("/auth/me", { auth: true });
  return res.status === 401 ? json({ user: null }) : res;
}
