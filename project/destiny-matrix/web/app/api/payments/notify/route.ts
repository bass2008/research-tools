import { acceptNotification } from "../../_lib/notify";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => acceptNotification(req, "/payments/notify");
