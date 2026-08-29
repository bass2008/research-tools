import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// Отметка присутствия: без сессии и без персональных данных — только анонимные идентификаторы
// браузера и вкладки плюс адрес страницы. User-Agent добавляет браузер, по нему api отличает роботов.
export const POST = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return forward("/pulse", { method: "POST", body, agent: req.headers.get("user-agent") });
};
