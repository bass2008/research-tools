import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// Состояние печати своих разборов: по нему кнопка знает, готов ли файл, и не обещает ожидание там,
// где ждать нечего.
export const GET = () => forward("/reports", { auth: true });
