import Link from "next/link";

import {
  positionHref,
  sectionEntityLink,
  type SectionOut,
} from "@/lib/publicSpec";
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

  if (section.key !== "character") {
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
    <div className="encref character-encrefs" data-testid="character-encyclopedia-links">
      <div className="character-encref-group">
        <span className="character-encref-label">По вашей матрице</span>
        <Link
          href={href(entity.href)}
          data-entity-type={entity.entityType}
          data-entity-key={entity.entityKey}
          data-position-key={entity.positionKey}
          data-testid="character-full-link"
        >
          {entity.label}
        </Link>
      </div>
      <span className="character-encref-separator" aria-hidden="true" />
      <div className="character-encref-group">
        <span className="character-encref-label">О методе</span>
        <Link href={href(positionHref("character"))}>
          Как читать раздел «Характер и личные качества» →
        </Link>
      </div>
    </div>
  );
}
