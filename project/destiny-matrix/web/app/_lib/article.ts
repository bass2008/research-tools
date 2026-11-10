/** Server-only assembly. Native clients import mobileContentContract, never this module. */
import { forLocale as contentForLocale } from "@/lib/content";
import type { ArticleContent, ArcanumContent, ChakraContent, CombinationContent, Paragraph, PositionContent, QA, Section } from "@/lib/contentReader";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { forLocale as encyclopediaForLocale } from "@/lib/encyclopedia";
import { forLocale as navigationForLocale } from "@/lib/encyclopediaNavigation";
import { forLocale as characterForLocale } from "@/lib/character";
import { forLocale as combinationForLocale, type CombinationArticleReading } from "@/lib/combinationReading";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { forLocale as readingsForLocale } from "@/lib/sectionReadings";
import { forLocale as positionsForLocale, type PositionArcanumReading } from "@/lib/positionArcanum";
import { forLocale as mapForLocale } from "@/lib/matrixMap";
import { forLocale as relatedForLocale } from "@/lib/related";
import { forLocale as textForLocale } from "@/lib/text";
import { PERSONAL_SECTION_KEYS, type PersonalSectionKey } from "@/lib/sectionReadingShared";
import type { Lang } from "@/lib/i18n/hosts";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import type { ContentBlock, MobileArticle } from "@/lib/mobileContentContract";
import type { ChakraReadingRow, LongformReading, ReadingRoleParts } from "@/lib/readingTypes";
import { legalArticle } from "./legalArticle";
import type { LegalDoc } from "@/lib/legal/types";
import type { SiteProfile } from "@/lib/siteProfile";

type SourceMap = {
  arcanum: ArcanumContent;
  position: PositionContent;
  intersection: PositionArcanumReading;
  chakra: ChakraContent;
  combination: { entry: CombinationContent; reading: CombinationArticleReading };
  text: ArticleContent;
  reading: LongformReading;
  legal: LegalDoc;
  index: { title: string; links: Array<{ label: string; href: string }> };
};
type ArticleSource = { [K in keyof SourceMap]: { kind: K; data: SourceMap[K] } }[keyof SourceMap];
export interface ArticleContext {
  locale: Lang;
  site?: SiteProfile;
  /** Explicit for future private article families; current encyclopedia articles are public. */
  access?: { userId: number; until: string | null } | null;
}
export interface ArticleResult { document: MobileArticle; source: ArticleSource }

function paragraph(text: string): ContentBlock[] { return text ? [{ type: "paragraph", text }] : []; }
function heading(text: string, level: 2 | 3 = 2): ContentBlock[] { return text ? [{ type: "heading", text, level }] : []; }
function link(label: string, href: string): ContentBlock { return { type: "link", label, href }; }

function chakraBlocks(row: ChakraReadingRow): ContentBlock[] {
  return [...heading(row.title), ...paragraph(row.topic), ...heading(row.heading, 3), {
    type: "cards", cards: row.cells.map((cell) => ({ arcanum: cell.arcanum, label: cell.title, href: `/encyclopedia/arcanum/${cell.arcanum}` })),
  }, ...row.cells.flatMap((cell) => paragraph(cell.caption)), ...row.paragraphs.flatMap(paragraph)];
}

function paragraphs(items: Paragraph[], locale: Lang, pairLink?: { label: string; href: string }): ContentBlock[] {
  return items.flatMap((item): ContentBlock[] => {
    if (typeof item === "string") return paragraph(item);
    if ("h3" in item) return heading(item.h3, 3);
    if ("ul" in item) return [{ type: "list", items: item.ul, ordered: false }];
    if ("ol" in item) return [{ type: "list", items: item.ol, ordered: true }];
    if ("table" in item) return [{ type: "table", ...item.table }];
    if ("chakra_reading" in item) return [...chakraBlocks(item.chakra_reading.row), ...paragraph(item.chakra_reading.note ?? "")];
    return item.slot === "pair" ? [link(pairLink?.label ?? DP.encCompat.calcButton[locale], pairLink?.href ?? "/compatibility")]
      : [link(D.matrixPages.calcMatrix[locale], "/")];
  });
}
function sections(items: Section[], locale: Lang, pairLink?: { label: string; href: string }): ContentBlock[] {
  return items.flatMap((item) => [...heading(item.h2), ...paragraphs(item.paragraphs, locale, pairLink)]);
}
function faq(items: QA[], locale: Lang): ContentBlock[] {
  return items.length ? [...heading(D.octagram.faqTitle[locale]), ...items.flatMap((item) => [...heading(item.q, 3), ...paragraph(item.a)])] : [];
}

