import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// история платежей кабинета: только чтение и только со своей кукой
export const GET = () => forward("/payments", { auth: true });
