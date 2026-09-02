import type { ReadingRoleParts as RoleParts } from "@/lib/readingTypes";
import { sentence } from "@/lib/text";

/** Четыре канонических кубика роли — одинаково в отчёте, PDF и персональной статье. */
export default function CharacterRoleParts({ role }: { role: RoleParts }) {
  return (
    <div className="character-role-parts">
      <p>
        <strong>Суть.</strong> {sentence(role.essence)}
      </p>
      <p>
        <strong>Сила.</strong> {sentence(role.strength)}
      </p>
      <p>
        <strong>Риск.</strong> {sentence(role.risk)}
      </p>
      <p>
        <strong>Действие.</strong> {sentence(role.action)}
      </p>
    </div>
  );
}
