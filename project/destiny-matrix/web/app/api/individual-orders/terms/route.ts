import { forward } from "@/app/api/_lib/upstream";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => forward("/individual-orders/terms", { source: req, optionalAuth: true });
