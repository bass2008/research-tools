import { forward } from "../../_lib/upstream";

export const POST = async (req: Request) => forward("/auth/metrika-client", {
  method: "POST", auth: true, source: req, body: await req.json().catch(() => ({})),
});
