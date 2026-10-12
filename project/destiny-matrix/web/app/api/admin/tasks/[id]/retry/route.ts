import { forward } from "../../../../_lib/upstream";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Bad request", { status: 400 });
  return forward(`/admin/tasks/${id}/retry`, { method: "POST", auth: true, source: req });
}
