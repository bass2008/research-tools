import { requestSite } from "@/lib/siteProfile.server";
import JsonLd from "@/components/ui/JsonLd";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedSchema, type Crumb } from "@/lib/schema";
import Link from "next/link";
import { Fragment } from "react";

export const forLocale = localized((L: Locale, site) => {
  const { breadcrumbLd } = localizedSchema(L, site);

  return { breadcrumbLd };
});

// Крошки и их разметка выводятся одним компонентом: пока они жили порознь, на страницах была
// видимая цепочка без BreadcrumbList, и поиск строил хлебные крошки сам, как умел.
export default async function Crumbs({ locale: requestedLocale, ...localeProps }: ({ trail: Crumb[] }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { trail } = localeProps;
  const { breadcrumbLd } = forLocale(L, await requestSite());

  return (
    <>
      <JsonLd data={breadcrumbLd(trail)} />
      <p className="crumbs">
        {trail.map((c, i) => (
          <Fragment key={`${c.name}-${i}`}>
            {i > 0 ? <span>/</span> : null}
            {c.path ? <Link href={c.path}>{c.name}</Link> : <span>{c.name}</span>}
          </Fragment>
        ))}
      </p>
    </>
  );
}
