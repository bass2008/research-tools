import { forward } from "@/app/api/_lib/upstream";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return forward("/individual-readings" + new URL(req.url).search, { auth: true, source: req });
}
