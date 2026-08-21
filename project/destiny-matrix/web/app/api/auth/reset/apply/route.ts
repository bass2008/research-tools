import { json, readJson, forward } from "../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await readJson(req);
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (token.length < 20) return json({ detail: "Ссылка недействительна" }, 400);
  if (password.length < 3) return json({ detail: "Пароль — не короче трёх знаков" }, 400);
  // capture: апстрим отдаёт токен, он должен уехать в httpOnly-куку, а не в тело ответа
  return forward("/auth/reset/apply", { method: "POST", body: { token, password }, capture: true });
}
