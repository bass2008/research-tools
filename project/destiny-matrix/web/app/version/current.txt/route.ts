import { buildInfo, versionText } from "@/lib/version";

// Что сейчас на проде — вопрос, который задают в первую минуту разбора инцидента. Ответ отдаёт
// сам сайт: собранная версия вшита в образ на сборке, врать ей нечем.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(versionText(buildInfo()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
