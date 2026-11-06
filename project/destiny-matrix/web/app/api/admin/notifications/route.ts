import { forward } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return forward("/admin/notifications" + new URL(req.url).search, { source: req, auth: true });
}
