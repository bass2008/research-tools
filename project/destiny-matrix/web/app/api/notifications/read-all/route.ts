import { accountMutation } from "@/app/api/_lib/accountMutation";
export const dynamic = "force-dynamic";
export async function POST(req: Request) { return accountMutation(req, "/notifications/read-all", true, false); }
