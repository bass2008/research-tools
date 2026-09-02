export const ENCYCLOPEDIA_SECTIONS = [
  { key: "arc", title: "22 аркана", hint: "значение каждого числа", segment: "arcanum" },
  { key: "sec", title: "Разделы отчёта", hint: "что показывает полный разбор" },
  { key: "pts", title: "Позиции карты", hint: "точки октаграммы и линии рода" },
  { key: "chk", title: "Семь чакр", hint: "карта энергий по уровням", segment: "chakra" },
  { key: "tls", title: "Кармические хвосты", hint: "тройки нижнего угла карты", segment: "karmic-tail" },
  { key: "yer", title: "Матрица судьбы на год", hint: "аркан в рамке персонального года", externalRoot: "na-god" },
  { key: "cmb", title: "Сочетания арканов", hint: "пары арканов рядом", segment: "combination" },
  { key: "art", title: "Статьи", hint: "разборы понятий целиком" },
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
const BY_EXTERNAL_ROOT = new Map<string, EncyclopediaSectionKey>(
  ENCYCLOPEDIA_SECTIONS.flatMap((section) =>
    "externalRoot" in section ? [[section.externalRoot, section.key] as const] : []),
);

export function encyclopediaSection(key: EncyclopediaSectionKey): EncyclopediaSectionMeta {
  const section = BY_KEY.get(key);
  if (!section) throw new Error(`неизвестный раздел энциклопедии ${key}`);
  return section;
}

export function encyclopediaSectionHref(key: EncyclopediaSectionKey): string {
  return `/encyclopedia?sec=${key}`;
}

export function encyclopediaSectionCrumb(key: EncyclopediaSectionKey): { name: string; path: string } {
  return { name: encyclopediaSection(key).title, path: encyclopediaSectionHref(key) };
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
  if (articlePaths.includes(path)) return "art";
  const parts = path.split("/").filter(Boolean);
  const external = encyclopediaSectionFromExternalRoot(parts[0]);
  if (external) return external;
  if (parts[0] !== "encyclopedia" || parts.length === 1) return null;
  if (parts[1] === "position") return positionKinds[parts[2] ?? ""] ?? "sec";
  if (["character", "comfort", "profession"].includes(parts[1])) return "sec";
  return encyclopediaSectionFromSegment(parts[1]);
}
