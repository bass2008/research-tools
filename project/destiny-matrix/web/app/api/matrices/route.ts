import { saveMatrix } from "../_lib/routes";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => saveMatrix(req);
