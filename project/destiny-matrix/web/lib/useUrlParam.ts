"use client";

import { useSyncExternalStore } from "react";

// Читаем параметр адреса без useSearchParams: этот хук уводит статическую страницу в
// клиентский рендер целиком — арканы и справочник отдавались пустым HTML, без h1 и разметки.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function useUrlParam(name: string): string | null {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return new URLSearchParams(search).get(name);
}

