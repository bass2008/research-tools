import { forward } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

// админка только читает; кто админ — решает апстрим по списку почт в своём конфиге
export const GET = () => forward("/admin/users", { auth: true });
