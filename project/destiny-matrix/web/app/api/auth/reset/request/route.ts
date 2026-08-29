import { json, readJson, forward } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

const EMAIL = /^\S+@\S+\.\S+$/;

export async function POST(req: Request) {
  const body = await readJson(req);
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ detail: "Проверьте адрес почты" }, 400);
  return forward("/auth/reset/request", { method: "POST", body: { email }, source: req });
}
