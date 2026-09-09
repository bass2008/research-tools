// Какую запись открывает расчёт и каким полом после этого подписан экран.
//
// Пол не меняет в разборе ни одного числа и ни одной строки: `engine/tests/test_method_contract.py`
// сверяет разборы обоих полов и они совпадают целиком, различается только само поле. Поэтому право
// ищется по дате — иначе переключатель после покупки возвращал оплаченный разбор под замки.
//
// Но раз открывается купленная запись, то и переключатель с подписью обязаны показывать её пол.
// Пока это расходилось, экран утверждал сразу и «Женский» в форме, и «мужская карта» над разбором.
import type { MatrixListItem } from "./api";
import type { StoredBirth } from "./storage";

export interface Opened {
  /** купленная запись на эту дату, если она есть */
  row: MatrixListItem | null;
  /** пол, к которому надо привести сохранённую дату; null — приводить нечего */
  align: StoredBirth | null;
}

export function openedFor(requested: StoredBirth, own: MatrixListItem[]): Opened {
  const row = own.find((item) => item.birth === requested.birth && item.access !== "locked") ?? null;
  if (row === null) return { row: null, align: null };
  const align = row.sex === requested.sex ? null : { birth: row.birth, sex: row.sex };
  return { row, align };
}