function roleParts(role: ReadingRoleParts, locale: Lang): ContentBlock[] {
  const { sentence } = textForLocale(locale);
  return (["essence", "strength", "risk", "action"] as const).flatMap((key) => paragraph(`**${D.sheet[key][locale]}** ${sentence(role[key])}`));
}

/** Preserves the same role, interaction, chakra and year data as CharacterReadingView. */
function readingBlocks(reading: LongformReading, locale: Lang): ContentBlock[] {
  if (reading.layout === "chakras") return [
    ...(reading.chakraRows ?? []).flatMap((row) => [...chakraBlocks(row), link(D.sheet.chakraMore[locale](row.title), `/encyclopedia/chakra/${row.key}`)]),
    ...(reading.energyField ? [...chakraBlocks(reading.energyField), link(D.sheet.energyFieldMore[locale], "/encyclopedia/chakra/energy-field")] : []),
    ...paragraph(reading.chakraNote ?? ""),
  ];
  const blocks: ContentBlock[] = [...paragraph(reading.summary), ...heading(reading.rolesTitle), ...paragraph(reading.rolesLead)];
  if (reading.layout === "years" && reading.agePeriods) {
    for (const period of reading.agePeriods) blocks.push(
      ...heading(D.sheet.ageRange[locale](period.from, period.to), 3),
      ...paragraph(period.current ? D.sheet.currentStage[locale] : period.next ? D.sheet.nextStage[locale] : ""),
      link(`${period.arcanum} · ${period.title}`, `/encyclopedia/arcanum/${period.arcanum}`), ...roleParts(period, locale),
    );
  } else {
    for (const role of reading.roles) blocks.push(...heading(role.label, 3),
      { type: "cards", cards: [{ arcanum: role.arcanum, label: role.title, href: `/encyclopedia/arcanum/${role.arcanum}` }] },
      ...paragraph(role.question), ...(role.sameAs ? paragraph(D.sheet.sameAsRole[locale](role.sameAs.label)) : roleParts(role, locale)),
    );
  }
  blocks.push(...heading(reading.interactionsTitle), ...paragraph(reading.interactionsLead));
  for (const interaction of reading.interactions) blocks.push(...heading(interaction.title, 3), ...paragraph(interaction.caption ?? ""),
    ...interaction.paragraphs.flatMap(paragraph), ...(interaction.href && interaction.linkLabel ? [link(interaction.linkLabel, interaction.href)] : []));
  blocks.push(...heading(D.sheet.conclusionTitle[locale]), ...heading(D.sheet.mainStrength[locale], 3), ...paragraph(reading.strength),
    ...heading(D.sheet.mainTension[locale], 3), ...paragraph(reading.tension), ...heading(D.sheet.practicalStep[locale], 3), ...paragraph(reading.practice));
  return blocks;
}

