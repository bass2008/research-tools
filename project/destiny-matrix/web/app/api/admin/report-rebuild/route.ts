import { forward, json } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("job"));
  if (!Number.isInteger(id) || id <= 0) return json({ detail: "Неверная задача печати" }, 400);
  return forward(`/admin/reports/${id}/rebuild`, { method: "POST", auth: true });
}
