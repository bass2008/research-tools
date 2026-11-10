// Who each reading of an order is for (docs/individual-reading.md): everything is entered before
// the payment. A personal reading always brings its own person; a year reading and each side of a
// couple either take someone already in the order or bring a new person.
import type { Cart, IndividualKindKey, OrderReading } from "./individualPricing";

export interface Slot { kind: IndividualKindKey; n: number; roles: string[] }

/** Personal readings first, so the people they bring can be picked for the year and couple readings. */
export function slotsOf(cart: Cart): Slot[] {
  const slots: Slot[] = [];
  for (let n = 0; n < cart.personal; n++) slots.push({ kind: "personal", n, roles: [`p${n}`] });
  for (let n = 0; n < cart.year; n++) slots.push({ kind: "year", n, roles: [`y${n}`] });
  for (let n = 0; n < cart.pair; n++) slots.push({ kind: "pair", n, roles: [`a${n}`, `b${n}`] });
  return slots;
}

export const OWN = "own";
export type Choices = Record<string, string>;

/** The usual order: the year readings are for the people of the personal ones, the first one
 *  otherwise; a couple is the first person with the next one. */
export function defaultChoices(cart: Cart): Choices {
  const choices: Choices = {};
  const first = cart.personal ? "p0" : cart.year ? "y0" : "a0";
  for (let n = 0; n < cart.year; n++) {
    const role = `y${n}`;
    choices[role] = n < cart.personal ? `p${n}` : role === first ? OWN : first;
  }
  for (let n = 0; n < cart.pair; n++) {
    const role = `a${n}`;
    choices[role] = role === first ? OWN : first;
    choices[`b${n}`] = n + 1 < cart.personal ? `p${n + 1}` : OWN;
  }
  return choices;
}

/** A changed set keeps who the buyer picked by hand; the other roles take the defaults of the new set. */
export function carryChoices(cart: Cart, prev: Choices, picked: Iterable<string>): Choices {
  const next = defaultChoices(cart);
  const roles = new Set(slotsOf(cart).flatMap((s) => s.roles));
  for (const role of picked) if (roles.has(role) && role in prev) next[role] = prev[role];
  return next;
}

/** Person index of every role; a choice of someone who no longer brings a person falls back to a new one. */
export function resolve(slots: Slot[], choices: Choices): { owners: string[]; person: Record<string, number> } {
  const owners: string[] = [];
  const person: Record<string, number> = {};
  for (const role of slots.flatMap((s) => s.roles)) {
    const target = choices[role];
    if (target && target !== OWN && target in person && owners.includes(target)) person[role] = person[target];
    else person[role] = owners.push(role) - 1;
  }
  return { owners, person };
}

/** Year readings for the same person default to consecutive years, so a set never asks for the same reading twice. */
export function defaultYears(slots: Slot[], person: Record<string, number>, base: number): Record<string, number> {
  const seen = new Map<number, number>();
  const years: Record<string, number> = {};
  for (const s of slots) {
    if (s.kind !== "year") continue;
    const who = person[s.roles[0]];
    years[s.roles[0]] = base + (seen.get(who) ?? 0);
    seen.set(who, (seen.get(who) ?? 0) + 1);
  }
  return years;
}

export function readingsOf(slots: Slot[], person: Record<string, number>, year: (role: string) => number,
  relation: (role: string) => string, child: (role: string) => boolean = () => false): OrderReading[] {
  return slots.map((s) => ({
    kind: s.kind,
    who: s.roles.map((r) => person[r]),
    ...(s.kind === "year" ? { year: year(s.roles[0]) } : {}),
    ...(s.kind === "pair" && relation(s.roles[0]) ? { relation: relation(s.roles[0]) } : {}),
    ...(s.kind === "personal" && child(s.roles[0]) ? { child: true } : {}),
  }));
}

/** Full years on `today`: the child's matrix is for dates under 18, the form suggests it under 15. */
export function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
export const CHILD_TAG_MAX_AGE = 17;
export const CHILD_HINT_AGE = 15;

export type OrderProblem = "samePerson" | "duplicate" | null;

export function problemOf(readings: OrderReading[]): OrderProblem {
  if (readings.some((r) => r.kind === "pair" && r.who[0] === r.who[1])) return "samePerson";
  const keys = readings.map((r) => `${r.kind}|${[...r.who].sort((a, b) => a - b).join(",")}|${r.year ?? ""}`);
  return new Set(keys).size < keys.length ? "duplicate" : null;
}
