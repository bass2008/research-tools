import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import type { ReadingRoleParts as RoleParts } from "@/lib/readingTypes";
import { forLocale as localizedText } from "@/lib/text";

export const forLocale = localized((L: Locale) => {
  const { sentence } = localizedText(L);

  return { sentence };
});

/** Четыре канонических кубика роли — одинаково в отчёте, PDF и персональной статье. */
export default function CharacterRoleParts({ locale: requestedLocale, ...localeProps }: ({ role: RoleParts }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { role } = localeProps;
  const { sentence } = forLocale(L);

  return (
    <div className="character-role-parts">
      <p>
        <strong>{D.sheet.essence[L]}</strong> {sentence(role.essence)}
      </p>
      <p>
        <strong>{D.sheet.strength[L]}</strong> {sentence(role.strength)}
      </p>
      <p>
        <strong>{D.sheet.risk[L]}</strong> {sentence(role.risk)}
      </p>
      <p>
        <strong>{D.sheet.action[L]}</strong> {sentence(role.action)}
      </p>
    </div>
  );
}
