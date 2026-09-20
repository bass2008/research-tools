import type { Lang } from "../lang";

/** Строка на всех языках развёртки. Ключ один — текст у каждого языка свой. */
export type Phrase = Record<Lang, string>;
/** Фраза с подстановкой: у языков разный порядок слов, поэтому шаблон свой у каждого. */
export type PhraseFn<A extends unknown[]> = Record<Lang, (...args: A) => string>;

import { mapPoints, octagram } from "./map";
import { matrixPages } from "./matrixPages";
import { apiErrors, bffErrors, clause, emailErrors, encSections, payTarget, relatedLinks } from "./misc";
import { nav } from "./nav";
import { pages } from "./pages";
import { report, reportSheet } from "./report";
import { account, auth } from "./account";
import { calc } from "./calc";
import { combination } from "./combination";
import { enc, encArcanum, encChakra, encCombination, encLinks, encPosition } from "./enc";
import { encCharacter, encTail, encYear } from "./encYear";
import { pay, payForm, payResult } from "./pay";
import { common, meta } from "./common";
import { home, homeMeta, quote, slides, unlockBox } from "./home";
import { legal } from "./legal";

export const D = {
  account,
  legal,
  auth,
  calc,
  combination,
  enc,
  encArcanum,
  encChakra,
  encCombination,
  encLinks,
  encPosition,
  encTail,
  encCharacter,
  encYear,
  pay,
  payForm,
  payResult,
  mapPoints,
  octagram,
  matrixPages,
  apiErrors,
  bffErrors,
  clause,
  emailErrors,
  encSections,
  payTarget,
  relatedLinks,
  nav,
  pages,
  report,
  sheet: reportSheet,
  common,
  home,
  unlockBox,
  quote,
  homeMeta,
  slides,
  meta,
};
