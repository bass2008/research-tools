import { dropSession, json } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// Выход — дело BFF: api токены не отзывает, куку гасит сервер, а не браузер.
export const POST = () => dropSession(json({ ok: true }));