/** Never turn a URL into a filesystem path. Only the explicit route families below resolve. */
export function article(rawPath: string, context: ArticleContext): ArticleResult | null {
  if (!rawPath.startsWith("/") || rawPath.startsWith("//") || /[\\\u0000-\u001f]/.test(rawPath)
    || /\/(?:\.|%2e){1,2}(?:\/|%2f|$)/i.test(rawPath) || rawPath.length > 2048) return null;
  const url = new URL(rawPath, "https://article.invalid");
  const path = url.pathname.replace(/\/$/, "");
  // Parameters used by existing article links. Native articles show all tabs in reading order.
  for (const key of url.searchParams.keys()) {
    if (key === "birth" && path.startsWith("/encyclopedia/years/")) continue;
    if (key === "tab" && /^\/encyclopedia\/arcanum\/\d{1,2}$/.test(path)
      && ["meaning", "positions", "combos", "where"].includes(url.searchParams.get("tab") ?? "")) continue;
    return null;
  }
  if (url.searchParams.getAll("birth").length > 1) return null;
  if (url.searchParams.getAll("tab").length > 1) return null;
  if (url.searchParams.has("birth") && !/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("birth")!)) return null;
  const locale = context.locale;
  const legal = legalArticle(path, locale, context.site);
  if (legal) return { document: legal.document, source: legal.doc ? { kind: "legal", data: legal.doc } : { kind: "index", data: { title: legal.document.title, links: [] } } };
  const c = contentForLocale(locale);
  const e = encyclopediaForLocale(locale);
  const { arcanumTitle } = arcanaForLocale(locale);
  const map = mapForLocale(locale);
  let source: ArticleSource | null = null;
  let title = "", lead = "";
  let blocks: ContentBlock[] = [];
  const match = /^\/encyclopedia\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(path);
  const family = match?.[1], key = match?.[2], child = match?.[3];
  const textArticle = (entry: ArticleContent | null) => {
    if (!entry) return;
    source = { kind: "text", data: entry }; title = entry.title; lead = entry.short;
    blocks = [...paragraphs(entry.intro, locale), ...sections(entry.sections, locale), ...faq(entry.faq, locale),
      ...relatedForLocale(locale).relatedBoth(path, entry.related).map((row) => link(row.title, row.href))];
  };
  const cards = (numbers: number[]): ContentBlock => ({ type: "cards", cards: numbers.map((n) => ({ arcanum: n, label: arcanumTitle(n), href: e.arcanumHref(n) })) });

  if (family === "arcanum" && key && !child && /^\d{1,2}$/.test(key)) {
    const entry = c.arcanumContent(Number(key));
    if (!entry) return null;
    source = { kind: "arcanum", data: entry }; title = entry.article?.title ?? entry.seo.title; lead = entry.article?.short ?? entry.short;
    blocks.push(cards([entry.n]));
    if (entry.article) blocks.push(...paragraphs(entry.article.intro, locale), ...sections(entry.article.sections, locale,
      c.compatibilityArcanum(entry.n) ? { label: DP.inCompatibility[locale](entry.title), href: e.compatibilityHref(entry.n) } : undefined), ...faq(entry.article.faq, locale));
    else blocks.push(...entry.meaning.flatMap(paragraph), ...sections(entry.sections, locale),
      ...heading(D.encCombination.gives[locale]), { type: "list", ordered: false, items: entry.plus },
      ...heading(D.encCombination.stumbles[locale]), { type: "list", ordered: false, items: entry.minus }, ...faq(entry.faq, locale));
    for (const row of positionsForLocale(locale).registryItems().filter((row) => row.arcanum === entry.n))
      blocks.push(link(positionsForLocale(locale).positionArcanumLabel(row), e.positionHref(row.position) + `/${row.arcanum}`));
    if (!entry.article) for (const [position, text] of Object.entries(entry.inPositions)) blocks.push(link(e.positionByKey(position)?.title ?? position, e.positionHref(position)), ...paragraph(text));
    for (const row of entry.combinations) {
      const combination = c.combinationContent([entry.n, row.with].sort((a, b) => a - b).join("-"));
      blocks.push(link(row.title, row.href), ...paragraph(combination?.short ?? row.short));
    }
    for (const tail of c.karmicTails().filter((tail) => tail.arcana.includes(entry.n))) blocks.push(link(tail.title, e.karmicTailHref(tail.key)));
    blocks.push(link(`${entry.n === 1 ? 22 : entry.n - 1} · ${arcanumTitle(entry.n === 1 ? 22 : entry.n - 1)}`, e.arcanumHref(entry.n === 1 ? 22 : entry.n - 1)),
      link(`${entry.n === 22 ? 1 : entry.n + 1} · ${arcanumTitle(entry.n === 22 ? 1 : entry.n + 1)}`, e.arcanumHref(entry.n === 22 ? 1 : entry.n + 1)));
  } else if (family === "position" && key && child) {
    const registry = positionsForLocale(locale);
    if (!/^\d{1,2}$/.test(child) || !registry.registryItem(key, Number(child))) return null;
    const entry = registry.buildPositionArcanum(key, Number(child));
    source = { kind: "intersection", data: entry }; title = entry.title; lead = entry.short;
    blocks = [{ type: "matrix", points: {}, highlight: entry.mapKeys }, cards([entry.arcanum]),
      ...sections(entry.sections, locale), ...faq(entry.faq, locale), link(entry.positionTitle, entry.positionHref)];
  } else if (family === "position" && key && !child) {
    const entry = c.positionContent(key);
    if (!entry) return null;
    source = { kind: "position", data: entry }; title = entry.h1 ?? entry.title; lead = entry.lead;
    const highlight = entry.kind === "section" ? map.sectionLineKeys(key, entry.points.map((p) => p.key)) : [key];
    blocks = [{ type: "matrix", points: {}, highlight }, ...heading(D.encPosition.howCounted[locale]), ...paragraph(entry.formula),
      ...entry.meaning.flatMap(paragraph), ...sections(entry.sections, locale), ...paragraph(entry.reading), ...faq(entry.faq, locale),
      ...entry.links.map((row) => link(row.label, row.href))];
    for (const row of c.positionArcanumRows().filter((row) => row.position === key))
      blocks.push(link(positionsForLocale(locale).positionArcanumLabel(row), `${e.positionHref(key)}/${row.arcanum}`));
    if (entry.kind === "point") for (let n = 1; n <= 22; n++) blocks.push(link(`${n} · ${arcanumTitle(n)}`, e.arcanumHref(n)), ...paragraph(c.arcanumInPosition(n, key)));
    else for (const point of entry.points) blocks.push(link(point.title, e.positionHref(point.key)));
    const example = matrixForLocale(locale).calculate("1993-03-31", "f");
    if ((PERSONAL_SECTION_KEYS as readonly string[]).includes(key) && key !== "chakras") {
      const personal = key as PersonalSectionKey;
      blocks.push(...heading(D.encPosition.personalExampleTitle[locale]), ...paragraph(readingsForLocale(locale).sectionExampleNote(personal, example)),
        link(D.encPosition.personalExampleLink[locale], readingsForLocale(locale).sectionReadingHref(personal, example)));
    } else if (key === "character") blocks.push(...heading(D.encPosition.personalExampleTitle[locale]), ...paragraph(D.encPosition.characterExampleText[locale]),
      link(D.encPosition.characterExampleLink[locale], "/encyclopedia/character/4-3-22"));
    else if (key === "past_lives") blocks.push(link(D.encPosition.personalExampleLink[locale], e.karmicTailHref(example.karmic_tail.join("-"))));
  } else if (family === "chakra" && key && key !== "energy-field" && !child) {
    const entry = c.chakraContent(key); const definition = e.chakraByKey(key);
    if (!entry || !definition) return null;
    source = { kind: "chakra", data: entry }; title = entry.article?.title ?? (entry.readings.length ? D.encChakra.readingTitle[locale](entry.title) : D.encChakra.h1[locale](entry.title, definition.index));
    lead = entry.article?.short ?? entry.hint;
    blocks.push({ type: "matrix", points: {}, highlight: map.mapPointsBySymbol([definition.physics, definition.energy]).map((p) => p.key) });
    if (entry.article) blocks.push(...paragraphs(entry.article.intro, locale), ...sections(entry.article.sections, locale), ...faq(entry.article.faq, locale));
    else {
      blocks.push(...entry.level.flatMap(paragraph), ...paragraph(D.encChakra.howCountedText[locale](entry.title, definition.physics, definition.energy)),
        ...entry.columns.flatMap((col) => [...heading(col.title, 3), ...paragraph(col.text)]), ...sections(entry.sections, locale));
      for (const example of entry.examples) blocks.push(...heading(example.numbers.join(" / "), 3), ...paragraph(D.encChakra.exampleDate[locale](example.birth.split("-").reverse().join("."))), ...example.paragraphs.flatMap(paragraph));
      for (const row of entry.readings) blocks.push(cards([row.n]), ...[row.physics, row.energy, row.emotions].flatMap((value) => paragraph(value ?? "")));
      blocks.push(...faq(entry.faq, locale));
    }
    blocks.push(link(D.encChakra.sectionChakras[locale], "/encyclopedia/position/chakras"));
  } else if (family === "combination" && key && !child) {
    const pair = e.parseCombinationSlug(key); const entry = pair ? c.combinationContent(key) : null;
    if (!entry || !pair) return null;
    const reading = combinationForLocale(locale).buildCombinationArticle(entry.a, entry.b);
    source = { kind: "combination", data: { entry, reading } }; title = D.encCombination.h1[locale](entry.a, entry.b, entry.title); lead = entry.short;
    const a = c.arcanumContent(entry.a)!, b = c.arcanumContent(entry.b)!;
    blocks = [cards(pair), ...entry.meaning.flatMap(paragraph), ...heading(D.encCombination.gives[locale]), { type: "list", ordered: false, items: [...a.plus.slice(0, 3), ...b.plus.slice(0, 3)] },
      ...heading(D.encCombination.stumbles[locale]), { type: "list", ordered: false, items: [...a.minus.slice(0, 3), ...b.minus.slice(0, 3)] }];
    for (const group of reading.groups) {
      blocks.push(...heading(D.encCombination.groupTitle[locale](group.title, entry.a, entry.b)), ...paragraph(group.lead));
      for (const context of group.contexts) {
        blocks.push(...heading(context.title, 3), ...paragraph(`${context.question}.`));
        for (const variant of context.variants) blocks.push(...heading(variant.heading, 3), ...paragraph(D.encCombination.variantOrder[locale](variant.order)), ...variant.paragraphs.flatMap(paragraph));
      }
      blocks.push(link(group.linkLabel, group.href));
    }
    blocks.push(...heading(D.encCombination.howToCheck[locale]), ...paragraph(D.encCombination.howToCheckHint[locale]), ...reading.practice.flatMap(paragraph));
  } else if (family === "character" && key && !child) {
    const item = c.matrixItem(key); if (!item) return null;
    const reading = characterForLocale(locale).buildCharacterReading(item.matrix);
    source = { kind: "reading", data: reading }; title = reading.title; lead = reading.lead; blocks = readingBlocks(reading, locale);
    blocks.push(link(D.sheet.openSectionArticle[locale], "/encyclopedia/position/character"));
  } else if (family && key && !child && (PERSONAL_SECTION_KEYS as readonly string[]).includes(family)) {
    const personal = family as PersonalSectionKey;
    const matrix = readingsForLocale(locale).sectionReadingMatrix(personal, key, { birth: url.searchParams.get("birth") ?? undefined });
    if (!matrix) return null;
    const reading = readingsForLocale(locale).buildSectionReading(personal, matrix);
    source = { kind: "reading", data: reading }; title = reading.title; lead = reading.lead; blocks = readingBlocks(reading, locale);
    blocks.push(link(D.sheet.openSectionArticle[locale], e.positionHref(personal)));
  } else if (family === "karmic-tail" && key && !child) {
    textArticle(c.karmicTail(key)); if (source) blocks.unshift(cards(key.split("-").map(Number)));
  } else if (family === "compatibility" && key === "tails" && child) {
    textArticle(c.pairTail(child)); if (source) blocks.unshift(cards(child.split("-").map(Number)));
  } else if (family === "compatibility" && key && key !== "tails" && !child) {
    textArticle(c.compatibilityArcanum(key)); if (source && /^\d+$/.test(key)) blocks.unshift(cards([Number(key)]));
  } else if (family && !key && e.hasHubRoute(family) && e.hubHref(family) === path) textArticle(c.hub(family));
  else if (path === "/encyclopedia/chakra/energy-field") textArticle(c.categoryHub("energy-field"));
  else if (path === "/encyclopedia/month") textArticle(c.categoryHub("month"));
  else if (family === "year" && key && !child) textArticle(c.yearArcanum(key));
  else if (path === e.YEAR_HUB) {
    textArticle(c.categoryHub("year"));
    blocks.push(...c.yearKeys().map((key) => link(c.yearArcanum(key)!.title, e.yearHref(key))));
  }
  else if (path === "/encyclopedia" || (match && (!key || (family === "compatibility" && key === "tails" && !child)))) {
    const links: Array<{ label: string; href: string }> = [];
    const add = (label: string, href: string) => links.push({ label, href });
    const nav = navigationForLocale(locale);
    if (path === "/encyclopedia") {
      title = D.nav.encyclopedia[locale]; lead = D.enc.description[locale];
      for (const item of nav.ENCYCLOPEDIA_SECTIONS) if ("hub" in item) add(item.title, item.hub);
      if (c.categoryHub("month")) add(c.categoryHub("month")!.title, "/encyclopedia/month");
    } else if (family === "arcanum") {
      textArticle(c.categoryHub("arcanum"));
      title ||= nav.encyclopediaSection("arc").title;
      for (let n = 1; n <= 22; n++) add(`${n} · ${arcanumTitle(n)}`, e.arcanumHref(n));
    } else if (family === "position") {
      textArticle(c.categoryHub("position")); title ||= nav.encyclopediaSection("pts").title;
      for (const row of e.POSITIONS) add(row.title, e.positionHref(row.key));
    } else if (family === "chakra") {
      textArticle(c.categoryHub("chakra")); title ||= nav.encyclopediaSection("chk").title;
      for (const row of e.CHAKRA_PAGES) add(row.title, e.chakraHref(row.key));
      if (c.categoryHub("energy-field")) add(c.categoryHub("energy-field")!.title, "/encyclopedia/chakra/energy-field");
    } else if (family === "karmic-tail") {
      textArticle(c.categoryHub("karmic-tail")); title ||= nav.encyclopediaSection("tls").title;
      for (const row of c.karmicTails()) add(row.title, e.karmicTailHref(row.key));
    } else if (family === "compatibility" && key === "tails") {
      textArticle(c.categoryHub("compatibility-tails")); title ||= nav.encyclopediaSection("ptl").title;
      for (const tail of c.pairTailKeys()) add(c.pairTail(tail)!.title, e.pairTailHref(tail));
    } else if (family === "compatibility") {
      textArticle(c.categoryHub("compatibility")); title ||= nav.encyclopediaSection("cmp").title;
      for (const n of c.compatibilityKeys()) add(c.compatibilityArcanum(n)!.title, e.compatibilityHref(n));
    } else if (family === "combination") {
      textArticle(c.categoryHub("combination")); title ||= nav.encyclopediaSection("cmb").title;
      for (const pair of e.allCombinationSlugs()) add(c.combinationContent(pair)!.title, `/encyclopedia/combination/${pair}`);
    } else return null;
    // Category articles keep their canonical source; the menu is additional presentation data.
    source ??= { kind: "index", data: { title, links } };
    blocks.push(...links.map((row) => link(row.label, row.href)));
  }
  if (!source || !title) return null;
  const canonicalPath = path + (url.searchParams.size ? `?${url.searchParams}` : "");
  return { source, document: {
    schemaVersion: 1, path: canonicalPath, locale, title, lead,
    breadcrumbs: [{ label: D.nav.home[locale], href: "/" }, { label: D.nav.encyclopedia[locale], href: "/encyclopedia" }, { label: title }],
    blocks, access: "public", accessUntil: null,
  } };
}

