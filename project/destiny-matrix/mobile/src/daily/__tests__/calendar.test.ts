/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from '@jest/globals';
import ts from 'typescript';
import { millisecondsUntilTomorrow, selectionForDate } from '../calendar';

// A fresh Node process gives Date a real timezone. Changing process.env.TZ in
// Jest's VM does not reliably change Date's timezone, especially around DST.
const compiled = ts.transpileModule(readFileSync(path.resolve(__dirname, '../calendar.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function inTimezone(zone: string, expression: string) {
  return JSON.parse(execFileSync(process.execPath, ['-e', `${compiled}\nconsole.log(JSON.stringify(${expression}));`], {
    env: { ...process.env, TZ: zone }, encoding: 'utf8',
  }));
}

it('uses the local calendar date at a UTC boundary', () => {
  const instant = '2026-11-08T22:30:00.000Z';
  const east = inTimezone('Europe/Moscow', `exports.selectionForDate(new Date('${instant}'))`);
  const west = inTimezone('America/New_York', `exports.selectionForDate(new Date('${instant}'))`);
  expect(east.dateKey).toBe('2026-11-09');
  expect(west.dateKey).toBe('2026-11-08');
  expect(east.arcanum).not.toBe(west.arcanum);
  const sameCivilDay = inTimezone('America/New_York', "exports.selectionForDate(new Date(2026, 10, 9, 12))");
  expect(sameCivilDay).toEqual(east);
});

it.each([[2024, 1, 21], [2026, 11, 20], [1969, 11, 15]])(
  'covers every arcanum once in 22 consecutive local dates starting %i/%i/%i', (year, month, day) => {
    const days = Array.from({ length: 22 }, (_, index) => selectionForDate(new Date(year, month, day + index, 12)));
    expect(new Set(days.map(value => value.dateKey)).size).toBe(22);
    expect(days.map(value => value.arcanum).sort((a, b) => a - b)).toEqual(Array.from({ length: 22 }, (_, index) => index + 1));
    expect(selectionForDate(new Date(year, month, day, 0, 1))).toEqual(selectionForDate(new Date(year, month, day, 23, 59)));
  },
);

it.each([
  ['2026, 2, 8', 23],
  ['2026, 10, 1', 25],
  ['2026, 1, 10', 24],
] as const)('schedules the next civil midnight across DST (%s)', (dateParts, hours) => {
  const delay = inTimezone('America/New_York', `exports.millisecondsUntilTomorrow(new Date(${dateParts}))`);
  expect(delay).toBeGreaterThanOrEqual(hours * 3_600_000);
  expect(delay).toBeLessThan(hours * 3_600_000 + 1000);
});

it('advances past year end, without scheduling a zero-delay timer', () => {
  const now = new Date(2026, 11, 31, 23, 59, 59, 999);
  const delay = millisecondsUntilTomorrow(now);
  expect(delay).toBeGreaterThan(0);
  expect(delay).toBeLessThan(1000);
  expect(selectionForDate(new Date(now.getTime() + delay)).dateKey).toBe('2027-01-01');
});
