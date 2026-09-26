import type { Metadata } from "next";
import { D } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { createPublicSettings, publicSettings, type PublicSettingInput } from "./settings/public";
import { forLocale as localizedSite } from "./site";
import { DEFAULT_SITE } from "./siteProfile";

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale, site) => {
  const { SITE } = localizedSite(L, site);

  /** Метаданные несуществующей страницы: not-found.tsx в metadata не участвует, поэтому заголовок
   * задаёт сегмент, который вызвал notFound(). */
  const NOT_FOUND_META: Metadata = {
    metadataBase: new URL(SITE.url),
    title: D.meta.notFoundTitle[L],
    description: D.meta.notFoundDescription[L],
    robots: { index: false, follow: false },
    // без этого 404 наследует canonical корневого layout и объявляет себя главной страницей
    alternates: { canonical: null },
    openGraph: {
      title: D.meta.notFoundTitle[L],
      url: undefined,
      images: [{ url: SITE.ogImage, width: SITE.ogWidth, height: SITE.ogHeight, alt: SITE.name }],
    },
    twitter: { card: "summary_large_image", images: [SITE.ogImage] },
  };

  // Коды подтверждения владения сайтом: Вебмастер и Search Console ищут их метатегом в <head>.
  // У доменов свои коды в runtime-профиле. Старые build-настройки остаются лишь для
  // вызовов без профиля, чтобы код одного домена не попадал на другой.
  function verification(env?: NodeJS.ProcessEnv | PublicSettingInput): Metadata["verification"] {
    if (!env && site !== DEFAULT_SITE) return site.verification;
    const source = env ? createPublicSettings({
      NEXT_PUBLIC_YANDEX_VERIFICATION: env.NEXT_PUBLIC_YANDEX_VERIFICATION,
      NEXT_PUBLIC_GOOGLE_VERIFICATION: env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    }) : publicSettings;
    const yandex = source.get("yandexVerification").trim();
    const google = source.get("googleVerification").trim();
    if (!yandex && !google) return undefined;
    return { ...(yandex ? { yandex } : {}), ...(google ? { google } : {}) };
  }
  return { NOT_FOUND_META, verification };
});

// Compatibility for callers that explicitly use the deployment default.
export const { NOT_FOUND_META, verification } = forLocale(defaultLocale);
