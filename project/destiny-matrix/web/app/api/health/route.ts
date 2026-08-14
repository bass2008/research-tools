import { forward } from "../_lib/upstream";

export const dynamic = "force-dynamic";

// Пробник для селениума и мониторинга: через BFF видно, жив ли апстрим, без прямого доступа к нему.
export const GET = () => forward("/health");
