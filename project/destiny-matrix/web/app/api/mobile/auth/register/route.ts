import { credentials } from "@/app/api/_lib/routes";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return credentials(req, "register", false); }
