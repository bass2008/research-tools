"use client";

import { useSyncExternalStore } from "react";
import { loadPair, PAIR_EVENT, type StoredPair } from "./storage";

let snapshot: StoredPair | null = null;
let raw = "";

function read(): StoredPair | null {
  const stored = loadPair();
  const key = stored ? JSON.stringify(stored) : "";
  if (key !== raw) {
    raw = key;
    snapshot = stored;
  }
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  const events: Array<[EventTarget, string]> = [[window, PAIR_EVENT], [window, "focus"], [window, "pageshow"]];
  for (const [target, name] of events) target.addEventListener(name, onChange);
  return () => {
    for (const [target, name] of events) target.removeEventListener(name, onChange);
  };
}

/** Пара из последнего расчёта в этой вкладке — одним способом на весь сайт, как useBirth. */
export function usePair(): StoredPair | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
