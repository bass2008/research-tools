import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// Анонимные идентификаторы нужны онлайн-счётчику. Если httpOnly-сессия есть, BFF также передаёт её:
// API свяжет пульс с user_id и раз в час обновит последнее появление, но гостю вход не требуется.
export const POST = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return forward("/pulse", {
    method: "POST",
    body,
    agent: req.headers.get("user-agent"),
    optionalAuth: true,
  });
};
