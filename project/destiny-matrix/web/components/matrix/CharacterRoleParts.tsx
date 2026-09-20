import { D, L } from "@/lib/i18n";
import type { ReadingRoleParts as RoleParts } from "@/lib/readingTypes";
import { sentence } from "@/lib/text";

/** Четыре канонических кубика роли — одинаково в отчёте, PDF и персональной статье. */
export default function CharacterRoleParts({ role }: { role: RoleParts }) {
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
