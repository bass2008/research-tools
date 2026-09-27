// Docker проверяет сам frontend без рендера страницы и обращения к API.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("OK", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
