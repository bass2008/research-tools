import { requestSite } from "@/lib/siteProfile.server";
import JsonLd from "@/components/ui/JsonLd";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedSchema, type Crumb } from "@/lib/schema";

export const forLocale = localized((L: Locale, site) => {
  const { breadcrumbLd } = localizedSchema(L, site);

  return { breadcrumbLd };
});

// Видимую цепочку внутри справочника рисует каркас (EncCrumbs), а разметку BreadcrumbList
// печатает страница: она одна знает свой заголовок и путь.
export default async function CrumbsLd({ locale: requestedLocale, ...localeProps }: ({ trail: Crumb[] }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { trail } = localeProps;
  const { breadcrumbLd } = forLocale(L, await requestSite());

  return <JsonLd data={breadcrumbLd(trail)} />;
}
