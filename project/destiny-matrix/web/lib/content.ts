/** Node adapter. The content reader itself has no filesystem or framework dependency. */
import fs from "node:fs";
import path from "node:path";
import { createContent, type ContentSource } from "./contentReader";
import { SITE_LANG } from "./i18n/lang";
import { localized } from "./i18n/localized";

export type * from "./contentReader";

const files: ContentSource = {
  read(file, locale, shared = false) {
    const dir = path.join(process.cwd(), "content", ...(shared ? [] : [locale]));
    return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as unknown;
  },
};

export const forLocale = localized((locale) => createContent(locale, files));
export const { karmicTail, karmicTailKeys, indexedKarmicTailKeys, karmicTails, yearArcanum, yearKeys, categoryHub, hub, hubKeys, arcanumContent, indexedPositionArcanumRows, positionArcanumRows, positionContent, chakraContent, combinationContent, arcanumInPosition, matrixSlugs, matrixItem, matrixCount, contentStats } = forLocale(SITE_LANG);
