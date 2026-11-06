import { forward, readJson } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forward(`/admin/individual-readings/${encodeURIComponent(id)}/approve`, { auth: true, source: req, method: "POST", body: await readJson(req) });
}
