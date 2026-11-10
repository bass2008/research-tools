import { googleAuth } from "@/app/api/_lib/googleAuth";
export const dynamic = "force-dynamic";
export const GET = (req: Request) => googleAuth(req, "config");
