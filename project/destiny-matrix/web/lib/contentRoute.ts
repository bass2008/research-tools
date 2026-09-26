import { forLocale } from "./content";
import type { Lang } from "./i18n/lang";

/** Finite content routes used to be rejected by static generation. They now render
 * per request, so reject missing records before Next starts streaming the layout.
 * Use the same content reader as pages, never a second list of allowed URLs. */
export function missingContentRoute(path: string, locale: Lang): boolean {
  const match = /^\/(?:encyclopedia\/(arcanum|chakra|position|combination|karmic-tail)|(matrix|year))\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (!match) return false;
  const [, section, root, key, child] = match;
  const content = forLocale(locale);
  if (child) {
    return section === "position" && !content.positionArcanumRows().some(
      (row) => row.position === key && row.arcanum === Number(child),
    );
  }
  switch (section ?? root) {
    case "arcanum": return !/^\d{1,2}$/.test(key) || !content.arcanumContent(Number(key));
    case "chakra": return !content.chakraContent(key);
    case "position": return !content.positionContent(key);
    case "combination": return !content.combinationContent(key);
    case "karmic-tail": return !content.karmicTail(key);
    case "matrix": return !content.matrixItem(key);
    case "year": return !content.yearArcanum(key);
    default: return false;
  }
}
