import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedContent } from "@/lib/content";

// The widget asks for these only after showing a year: in the page HTML they would repeat the year articles everywhere.
export async function GET(req: Request) {
  const L = await requestLocale(req);
  const { yearArcanum, yearKeys } = localizedContent(L);
  const lead = (text: string) => (text.match(/[^.!?…]+[.!?…]+/g) ?? []).slice(0, 2).join("").trim();
  const meanings = Object.fromEntries(yearKeys().filter((k) => /^\d{1,2}$/.test(k)).map((k) => [k, lead(yearArcanum(k)?.short ?? "")]));
  return Response.json(meanings, { headers: { "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
}
