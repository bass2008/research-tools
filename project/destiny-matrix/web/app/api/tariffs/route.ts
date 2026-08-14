import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// Прайс браузеру: статические страницы собраны заранее и цену из базы напечатать не могут,
// поэтому кнопки покупки дочитывают её отсюда.
export const GET = () => forward("/tariffs");
