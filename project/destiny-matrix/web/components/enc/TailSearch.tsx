"use client";

import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import type { Lang as Locale } from "@/lib/i18n/lang";
import Link from "next/link";
import { useState } from "react";

export interface TailLink {
  key: string;
  names: string;
  href: string;
}

// "9 21 12", "9–21–12", "9.21.12" → "9-21-12"; order and repeats stay as typed.
export function normalizeTail(value: string): string {
  return value.trim().split(/[^0-9]+/).filter(Boolean).join("-");
}

export function filterTails(tails: TailLink[], query: string): TailLink[] {
  const q = normalizeTail(query);
  if (!q) return [];
  const full = q.split("-").length === 3;
  return tails.filter((t) => (full ? t.key === q : `${t.key}-`.startsWith(`${q}-`)));
}

export default function TailSearch({ locale: L, tails, pair = false }: { locale: Locale; tails: TailLink[]; pair?: boolean }) {
  const [query, setQuery] = useState("");
  const text = pair
    ? { label: DP.encPairTail.searchLabel[L], placeholder: DP.encPairTail.searchPlaceholder[L], missing: DP.encPairTail.missing[L] }
    : { label: D.enc.tailSearchLabel[L], placeholder: D.enc.tailSearchPlaceholder[L], missing: D.enc.tailSearchMissing[L] };
  const q = normalizeTail(query);
  const shown = filterTails(tails, query);

  return (
    <>
      <label htmlFor="tail-search">{text.label}</label>
      <input id="tail-search" type="text" inputMode="numeric" autoComplete="off" value={query}
        placeholder={text.placeholder} onChange={(e) => setQuery(e.target.value)}
        data-testid="tail-search" />
      {q && !shown.length ? (
        <p className="section-gap" data-testid="tail-missing">{text.missing(q)}</p>
      ) : null}
      {shown.length ? (
        <div className="taglist section-gap" data-testid="tail-found">
          {shown.map((t) => <Link key={t.key} href={t.href} prefetch={false}>{t.key} · {t.names}</Link>)}
        </div>
      ) : null}
    </>
  );
}
