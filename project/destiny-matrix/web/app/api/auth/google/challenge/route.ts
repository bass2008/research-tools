import { googleAuth } from "@/app/api/_lib/googleAuth";
export const dynamic = "force-dynamic";
export const POST = (req: Request) => googleAuth(req, "challenge");
