import type { Metadata } from "next";

import { SITE } from "./site";
import { createPublicSettings, publicSettings, type PublicSettingInput } from "./settings/public";

/** Метаданные несуществующей страницы: not-found.tsx в metadata не участвует, поэтому заголовок
 * задаёт сегмент, который вызвал notFound(). */
export const NOT_FOUND_META: Metadata = {
  metadataBase: new URL(SITE.url),
  title: "Страница не найдена",
  description: "Такой страницы на сайте нет. Отсюда можно вернуться к расчёту или в справочник.",
  robots: { index: false, follow: false },
  // без этого 404 наследует canonical корневого layout и объявляет себя главной страницей
  alternates: { canonical: null },
  openGraph: {
    title: "Страница не найдена",
    url: undefined,
    images: [{ url: SITE.ogImage, width: SITE.ogWidth, height: SITE.ogHeight, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", images: [SITE.ogImage] },
};

// Коды подтверждения владения сайтом: Вебмастер и Search Console ищут их метатегом в <head>.
// Приходят сборкой, а не лежат в коде: у контуров они разные, а пустой тег хуже отсутствующего.
export function verification(env?: NodeJS.ProcessEnv | PublicSettingInput): Metadata["verification"] {
  const source = env ? createPublicSettings({
    NEXT_PUBLIC_YANDEX_VERIFICATION: env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    NEXT_PUBLIC_GOOGLE_VERIFICATION: env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  }) : publicSettings;
  const yandex = source.get("yandexVerification").trim();
  const google = source.get("googleVerification").trim();
  if (!yandex && !google) return undefined;
  return { ...(yandex ? { yandex } : {}), ...(google ? { google } : {}) };
}
