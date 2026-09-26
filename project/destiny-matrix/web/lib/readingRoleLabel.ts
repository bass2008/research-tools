import type { ReadingRole } from "./readingTypes";

type RoleLabel = Pick<ReadingRole, "key" | "label">;

/** Diagram symbols (F, R2) are public; names like total_m are internal identifiers. */
export function readingRoleSymbol(role: RoleLabel): string | undefined {
  return /^[A-Z][0-9]*$/.test(role.key) ? role.key : undefined;
}

export function readingRoleReference(role: RoleLabel): string {
  return readingRoleSymbol(role) ?? role.label;
}
