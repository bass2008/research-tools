import { acceptNotification } from "../../../_lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!/^[a-z][a-z0-9_-]{0,15}$/.test(provider)) return new Response("FAIL", { status: 400 });
  return acceptNotification(req, `/payments/notify/${provider}`);
}
