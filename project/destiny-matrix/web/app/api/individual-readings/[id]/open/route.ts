import { forward, readJson } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const response = await forward(`/individual-readings/${encodeURIComponent(id)}/open`, {
    optionalAuth: true, source: req, method: "POST", body: await readJson(req),
  });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
