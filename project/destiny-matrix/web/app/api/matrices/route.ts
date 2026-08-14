import { saveMatrix } from "../_lib/routes";
import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

export const GET = () => forward("/matrices", { auth: true });
export const POST = (req: Request) => saveMatrix(req);
