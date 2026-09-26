import { D } from "./i18n";

// Цель платежа — одно значение на всю форму: из него печатаются список, надпись на кнопке,
// подсказка и тело запроса. Пока это считалось в трёх местах, они расходились: список показывал
// одну дату, кнопка другую, а платёж уходил за третью.

import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedMatrix, type Sex } from "./matrix";

export interface TargetRow {
  id: number;
  birth: string;
  sex: Sex;
  title: string | null;
  access: "open" | "forever" | "granted" | "subscription" | "locked";
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

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { birthLabel, sexLabel } = localizedMatrix(L);

  function sameDate(row: { birth: string; sex: Sex }, birth: LocalBirth): boolean {
    return row.birth === birth.birth && row.sex === birth.sex;
  }

  /** Дата из браузера предлагается только если она ещё не лежит в кабинете — с тем же полом. */
  function canPickLocal(rows: TargetRow[], birth: LocalBirth | null): boolean {
    return Boolean(birth) && !rows.some((row) => sameDate(row, birth!));
  }

  function label(birth: string, sex: Sex, title?: string | null): string {
    return title ?? `${birthLabel(birth)}, ${sexLabel(sex)}`;
  }

  /** Имя цели: дата, а пол — только когда на одну дату есть две записи. Иначе различать нечего, а
   * строка перестаёт влезать в поле на узком телефоне. */
  function nameOf(birth: string, sex: Sex, title: string | null, rows: TargetRow[]): string {
    const twins = rows.filter((r) => r.birth === birth).length > 1;
    const base = title || birthLabel(birth);
    return base + (twins ? ` (${sex === "f" ? D.payTarget.female[L] : D.payTarget.male[L]})` : "");
  }

  function withBirth(rows: TargetRow[], birth: LocalBirth | null): TargetRow[] {
    return birth ? [...rows, { ...birth, id: 0, title: null, access: "locked" as const }] : rows;
  }

  /** Из чего человек выбирает. Порядок: дата из браузера, затем закрытые записи кабинета. */
  function options(rows: TargetRow[], birth: LocalBirth | null): TargetOption[] {
    const out: TargetOption[] = [];
    const all = withBirth(rows, birth);
    if (birth && canPickLocal(rows, birth)) {
      out.push({
        value: "local",
        label: `${nameOf(birth.birth, birth.sex, null, all)} · ${D.payTarget.fromBrowser[L]}`,
        target: { kind: "local" },
      });
    }
    for (const row of rows.filter((r) => r.access === "locked")) {
      out.push({
        value: String(row.id),
        label: `${nameOf(row.birth, row.sex, row.title, all)} · ${D.payTarget.fromAccount[L]}`,
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
  function pickTarget(
    rows: TargetRow[],
    birth: LocalBirth | null,
    wanted: number | null,
  ): Target {
    const list = options(rows, birth);
    if (wanted !== null) {
      // Ссылка назвала дату — либо она, либо ничего. Подстановка «первой закрытой» проводила
      // платёж за дату, которой человек не просил.
      return list.find((o) => o.value === String(wanted))?.target ?? null;
    }
    return list.length ? list[0].target : null;
  }

  /** Ссылка `?m=` ведёт на запись, которая уже открыта: список целей её не содержит, и цель
   *  молча падала на первую закрытую дату — платёж уходил не за ту дату, что обещала ссылка. */
  function askedOpen(rows: TargetRow[], wanted: number | null): TargetRow | null {
    if (wanted === null) return null;
    return rows.find((row) => row.id === wanted && row.access !== "locked") ?? null;
  }

  /** Дата из браузера уже открыта: платить второй раз нечего, и об этом надо сказать прямо. */
  function alreadyOpen(rows: TargetRow[], birth: LocalBirth | null): TargetRow | null {
    if (!birth) return null;
    return rows.find((row) => sameDate(row, birth) && row.access !== "locked") ?? null;
  }

  /** Осталась ли выбранная цель среди вариантов: список мог обновиться, пока форма открыта. */
  function stillValid(target: Target, list: TargetOption[]): boolean {
    if (target === null) return false;
    const value = target.kind === "local" ? "local" : String(target.id);
    return list.some((o) => o.value === value);
  }

  function targetValue(target: Target): string {
    if (target === null) return "none";
    return target.kind === "local" ? "local" : String(target.id);
  }

  /** Подпись цели: одна и та же строка в списке, на кнопке и в подсказке. */
  function targetLabel(
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
  function paymentTargetLabel(payment: {
    matrix?: { birth: string; sex: Sex; title: string | null } | null;
    matrix_id: number | null;
  }): string {
    if (payment.matrix) {
      // Подпись придумывает покупатель: «Котик Барсик» вместо даты не даёт админу ничего, а
      // длинная подпись раздувала строку таблицы вчетверо. Дата первая, подпись — коротким хвостом.
      const base = `${birthLabel(payment.matrix.birth)}, ${sexLabel(payment.matrix.sex)}`;
      const title = payment.matrix.title?.trim();
      if (!title) return base;
      const short = title.length > 40 ? `${title.slice(0, 39)}…` : title;
      return `${base} · ${short}`;
    }
    return payment.matrix_id === null ? D.common.dash[L] : D.payTarget.removed[L](payment.matrix_id);
  }
  return { sameDate, canPickLocal, label, options, pickTarget, askedOpen, alreadyOpen, stillValid, targetValue, targetLabel, paymentTargetLabel };
});

// Compatibility for callers that explicitly use the deployment default.
export const { sameDate, canPickLocal, label, options, pickTarget, askedOpen, alreadyOpen, stillValid, targetValue, targetLabel, paymentTargetLabel } = forLocale(defaultLocale);
