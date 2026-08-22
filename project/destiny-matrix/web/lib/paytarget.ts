// Цель платежа — одно значение на всю форму: из него печатаются список, надпись на кнопке,
// подсказка и тело запроса. Пока это считалось в трёх местах, они расходились: список показывал
// одну дату, кнопка другую, а платёж уходил за третью.

import { birthLabel, sexLabel, type Sex } from "./matrix";

export interface TargetRow {
  id: number;
  birth: string;
  sex: Sex;
  title: string | null;
  access: "forever" | "subscription" | "locked";
}

export interface LocalBirth {
  birth: string;
  sex: Sex;
}

/** Что откроет платёж: сохранённая запись, дата из браузера или ничего. */
export type Target = { kind: "matrix"; id: number } | { kind: "local" } | null;

export interface TargetOption {
  value: string;
  label: string;
  target: Target;
}

export function sameDate(row: { birth: string; sex: Sex }, birth: LocalBirth): boolean {
  return row.birth === birth.birth && row.sex === birth.sex;
}

/** Дата из браузера предлагается только если она ещё не лежит в кабинете — с тем же полом. */
export function canPickLocal(rows: TargetRow[], birth: LocalBirth | null): boolean {
  return Boolean(birth) && !rows.some((row) => sameDate(row, birth!));
}

export function label(birth: string, sex: Sex, title?: string | null): string {
  return title ?? `${birthLabel(birth)}, ${sexLabel(sex)}`;
}

/** Имя цели: дата, а пол — только когда на одну дату есть две записи. Иначе различать нечего, а
 * строка перестаёт влезать в поле на узком телефоне. */
function nameOf(birth: string, sex: Sex, title: string | null, rows: TargetRow[]): string {
  if (title) return title;
  const twins = rows.filter((r) => r.birth === birth).length > 1;
  return birthLabel(birth) + (twins ? ` (${sex === "f" ? "ж" : "м"})` : "");
}

function withBirth(rows: TargetRow[], birth: LocalBirth | null): TargetRow[] {
  return birth ? [...rows, { ...birth, id: 0, title: null, access: "locked" as const }] : rows;
}

/** Из чего человек выбирает. Порядок: дата из браузера, затем закрытые записи кабинета. */
export function options(rows: TargetRow[], birth: LocalBirth | null): TargetOption[] {
  const out: TargetOption[] = [];
  const all = withBirth(rows, birth);
  if (birth && canPickLocal(rows, birth)) {
    out.push({
      value: "local",
      label: `${nameOf(birth.birth, birth.sex, null, all)} · браузер`,
      target: { kind: "local" },
    });
  }
  for (const row of rows.filter((r) => r.access === "locked")) {
    out.push({
      value: String(row.id),
      label: `${nameOf(row.birth, row.sex, row.title, all)} · кабинет`,
      target: { kind: "matrix", id: row.id },
    });
  }
  return out;
}

/**
 * Какую цель предложить. Явный выбор по ссылке `?m=` учитывается только если такая запись
 * действительно есть у этого человека и ещё закрыта: чужой или устаревший номер молча уводил
 * платёж не на ту дату.
 */
export function pickTarget(
  rows: TargetRow[],
  birth: LocalBirth | null,
  wanted: number | null,
): Target {
  const list = options(rows, birth);
  if (wanted !== null) {
    const asked = list.find((o) => o.value === String(wanted));
    if (asked) return asked.target;
  }
  return list.length ? list[0].target : null;
}

/** Дата из браузера уже открыта: платить второй раз нечего, и об этом надо сказать прямо. */
export function alreadyOpen(rows: TargetRow[], birth: LocalBirth | null): TargetRow | null {
  if (!birth) return null;
  return rows.find((row) => sameDate(row, birth) && row.access !== "locked") ?? null;
}

/** Осталась ли выбранная цель среди вариантов: список мог обновиться, пока форма открыта. */
export function stillValid(target: Target, list: TargetOption[]): boolean {
  if (target === null) return false;
  const value = target.kind === "local" ? "local" : String(target.id);
  return list.some((o) => o.value === value);
}

export function targetValue(target: Target): string {
  if (target === null) return "none";
  return target.kind === "local" ? "local" : String(target.id);
}

export function fromValue(value: string): Target {
  if (value === "local") return { kind: "local" };
  if (value === "none") return null;
  const id = Number(value);
  return Number.isFinite(id) ? { kind: "matrix", id } : null;
}

/** Подпись цели: одна и та же строка в списке, на кнопке и в подсказке. */
export function targetLabel(
  target: Target,
  rows: TargetRow[],
  birth: LocalBirth | null,
): string | null {
  if (target === null) return null;
  const all = withBirth(rows, birth);
  if (target.kind === "local") return birth ? nameOf(birth.birth, birth.sex, null, all) : null;
  const row = rows.find((r) => r.id === target.id);
  return row ? nameOf(row.birth, row.sex, row.title, all) : null;
}

/** Что открыл платёж — для админки: номер записи о списании ничего не говорит. */
export function paymentTargetLabel(payment: {
  matrix?: { birth: string; sex: Sex; title: string | null } | null;
  matrix_id: number | null;
}): string {
  if (payment.matrix) {
    return label(payment.matrix.birth, payment.matrix.sex, payment.matrix.title);
  }
  return payment.matrix_id === null ? "—" : `запись ${payment.matrix_id} удалена`;
}
