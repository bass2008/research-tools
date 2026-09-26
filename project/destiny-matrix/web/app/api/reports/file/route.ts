import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { selectedLocale } from "@/lib/i18n/requestPolicy";
import { requestSite } from "@/lib/siteProfile.server";
import { upstreamUrl } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// Выдача PDF из локального хранилища стендов. Свой обработчик, а не forward(): тот читает ответ
// как JSON, а здесь по проводу идёт файл. На проде хранилище — S3, и этот маршрут отвечает 404.
export async function GET(req: Request) {
  // A PDF link opens as a document: its Accept-Language comes from the browser,
  // not from our localized API client. Keep the explicit website preference.
  const L = req.headers.get("sec-fetch-mode") === "navigate"
    ? selectedLocale(req.headers, await requestSite(req))
    : await requestLocale(req);
  const error = (text: string, status: number) => new Response(text, {
    status, headers: { "Content-Language": L, "Cache-Control": "no-store" },
  });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return error(D.bffErrors.noPass[L], 400);

  let res: Response;
  try {
    res = await fetch(upstreamUrl(`/reports/file?token=${encodeURIComponent(token)}`), {
      cache: "no-store",
      headers: { "Accept-Language": L },
    });
  } catch {
    return error(D.bffErrors.serviceDown[L], 502);
  }
  if (!res.ok) return error(D.bffErrors.fileGone[L], res.status);

  const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "no-store" });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new Response(res.body, { status: 200, headers });
}
