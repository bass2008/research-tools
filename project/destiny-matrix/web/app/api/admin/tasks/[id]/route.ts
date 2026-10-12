import { forward } from "../../../_lib/upstream";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Bad request", { status: 400 });
  return forward(`/admin/tasks/${id}`, { method: "DELETE", auth: true, source: req });
}
