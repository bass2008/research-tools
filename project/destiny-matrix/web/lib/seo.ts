import type { Metadata } from "next";

/** Метаданные несуществующей страницы: not-found.tsx в metadata не участвует, поэтому заголовок
 * задаёт сегмент, который вызвал notFound(). */
export const NOT_FOUND_META: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: false },
};
