// `hub` — адрес шапки раздела. Без него уровень существовал только как фильтр `?sec=`, и крошка
// на каждом листе объявляла родителем адрес, которого как страницы нет: он несёт canonical на
// `/encyclopedia` и потому не может ни собирать вес, ни отвечать на запрос раздела. «Разделы
// отчёта» и «Позиции карты» делят один хаб: их листья лежат в одном роуте `position/[key]`, и
// разводит их только `anchor` внутри страницы. У «Статей» хаба нет — это набор адресов первого
// уровня, а не ветка справочника.
import { D, L } from "./i18n";

export const ENCYCLOPEDIA_SECTIONS = [
  { key: "arc", title: D.encSections.arc.title[L], hint: D.encSections.arc.hint[L], segment: "arcanum", hub: "/encyclopedia/arcanum" },
  { key: "sec", title: D.encSections.sec.title[L], hint: D.encSections.sec.hint[L], hub: "/encyclopedia/position", anchor: "razdely" },
  { key: "pts", title: D.encSections.pts.title[L], hint: D.encSections.pts.hint[L], hub: "/encyclopedia/position", anchor: "tochki" },
  { key: "chk", title: D.encSections.chk.title[L], hint: D.encSections.chk.hint[L], segment: "chakra", hub: "/encyclopedia/chakra" },
  { key: "tls", title: D.encSections.tls.title[L], hint: D.encSections.tls.hint[L], segment: "karmic-tail", hub: "/encyclopedia/karmic-tail" },
  { key: "yer", title: D.encSections.yer.title[L], hint: D.encSections.yer.hint[L], externalRoot: "year", hub: "/year" },
  { key: "cmb", title: D.encSections.cmb.title[L], hint: D.encSections.cmb.hint[L], segment: "combination", hub: "/encyclopedia/combination" },
  { key: "art", title: D.encSections.art.title[L], hint: D.encSections.art.hint[L], anchor: "stati" },
] as const;

export type EncyclopediaSectionKey = (typeof ENCYCLOPEDIA_SECTIONS)[number]["key"];
export type PositionSectionKey = Extract<EncyclopediaSectionKey, "sec" | "pts">;

export interface EncyclopediaSectionMeta {
  key: EncyclopediaSectionKey;
  title: string;
  hint: string;
}

const BY_KEY = new Map(ENCYCLOPEDIA_SECTIONS.map((section) => [section.key, section]));
const BY_SEGMENT = new Map<string, EncyclopediaSectionKey>(
  ENCYCLOPEDIA_SECTIONS.flatMap((section) =>
    "segment" in section ? [[section.segment, section.key] as const] : []),
);
const HUB_PATHS = new Set<string>(
  ENCYCLOPEDIA_SECTIONS.flatMap((section) => ("hub" in section ? [section.hub] : [])),
);
const BY_EXTERNAL_ROOT = new Map<string, EncyclopediaSectionKey>(
  ENCYCLOPEDIA_SECTIONS.flatMap((section) =>
    "externalRoot" in section ? [[section.externalRoot, section.key] as const] : []),
);

export function encyclopediaSection(key: EncyclopediaSectionKey): EncyclopediaSectionMeta {
  const section = BY_KEY.get(key);
  if (!section) throw new Error(`неизвестный раздел энциклопедии ${key}`);
  return section;
}

/** Адрес хаба раздела; null у разделов, у которых своей страницы нет. */
export function encyclopediaSectionHub(key: EncyclopediaSectionKey): string | null {
  const section = BY_KEY.get(key);
  if (!section) throw new Error(`неизвестный раздел энциклопедии ${key}`);
  return "hub" in section ? section.hub : null;
}

/** Ссылка меню: с якорем, чтобы два раздела на общем хабе вели к своей половине страницы. */
export function encyclopediaSectionHref(key: EncyclopediaSectionKey): string {
  const section = BY_KEY.get(key);
  if (!section) throw new Error(`неизвестный раздел энциклопедии ${key}`);
  // Раздел без хаба ведёт на якорь оглавления, а не на `?sec=`: параметр давал новый адрес,
  // который поиск скачивал и складывал в «неканонические» — по одной такой ссылке с каждой
  // страницы справочника. Якорь нового адреса не создаёт.
  if (!("hub" in section)) return `/encyclopedia#${section.anchor}`;
  return "anchor" in section ? `${section.hub}#${section.anchor}` : section.hub;
}

/** Крошка — без якоря: в цепочке родителей стоит страница, а не её часть. */
export function encyclopediaSectionCrumb(key: EncyclopediaSectionKey): { name: string; path: string } {
  const hub = encyclopediaSectionHub(key);
  // Раздел без хаба ссылается на свой блок в оглавлении. Это единственная крошка с якорем:
  // `item` в BreadcrumbList обязателен у всех звеньев, кроме последнего, а прежний `?sec=`
  // заявлял там адрес, который сам несёт canonical на другой.
  return { name: encyclopediaSection(key).title, path: hub ?? encyclopediaSectionHref(key) };
}

export function encyclopediaSectionFromSegment(segment: string | undefined): EncyclopediaSectionKey | null {
  return segment ? BY_SEGMENT.get(segment) ?? null : null;
}

export function encyclopediaSectionFromExternalRoot(root: string | undefined): EncyclopediaSectionKey | null {
  return root ? BY_EXTERNAL_ROOT.get(root) ?? null : null;
}

/** Resolve the active encyclopedia section for both nested and external article routes. */
export function encyclopediaSectionFromPath(
  path: string,
  positionKinds: Record<string, PositionSectionKey>,
  articlePaths: readonly string[],
): EncyclopediaSectionKey | null {
  // Шапка раздела — не статья, а голова своей ветки: раньше `/encyclopedia/karmic-tail` и
  // `/year` попадали в «Статьи», и меню утверждало, что человек в статьях, пока рядом стоял
  // неподсвеченным пункт его собственного раздела. Четыре новые шапки такого поведения не
  // унаследовали, и разъезд был виден только на этих двух.
  if (articlePaths.includes(path) && !HUB_PATHS.has(path)) return "art";
  const parts = path.split("/").filter(Boolean);
  const external = encyclopediaSectionFromExternalRoot(parts[0]);
  if (external) return external;
  if (parts[0] !== "encyclopedia" || parts.length === 1) return null;
  // Шапка раздела подсвечивает «Позиции карты» — то же имя стоит и в её крошке. Лист выбирает
  // половину по виду позиции: «Разделы отчёта» и «Позиции карты» лежат в одном роуте.
  if (parts[1] === "position") {
    return parts.length === 2 ? "pts" : positionKinds[parts[2] ?? ""] ?? "sec";
  }
  if (["character", "comfort", "profession"].includes(parts[1])) return "sec";
  return encyclopediaSectionFromSegment(parts[1]);
}
