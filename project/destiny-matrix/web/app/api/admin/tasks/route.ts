import { forward, readJson } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const page = new URL(req.url).searchParams.get("page") ?? "1";
  return forward(`/admin/tasks?page=${encodeURIComponent(page)}`, { auth: true, source: req });
}

export async function POST(req: Request) {
  return forward("/admin/tasks", { method: "POST", auth: true, source: req, body: await readJson(req) });
}
