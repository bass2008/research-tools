import { forLocale } from "./adminLocale";
import type { Lang } from "./i18n/lang";
import type { Pulse } from "./api";

export type Level = "ok" | "warn" | "bad";

// Пороги те же, что у тревог в облаке: 85% — предел, после которого приходит письмо. Жёлтый на
// 70% нужен, чтобы увидеть подпирающий диск до того, как он выстрелит на релизе.
export const WARN = 70;
export const BAD = 85;

export function level(percent: number, warn = WARN, bad = BAD): Level {
  if (percent >= bad) return "bad";
  if (percent >= warn) return "warn";
  return "ok";
}

/** Что сейчас не так — человеческими словами, в порядке важности. */
export function troubles(p: Pulse, locale: Lang = "ru"): string[] {
  const { t } = forLocale(locale);
  const out: string[] = [];
  if (p.disk.percent >= BAD) out.push(t("диск занят на {0}%", p.disk.percent));
  if (p.data_disk.percent >= BAD && p.data_disk.path !== p.disk.path)
    out.push(t("том с базой занят на {0}%", p.data_disk.percent));
  if (p.memory.percent >= BAD) out.push(t("память занята на {0}%", p.memory.percent));
  if (p.cpu.percent >= BAD) out.push(t("процессор загружен на {0}%", p.cpu.percent));
  if (p.print.failures_hour > 0)
    out.push(t("печать падала {0} раз за час", p.print.failures_hour));
  if (p.payments.stuck > 0) out.push(t("платежей застряло: {0}", p.payments.stuck));
  if (p.errors.last10min > 5) out.push(t("ошибок за 10 минут: {0}", p.errors.last10min));
  return out;
}

export function worst(p: Pulse): Level {
  const levels = [p.disk.percent, p.data_disk.percent, p.memory.percent, p.cpu.percent].map((v) =>
    level(v),
  );
  if (troubles(p).length && !levels.includes("bad")) return "warn";
  return levels.includes("bad") ? "bad" : levels.includes("warn") ? "warn" : "ok";
}
