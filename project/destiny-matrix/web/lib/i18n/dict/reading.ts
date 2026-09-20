/**
 * Слова самого разбора: заголовки разделов, подписи ролей, рамки и связки.
 *
 * Отдельным модулем ради пейволла. Словарь — обычный объект, и одного импорта из компонента
 * с «use client» хватает, чтобы он целиком оказался в видимом чанке; подписи и вводки
 * восемнадцати платных разделов там делать нечего. Эти ветки читает только серверный код,
 * который собирает разбор, — поэтому они и не лежат рядом с `D`.
 */
import { characterLinks, characterReading, comfort } from "./readings";
import { chakraYears, readingBody, sectionReading, sharedBlock } from "./readingBody";
import { sectionDefs } from "./sectionDefs";
import { sectionRoles } from "./sectionRoles";
import { professionLine, purposeLadder, sectionSummaries } from "./sectionSummaries";
import { crossing } from "./crossings";
import { decades, frames } from "./frames";

export const DR = {
  sectionDefs,
  sectionRoles,
  sectionSummaries,
  professionLine,
  purposeLadder,
  readingBody,
  sharedBlock,
  chakraYears,
  sectionReading,
  characterReading,
  characterLinks,
  comfort,
  frames,
  decades,
  crossing,
};
