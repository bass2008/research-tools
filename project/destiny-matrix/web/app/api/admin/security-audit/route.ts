import type { NextRequest } from "next/server";

import { forward } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => {
  const qs = req.nextUrl.searchParams.toString();
  return forward(`/admin/security-audit${qs ? `?${qs}` : ""}`, { auth: true });
};
