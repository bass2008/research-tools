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
export function troubles(p: Pulse): string[] {
  const out: string[] = [];
  if (p.disk.percent >= BAD) out.push(`диск занят на ${p.disk.percent}%`);
  if (p.data_disk.percent >= BAD && p.data_disk.path !== p.disk.path)
    out.push(`том с базой занят на ${p.data_disk.percent}%`);
  if (p.memory.percent >= BAD) out.push(`память занята на ${p.memory.percent}%`);
  if (p.cpu.percent >= BAD) out.push(`процессор загружен на ${p.cpu.percent}%`);
  if (p.print.failures_hour > 0)
    out.push(`печать падала ${p.print.failures_hour} раз за час`);
  if (p.payments.stuck > 0) out.push(`платежей застряло: ${p.payments.stuck}`);
  if (p.errors.last10min > 5) out.push(`ошибок за 10 минут: ${p.errors.last10min}`);
  return out;
}

export function worst(p: Pulse): Level {
  const levels = [p.disk.percent, p.data_disk.percent, p.memory.percent, p.cpu.percent].map((v) =>
    level(v),
  );
  if (troubles(p).length && !levels.includes("bad")) return "warn";
  return levels.includes("bad") ? "bad" : levels.includes("warn") ? "warn" : "ok";
}
