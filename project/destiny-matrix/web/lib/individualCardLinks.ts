import { forLocale as localizedEncyclopedia } from "@/lib/encyclopedia";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { forLocale as localizedMatrixMap } from "@/lib/matrixMap";
import { forLocale as localizedPositionArcanum } from "@/lib/positionArcanum";

/** «точка/аркан» → страница «аркан N в позиции»: своя страница точки, иначе страница линии,
 *  если точка лежит только на одной линии с такими страницами (R — и деньги, и отношения). */
export function individualCardLinks(L: Locale): Record<string, string> {
  const { registryItems, positionArcanumHref } = localizedPositionArcanum(L);
  const { positionByKey } = localizedEncyclopedia(L);
  const { sectionLineKeys } = localizedMatrixMap(L);
  const items = registryItems();
  const links: Record<string, string> = {};
  for (const item of items) {
    if (positionByKey(item.position)?.kind === "point") links[`${item.position}/${item.arcanum}`] = positionArcanumHref(item.position, item.arcanum);
  }
  const sections = [...new Set(items.map((i) => i.position).filter((key) => positionByKey(key)?.kind === "section"))];
  const lines = new Map(sections.map((key) => [key, sectionLineKeys(key, [])]));
  for (const item of items) {
    const line = lines.get(item.position);
    for (const point of line ?? []) {
      if (sections.filter((key) => lines.get(key)!.includes(point)).length === 1) {
        links[`${point}/${item.arcanum}`] ??= positionArcanumHref(item.position, item.arcanum);
      }
    }
  }
  return links;
}