export function articleSource<K extends keyof SourceMap>(path: string, context: ArticleContext, kind: K): SourceMap[K] | null {
  const result = article(path, context);
  return result?.source.kind === kind ? result.source.data as SourceMap[K] : null;
}

/** Website pages retain their existing components while consuming the same article source. */
export function articleContentForLocale(locale: Lang) {
  const c = contentForLocale(locale);
  return { ...c,
    arcanumContent: (n: number) => articleSource(`/encyclopedia/arcanum/${n}`, { locale }, "arcanum"),
    positionContent: (key: string) => articleSource(`/encyclopedia/position/${key}`, { locale }, "position"),
    chakraContent: (key: string) => articleSource(`/encyclopedia/chakra/${key}`, { locale }, "chakra"),
    combinationContent: (key: string) => articleSource(`/encyclopedia/combination/${key}`, { locale }, "combination")?.entry ?? null,
    karmicTail: (key: string) => articleSource(`/encyclopedia/karmic-tail/${key}`, { locale }, "text"),
    pairTail: (key: string) => articleSource(`/encyclopedia/compatibility/tails/${key}`, { locale }, "text"),
    compatibilityArcanum: (key: string | number) => articleSource(`/encyclopedia/compatibility/${key}`, { locale }, "text"),
    yearArcanum: (key: string | number) => articleSource(`/encyclopedia/year/${key}`, { locale }, "text"),
    categoryHub: (key: string) => {
      const path = key === "energy-field" ? "/encyclopedia/chakra/energy-field" : key === "year" ? "/encyclopedia/year"
        : key === "compatibility-tails" ? "/encyclopedia/compatibility/tails" : `/encyclopedia/${key}`;
      return articleSource(path, { locale }, "text");
    },
  };
}
