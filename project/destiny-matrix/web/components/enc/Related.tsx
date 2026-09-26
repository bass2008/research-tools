import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedRelated } from "@/lib/related";
import Link from "next/link";

export const forLocale = localized((L: Locale) => {
  const { relatedBoth } = localizedRelated(L);

  return { relatedBoth };
});

export default function Related({ locale: requestedLocale, ...localeProps }: ({
  path: string;
  refs: string[];
  /** адреса, которые страница уже показала отдельным блоком: иначе ссылка печатается дважды */
  skip?: string[];
  title?: string;
  hint?: string;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    path,
    refs,
    skip = [],
    title = D.octagram.relatedTitle[L],
    hint = D.octagram.relatedHint[L],
  } = localeProps;
  const { relatedBoth } = forLocale(L);

  const links = relatedBoth(path, refs).filter((l) => !skip.includes(l.href));
  if (!links.length) return null;
  return (
    <div className="panel section-gap">
      <h3>{title}</h3>
      <div className="cap">{hint}</div>
      <div className="taglist">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
