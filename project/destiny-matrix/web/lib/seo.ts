import type { Metadata } from "next";

/** Метаданные несуществующей страницы: not-found.tsx в metadata не участвует, поэтому заголовок
 * задаёт сегмент, который вызвал notFound(). */
export const NOT_FOUND_META: Metadata = {
  title: "Страница не найдена",
  description: "Такой страницы на сайте нет. Отсюда можно вернуться к расчёту или в справочник.",
  robots: { index: false, follow: false },
  // без этого 404 наследует canonical корневого layout и объявляет себя главной страницей
  alternates: { canonical: null },
  openGraph: { title: "Страница не найдена", url: undefined },
};

// Коды подтверждения владения сайтом: Вебмастер и Search Console ищут их метатегом в <head>.
// Приходят сборкой, а не лежат в коде: у контуров они разные, а пустой тег хуже отсутствующего.
export function verification(env: NodeJS.ProcessEnv = process.env): Metadata["verification"] {
  const yandex = env.NEXT_PUBLIC_YANDEX_VERIFICATION?.trim();
  const google = env.NEXT_PUBLIC_GOOGLE_VERIFICATION?.trim();
  if (!yandex && !google) return undefined;
  return { ...(yandex ? { yandex } : {}), ...(google ? { google } : {}) };
}
