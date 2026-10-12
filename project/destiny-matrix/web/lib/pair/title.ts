import { DP } from "@/lib/i18n/dict/pair";
import type { Lang as Locale } from "@/lib/i18n/lang";
import { forLocale as localizedMatrix } from "@/lib/matrix";

interface Partner {
  birth: string;
  name?: string | null;
}

/** Название пары — по правилу сервера (`products._pair_title`): с двумя именами — имена, иначе
 *  даты. Одно на калькулятор, разбор, PDF, оплату и кабинет. */
export function pairTitle(L: Locale, a: Partner, b: Partner): string {
  if (a.name && b.name) return DP.and[L](a.name, b.name);
  const { birthLabel } = localizedMatrix(L);
  return DP.pairDates[L](birthLabel(a.birth), birthLabel(b.birth));
}
