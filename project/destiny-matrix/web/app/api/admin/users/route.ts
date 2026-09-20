import type { NextRequest } from "next/server";

import { forward } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// админка только читает; кто админ — решает апстрим по списку почт в своём конфиге
export const GET = (req: NextRequest) => {
  const qs = req.nextUrl.searchParams.toString();
  return forward(`/admin/users${qs ? `?${qs}` : ""}`, { auth: true });
};
