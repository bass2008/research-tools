import type { Values } from "@/lib/individualLinks";

export type SetKey = "one" | "selfYear" | "couple" | "custom";
export type Kind = "personal" | "pair" | "year";
export type UserDate = { y: number; m: number; d: number };
/** The visitor's own date from the links block and what the page shows for it. */
export interface UserInfo { date: UserDate; v: Values; totals: [number, number, number]; links: number }

export const pad = (n: number) => String(n).padStart(2, "0");
export const showDate = (r: UserDate) => `${pad(r.d)}.${pad(r.m)}.${r.y}`;
