import { forward } from "../../_lib/upstream";

export const dynamic = "force-dynamic";

export const GET = () => forward("/admin/sweeps", { auth: true });
