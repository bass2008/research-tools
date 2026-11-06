import { individualOrder } from "../../_lib/routes";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => individualOrder(req, "/individual-orders/start");
