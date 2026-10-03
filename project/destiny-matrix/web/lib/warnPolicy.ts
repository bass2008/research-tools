import { blockedTextMatch } from "./textPolicy";

export function warnPolicy(text: string, where: string): void {
  const found = blockedTextMatch(text);
  if (found) console.warn(`[text-policy] ${where}: «${found.matched}» (${found.category})`);
}
