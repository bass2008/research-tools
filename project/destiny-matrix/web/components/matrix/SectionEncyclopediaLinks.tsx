import Link from "next/link";

import {
  positionHref,
  sectionEntityLink,
  type SectionOut,
} from "@/lib/publicSpec";
import { D, L } from "@/lib/i18n";
import { publicHref } from "@/lib/site";

export default function SectionEncyclopediaLinks({
  section,
  printing = false,
}: {
  section: SectionOut;
  printing?: boolean;
}) {
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
