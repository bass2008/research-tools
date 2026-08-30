import { forward, json } from "../../_lib/upstream";

import { publicSettings } from "@/lib/settings/public";
import { serverSettings } from "@/lib/settings/server";

export const dynamic = "force-dynamic";

/**
 * Общая точка чтения конфигурации для админки. Сначала API подтверждает admin-сессию и только
 * затем BFF добавляет свой startup-снимок: неавторизованный запрос не увидит даже frontend-группу.
 */
export async function GET() {
  const response = await forward("/admin/settings", { auth: true });
  if (!response.ok) return response;

  const backend = await response.json() as { group?: unknown; items?: unknown; warnings?: unknown };
  if (backend.group !== "backend" || !Array.isArray(backend.items)) {
    return json({ detail: "Backend вернул настройки в неожиданном формате." }, 502);
  }

  return json({
    frontend: {
      group: "frontend",
      items: [
        ...publicSettings.snapshot().map((row) => ({ component: "web-public", ...row })),
        ...serverSettings.snapshot().map((row) => ({ component: "web-server", ...row })),
      ],
    },
    backend,
  });
}
