import { article } from "@/app/_lib/article";
import { requestLocale } from "@/lib/i18n/request";
import { requestSite } from "@/lib/siteProfile.server";
import type { Lang } from "@/lib/i18n/hosts";

export const dynamic = "force-dynamic";

/** A versioned native representation of an existing article URL, never arbitrary files. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const path = query.get("path");
  if (!path || query.getAll("path").length !== 1) return Response.json({ detail: "Article path required" }, { status: 400 });
  const prefix = /^\/(ru|en)(?=\/)/.exec(path);
  const locale = prefix ? prefix[1] as Lang : await requestLocale(request);
  const result = article(prefix ? path.slice(prefix[0].length) : path, { locale, site: await requestSite(request) });
  if (!result) return Response.json({ detail: locale === "ru" ? "Статья не найдена" : "Article not found" }, { status: 404 });
  return Response.json(result.document, { headers: {
    "Cache-Control": "private, no-store", "Content-Language": locale, "X-Robots-Tag": "noindex",
  } });
}
