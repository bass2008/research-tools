import { payment } from "../../_lib/routes";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => payment(req, "/payments/start");
