import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import {
  forLocale as localizedPublicSpec,
  type SectionOut
} from "@/lib/publicSpec";
import { forLocale as localizedSite } from "@/lib/site";
import Link from "next/link";

export const forLocale = localized((L: Locale, site) => {
  const { positionHref, sectionEntityLink } = localizedPublicSpec(L);
  const { publicHref } = localizedSite(L, site);

  return { positionHref, sectionEntityLink, publicHref };
});

export default function SectionEncyclopediaLinks({ site = DEFAULT_SITE, locale: requestedLocale, ...localeProps }: ({
  section: SectionOut;
  printing?: boolean;
}) & { locale?: Locale; site?: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    section,
    printing = false,
  } = localeProps;
  const { positionHref, sectionEntityLink, publicHref } = forLocale(L, site);

  const entity = sectionEntityLink(section);
  const href = (path: string) => (printing ? publicHref(path) : path);

  if (!section.personalHref) {
    return (
      <p className="encref">
        <Link
          href={href(entity.href)}
          data-entity-type={entity.entityType}
          data-entity-key={entity.entityKey}
          data-position-key={entity.positionKey}
        >
          {entity.label}
        </Link>
      </p>
    );
  }

  return (
    <div className="encref character-encrefs" data-testid={`${section.key}-encyclopedia-links`}>
      <div className="character-encref-group">
        <span className="character-encref-label">{D.sheet.byYourMatrix[L]}</span>
        <Link
          href={href(entity.href)}
          data-entity-type={entity.entityType}
          data-entity-key={entity.entityKey}
          data-position-key={entity.positionKey}
          data-testid={`${section.key}-full-link`}
        >
          {entity.label}
        </Link>
      </div>
      <span className="character-encref-separator" aria-hidden="true" />
      <div className="character-encref-group">
        <span className="character-encref-label">{D.sheet.aboutMethod[L]}</span>
        <Link href={href(positionHref(section.key))}>
          {D.sheet.howToRead[L](section.title)}
        </Link>
      </div>
    </div>
  );
}
